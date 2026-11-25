from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.cart.models import Cart, CartItem
from apps.cart.serializers import (
    CartSerializer,
    AddToCartSerializer,
    UpdateCartItemSerializer,
    CartItemSerializer
)

def get_empty_cart():
    base = {
        'items': [],
        'item_count': 0,
        'total_items': 0,
        'vendor_count': 0,
        'grouped_by_vendor': [],
        'vendor_groups': [],
        'subtotal': '0.00',
        'delivery_fee': 0.0,
        'free_delivery_threshold': 499.0,
        'amount_needed_for_free_delivery': 499.0,
        'handling_fee': 0.0,
        'coupon': None,
        'total': 0.0
    }
    ret = dict(base)
    ret['data'] = dict(base)
    return ret

def get_or_create_cart(request):
    import re
    import uuid
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if getattr(request, 'user', None) and request.user.is_authenticated:
        user_cart, _ = Cart.objects.get_or_create(user=request.user)
        # Check if guest session needs to be merged into user cart
        session_key = getattr(request, '_guest_session_key', None)
        if not session_key and hasattr(request, 'headers') and request.headers:
            session_key = request.headers.get('X-Session-Key')
        if not session_key and hasattr(request, 'META') and request.META:
            session_key = request.META.get('HTTP_X_SESSION_KEY')
        if session_key:
            clean_key = re.sub(r'[^a-zA-Z0-9_-]', '', session_key)[:40]
            if clean_key:
                guest_email = f"guest_{clean_key}@guest.oyopasal.local"
                guest_user = User.objects.filter(email=guest_email).first()
                if guest_user and hasattr(guest_user, 'cart'):
                    guest_cart = guest_user.cart
                    for g_item in guest_cart.items.all():
                        u_item, created = CartItem.objects.get_or_create(
                            cart=user_cart,
                            variant=g_item.variant,
                            defaults={'quantity': g_item.quantity}
                        )
                        if not created:
                            u_item.quantity += g_item.quantity
                            u_item.save(update_fields=['quantity', 'updated_at'])
                    guest_cart.items.all().delete()
        return user_cart

    # Isolate guest sessions: derive unique guest identity from X-Session-Key header or session
    session_key = getattr(request, '_guest_session_key', None)
    if not session_key and hasattr(request, 'headers') and request.headers:
        session_key = request.headers.get('X-Session-Key')
    if not session_key and hasattr(request, 'META') and request.META:
        session_key = request.META.get('HTTP_X_SESSION_KEY')
    if not session_key and hasattr(request, 'session') and request.session:
        session_key = request.session.session_key
        if not session_key:
            try:
                request.session.create()
                session_key = request.session.session_key
            except Exception:
                pass

    if not session_key:
        session_key = f"guest-{uuid.uuid4().hex[:16]}"
        setattr(request, '_guest_session_key', session_key)
    else:
        setattr(request, '_guest_session_key', session_key)

    clean_key = re.sub(r'[^a-zA-Z0-9_-]', '', session_key)[:40]
    guest_email = f"guest_{clean_key}@guest.oyopasal.local"
    guest_user, _ = User.objects.get_or_create(
        email=guest_email,
        defaults={
            'role': 'CUSTOMER',
            'first_name': 'Guest',
            'last_name': clean_key[:8],
            'is_active': True
        }
    )
    cart, _ = Cart.objects.get_or_create(user=guest_user)
    return cart

class CartView(APIView):
    """View, add to, or clear active customer cart."""
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            session_key = request.headers.get('X-Session-Key')
            if not session_key:
                return Response(get_empty_cart())
        cart = get_or_create_cart(request)
        if not cart.items.exists():
            return Response(get_empty_cart())
        c_data = CartSerializer(cart).data
        res = dict(c_data)
        res['data'] = dict(c_data)
        return Response(res)

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart = get_or_create_cart(request)
        variant = serializer.validated_data['variant']
        quantity = serializer.validated_data['quantity']

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            variant=variant,
            defaults={'quantity': quantity}
        )
        if not created:
            item.quantity += quantity
            item.save(update_fields=['quantity', 'updated_at'])

        c_data = CartSerializer(cart).data
        res = dict(c_data)
        res['data'] = c_data
        return Response(res, status=status.HTTP_200_OK)

    def delete(self, request):
        cart = get_or_create_cart(request)
        cart.items.all().delete()
        return Response(CartSerializer(cart).data)


