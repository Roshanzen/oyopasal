import os
import re
from datetime import time
from django.db import transaction
from django.utils.text import slugify
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from drf_spectacular.utils import extend_schema

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return

from apps.common.permissions import IsApprovedVendor
from apps.common.media_views import detect_image_type
from apps.stores.models import Store, StoreGalleryImage
from apps.vendors.models import VendorProfile

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_GALLERY_IMAGES = 9


def parse_time_str(val):
    """Parses 'HH:MM' or 'HH:MM:SS' or 'HH:MM AM/PM' string into datetime.time or None."""
    if not val:
        return None
    if isinstance(val, time):
        return val
    val = str(val).strip()
    if not val:
        return None
    # Try 12-hour AM/PM format
    m12 = re.match(r'^(\d{1,2}):(\d{2})\s*(AM|PM)$', val, re.IGNORECASE)
    if m12:
        hour = int(m12.group(1))
        minute = int(m12.group(2))
        period = m12.group(3).upper()
        if period == 'PM' and hour < 12:
            hour += 12
        elif period == 'AM' and hour == 12:
            hour = 0
        return time(hour, minute)
    # Try 24-hour format
    m24 = re.match(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$', val)
    if m24:
        return time(int(m24.group(1)), int(m24.group(2)), int(m24.group(3) or 0))
    return None


def serialize_store_profile(store: Store, request) -> dict:
    """Builds a rich dictionary of the store profile with absolute media URIs."""
    vendor = store.vendor

    def get_absolute_url(url_val):
        if not url_val:
            return ""
        s_val = str(url_val).strip()
        if s_val.startswith('http://') or s_val.startswith('https://'):
            return s_val
        if request:
            return request.build_absolute_uri(s_val)
        return s_val

    # Logo URL
    logo_url = ""
    if store.logo and hasattr(store.logo, 'url'):
        try:
            logo_url = get_absolute_url(store.logo.url)
        except Exception:
            logo_url = ""
    if not logo_url and store.logo_url:
        logo_url = get_absolute_url(store.logo_url)
    if not logo_url and vendor and vendor.logo_url:
        logo_url = get_absolute_url(vendor.logo_url)

    # Banner URL
    banner_url = ""
    if store.cover_banner and hasattr(store.cover_banner, 'url'):
        try:
            banner_url = get_absolute_url(store.cover_banner.url)
        except Exception:
            banner_url = ""
    if not banner_url and store.banner_url:
        banner_url = get_absolute_url(store.banner_url)
    if not banner_url and vendor and vendor.banner_url:
        banner_url = get_absolute_url(vendor.banner_url)

    # Gallery images
    gallery_qs = store.gallery_images.all().order_by('sort_order', 'created_at')[:MAX_GALLERY_IMAGES]
    gallery_list = []
    for g in gallery_qs:
        g_url = ""
        if g.image and hasattr(g.image, 'url'):
            try:
                g_url = get_absolute_url(g.image.url)
            except Exception:
                g_url = ""
        if not g_url and g.image_url:
            g_url = get_absolute_url(g.image_url)
        if g_url:
            gallery_list.append({
                'id': str(g.id),
                'url': g_url,
                'caption': g.caption or "",
                'sort_order': g.sort_order
            })

    # Verified status
    is_verified = bool(store.is_verified or (vendor and str(vendor.status).upper() == 'APPROVED'))

    opening_str = store.opening_time.strftime('%H:%M') if store.opening_time else ""
    closing_str = store.closing_time.strftime('%H:%M') if store.closing_time else ""

    return {
        'store_id': str(store.id),
        'slug': store.slug,
        'store_name': store.store_name or store.name or (vendor.business_name if vendor else ""),
        'short_description': store.short_description or store.description or (vendor.store_description if vendor else ""),
        'address': store.address or store.area_ward or "",
        'area_ward': store.area_ward or store.address or "",
        'max_local_delivery_km': float(store.max_local_delivery_km or 15.0),
        'opening_time': opening_str,
        'closing_time': closing_str,
        'logo_url': logo_url,
        'cover_banner_url': banner_url,
        'gallery_images': gallery_list,
        'gallery_count': len(gallery_list),
        'is_verified': is_verified,
        'verified': is_verified,
        'is_approved': is_verified,
        'status': 'APPROVED' if is_verified else (vendor.status if vendor else 'PENDING'),
        'contact_email': store.contact_email or (vendor.user.email if vendor and hasattr(vendor, 'user') else ""),
        'contact_phone': store.contact_phone or (getattr(vendor.user, 'phone_number', '') if vendor and hasattr(vendor, 'user') else ""),
        'created_at': store.created_at.isoformat() if store.created_at else "",
        'updated_at': store.updated_at.isoformat() if store.updated_at else ""
    }


def get_or_create_vendor_store(user) -> tuple[Store | None, str | None]:
    """Retrieves or creates the primary Store model for the authenticated vendor."""
    vendor = getattr(user, 'vendor_profile', None)
    if not vendor:
        return None, "No vendor profile found for this account."
    if str(vendor.status).upper() != 'APPROVED':
        return None, "Your vendor account is not approved yet."

    store = vendor.stores.filter(is_active=True).first() or vendor.stores.first()
    if not store:
        base_slug = slugify(vendor.business_name) or f"store-{str(vendor.id)[:8]}"
        slug = base_slug
        counter = 1
        while Store.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        store = Store.objects.create(
            vendor=vendor,
            name=vendor.business_name,
            store_name=vendor.business_name,
            slug=slug,
            description=vendor.store_description or f"Official storefront of {vendor.business_name}",
            short_description=(vendor.store_description or "")[:220],
            contact_email=getattr(user, 'email', ''),
            contact_phone=getattr(user, 'phone_number', ''),
            is_active=True,
            is_verified=True
        )
    return store, None


class SellerStoreProfileView(APIView):
    """
    Dedicated API endpoint for the Vendor Portal Store Profile Setup.
    GET: Returns authenticated vendor's store details, branding assets, and gallery images.
    PATCH: Updates store name, description, location, hours, logo, cover banner, and gallery.
    """
    authentication_classes = [JWTAuthentication, CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated, IsApprovedVendor]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(summary="Get Vendor Store Profile", responses={200: dict, 403: dict, 404: dict})
    def get(self, request):
        store, err = get_or_create_vendor_store(request.user)
        if err or not store:
            return Response({'success': False, 'detail': err or 'Store not found.'}, status=status.HTTP_403_FORBIDDEN)

        data = serialize_store_profile(store, request)
        return Response({'success': True, 'store': data}, status=status.HTTP_200_OK)

    @extend_schema(summary="Update Vendor Store Profile", responses={200: dict, 400: dict, 403: dict})
    def patch(self, request):
        store, err = get_or_create_vendor_store(request.user)
        if err or not store:
            return Response({'success': False, 'detail': err or 'Store not found.'}, status=status.HTTP_403_FORBIDDEN)

        vendor = store.vendor
        data = request.data or {}

        # 1. Validate Text Fields
        store_name = data.get('store_name') or data.get('name')
        short_description = data.get('short_description') or data.get('description')
        address = data.get('address') or data.get('area_ward')
        opening_time_val = data.get('opening_time')
        closing_time_val = data.get('closing_time')

        if short_description and len(str(short_description).strip()) > 220:
            return Response({
                'success': False,
                'detail': 'Short description exceeds maximum permitted length of 220 characters.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Validate Opening/Closing Hours
        opening_time = None
        closing_time = None
        if opening_time_val is not None:
            opening_time = parse_time_str(opening_time_val)
        if closing_time_val is not None:
            closing_time = parse_time_str(closing_time_val)

        # 3. Image validation helper
        def validate_image_file(f):
            if not f:
                return None
            if f.size > MAX_IMAGE_BYTES:
                return f"File '{f.name}' exceeds the 10 MB maximum upload size limit."
            content_start = f.read(16)
            f.seek(0)
            detected = detect_image_type(content_start)
            if not detected:
                return f"File '{f.name}' is not a valid JPEG, PNG, WebP, or GIF image."
            return None

        # Logo file validation
        logo_file = request.FILES.get('logo') or request.FILES.get('logo_file')
        if logo_file:
            err_msg = validate_image_file(logo_file)
            if err_msg:
                return Response({'success': False, 'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Cover banner file validation
        cover_file = request.FILES.get('cover_banner') or request.FILES.get('cover') or request.FILES.get('banner')
        if cover_file:
            err_msg = validate_image_file(cover_file)
            if err_msg:
                return Response({'success': False, 'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Gallery files & removals validation
        new_gallery_files = request.FILES.getlist('gallery_images') or request.FILES.getlist('gallery')
        for gf in new_gallery_files:
            err_msg = validate_image_file(gf)
            if err_msg:
                return Response({'success': False, 'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

        # Parse gallery removals
        remove_gallery_ids = set()
        raw_removals = []
        if hasattr(data, 'getlist'):
            raw_removals.extend(data.getlist('remove_gallery_images'))
            raw_removals.extend(data.getlist('remove_gallery_ids'))
        if not raw_removals:
            val = data.get('remove_gallery_images') or data.get('remove_gallery_ids')
            if isinstance(val, (list, tuple)):
                raw_removals.extend(val)
            elif isinstance(val, str):
                raw_removals.extend([x.strip() for x in val.split(',') if x.strip()])

        for p in raw_removals:
            if p:
                remove_gallery_ids.add(str(p).strip())

        existing_gallery_count = store.gallery_images.count()
        projected_count = existing_gallery_count - len(remove_gallery_ids) + len(new_gallery_files)
        if projected_count > MAX_GALLERY_IMAGES:
            return Response({
                'success': False,
                'detail': f'A maximum of {MAX_GALLERY_IMAGES} gallery images is permitted. (Total after upload would be {projected_count})'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Apply Updates Atomically
        with transaction.atomic():
            # Text updates
            if store_name is not None and str(store_name).strip():
                clean_name = str(store_name).strip()
                store.store_name = clean_name
                store.name = clean_name
                if vendor:
                    vendor.business_name = clean_name
                    vendor.save(update_fields=['business_name', 'updated_at'])

            if short_description is not None:
                clean_desc = str(short_description).strip()
                store.short_description = clean_desc
                store.description = clean_desc
                if vendor:
                    vendor.store_description = clean_desc
                    vendor.save(update_fields=['store_description', 'updated_at'])

            if address is not None:
                clean_addr = str(address).strip()
                store.address = clean_addr
                store.area_ward = clean_addr

            if opening_time_val is not None:
                store.opening_time = opening_time
            if closing_time_val is not None:
                store.closing_time = closing_time

            max_delivery_val = data.get('max_local_delivery_km')
            if max_delivery_val is not None:
                try:
                    store.max_local_delivery_km = max(0.5, float(max_delivery_val))
                except (ValueError, TypeError):
                    pass

            # Logo handling
            remove_logo = str(data.get('remove_logo', '')).lower() in ('true', '1', 'yes')
            if remove_logo:
                store.logo = None
                store.logo_url = ""
                if vendor:
                    vendor.logo_url = ""
                    vendor.save(update_fields=['logo_url', 'updated_at'])
            elif logo_file:
                store.logo = logo_file
                store.save()
                if hasattr(store.logo, 'url'):
                    store.logo_url = store.logo.url
                    if vendor:
                        vendor.logo_url = store.logo.url
                        vendor.save(update_fields=['logo_url', 'updated_at'])

            # Cover banner handling
            remove_cover = str(data.get('remove_cover_banner', data.get('remove_cover', ''))).lower() in ('true', '1', 'yes')
            if remove_cover:
                store.cover_banner = None
                store.banner_url = ""
                if vendor:
                    vendor.banner_url = ""
                    vendor.save(update_fields=['banner_url', 'updated_at'])
            elif cover_file:
                store.cover_banner = cover_file
                store.save()
                if hasattr(store.cover_banner, 'url'):
                    store.banner_url = store.cover_banner.url
                    if vendor:
                        vendor.banner_url = store.cover_banner.url
                        vendor.save(update_fields=['banner_url', 'updated_at'])

            store.save()

            # Gallery removals
            if remove_gallery_ids:
                store.gallery_images.filter(id__in=remove_gallery_ids).delete()

            # Gallery additions
            for idx, gf in enumerate(new_gallery_files):
                g_obj = StoreGalleryImage.objects.create(
                    store=store,
                    image=gf,
                    sort_order=store.gallery_images.count() + idx
                )
                if hasattr(g_obj.image, 'url'):
                    g_obj.image_url = g_obj.image.url
                    g_obj.save(update_fields=['image_url'])

        # Return full updated payload immediately with absolute URLs
        updated_data = serialize_store_profile(store, request)
        return Response({
            'success': True,
            'message': 'Store profile updated successfully.',
            'store': updated_data
        }, status=status.HTTP_200_OK)