class CartItemDetailView(APIView):
    """Update item quantity or remove item from cart."""
    permission_classes = [AllowAny]

    def put(self, request, id):
        return self._update_item(request, id)

    def patch(self, request, id):
        return self._update_item(request, id)

    def _update_item(self, request, id):
        cart = get_or_create_cart(request)
        item = CartItem.objects.filter(cart=cart, id=id).first()
        if not item:
            return Response({
                'success': False,
                'message': 'Cart item not found in your active cart.'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            quantity = int(request.data.get('quantity', 1))
        except (ValueError, TypeError):
            return Response({
                'success': False,
                'message': 'Quantity must be a valid integer.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            item.delete()
        else:
            # Validate inventory availability
            from apps.inventory.models import InventoryItem
            total_stock = sum(
                inv.quantity_available for inv in InventoryItem.objects.filter(variant=item.variant)
            )
            if total_stock < quantity:
                return Response({
                    'success': False,
                    'message': f"Cannot set quantity to {quantity}. Only {total_stock} available in stock."
                }, status=status.HTTP_400_BAD_REQUEST)

            item.quantity = quantity
            item.save(update_fields=['quantity', 'updated_at'])

        return Response(CartSerializer(cart).data)

    def delete(self, request, id):
        cart = get_or_create_cart(request)
        item = CartItem.objects.filter(cart=cart, id=id).first()
        if not item:
            return Response({
                'success': False,
                'message': 'Cart item not found in your active cart.'
            }, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response(CartSerializer(cart).data)


class CartClearView(APIView):
    """Clear all items from active cart."""
    permission_classes = [AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        cart.items.all().delete()
        return Response(CartSerializer(cart).data)


class ValidateCheckoutView(APIView):
    """
    Authoritative checkout validation verifying stock availability,
    recalculating delivery fees and subtotal.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        if not cart.items.exists():
            return Response({
                'valid': False,
                'message': 'Your basket is empty. Please add items before checking out.',
                'authoritative_cart': get_empty_cart()
            }, status=status.HTTP_400_BAD_REQUEST)

        from apps.inventory.models import InventoryItem
        for item in cart.items.select_related('variant', 'variant__product').all():
            variant = item.variant
            if not variant or not variant.is_active or not getattr(variant, 'product', None) or variant.product.status != 'APPROVED':
                return Response({
                    'valid': False,
                    'message': f"Item '{getattr(item, 'product_name', 'Product')}' is no longer available.",
                    'authoritative_cart': CartSerializer(cart).data
                }, status=status.HTTP_400_BAD_REQUEST)

            avail_stock = sum(inv.quantity_available for inv in InventoryItem.objects.filter(variant=variant))
            if avail_stock < item.quantity:
                return Response({
                    'valid': False,
                    'message': f"Insufficient stock for '{variant.product.name}'. Requested: {item.quantity}, Available: {avail_stock}.",
                    'authoritative_cart': CartSerializer(cart).data
                }, status=status.HTTP_400_BAD_REQUEST)

        # Express Delivery Zone Radius Validation
        data = request.data or {}
        deliv_opt = data.get('delivery_option') or data.get('deliveryOption')
        if (deliv_opt or '').upper() in ['EXPRESS', 'EXPRESS_12_MINS', 'INSTANT']:
            cust_lat = data.get('latitude') or data.get('lat')
            cust_lng = data.get('longitude') or data.get('lng')
            if not cust_lat or not cust_lng:
                addr_dict = data.get('shipping_address') or data.get('delivery_address') or {}
                cust_lat = addr_dict.get('latitude') or addr_dict.get('lat')
                cust_lng = addr_dict.get('longitude') or addr_dict.get('lng')
            if not cust_lat and data.get('address_id'):
                try:
                    from apps.customers.models import Address
                    addr_obj = Address.objects.filter(id=data.get('address_id')).first()
                    if addr_obj and addr_obj.latitude is not None and addr_obj.longitude is not None:
                        cust_lat = float(addr_obj.latitude)
                        cust_lng = float(addr_obj.longitude)
                except Exception:
                    pass

            if cust_lat is not None and cust_lng is not None:
                from apps.delivery.views import haversine_km
                for item in cart.items.select_related('variant__product__vendor', 'variant__product__store').all():
                    prod = getattr(item.variant, 'product', None)
                    if prod:
                        store = getattr(prod, 'store', None)
                        vendor = getattr(prod, 'vendor', None)
                        store_lat = float(store.latitude) if (store and getattr(store, 'latitude', None) is not None) else (
                            float(vendor.latitude) if (vendor and getattr(vendor, 'latitude', None) is not None) else None
                        )
                        store_lng = float(store.longitude) if (store and getattr(store, 'longitude', None) is not None) else (
                            float(vendor.longitude) if (vendor and getattr(vendor, 'longitude', None) is not None) else None
                        )
                        if store_lat is not None and store_lng is not None:
                            dist_km = haversine_km(store_lat, store_lng, cust_lat, cust_lng)
                            max_rad = float(store.max_local_delivery_km) if (store and getattr(store, 'max_local_delivery_km', None) is not None) else 15.0
                            if dist_km > max_rad:
                                return Response({
                                    'valid': False,
                                    'is_outside_express_zone': True,
                                    'max_local_delivery_km': max_rad,
                                    'distance_km': dist_km,
                                    'message': f"Outside {max_rad:g} km Express Zone ({dist_km:.1f} km away) — Available via Intercity Standard Delivery (1–2 Days)",
                                    'authoritative_cart': CartSerializer(cart).data
                                }, status=status.HTTP_400_BAD_REQUEST)

        cart_data = CartSerializer(cart).data
        return Response({
            'valid': True,
            'message': 'Checkout cart validated successfully.',
            'authoritative_cart': cart_data
        }, status=status.HTTP_200_OK)



