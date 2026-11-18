from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics, viewsets, filters
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes, OpenApiResponse
from apps.common.permissions import IsVendor
from .models import VendorProfile, VendorDocument, VendorStatus
from .services import VendorDashboardService
from .serializers import (
    VendorProfileSerializer,
    PublicVendorSerializer,
    VendorDocumentSerializer,
    VendorDashboardOverviewResponseSerializer,
    VendorSalesTrendItemSerializer,
    VendorTopProductItemSerializer,
    VendorKYCVerificationSerializer,
)

class PublicVendorListView(generics.ListAPIView):
    """
    Public marketplace vendor discovery list.
    """
    queryset = VendorProfile.objects.filter(status=VendorStatus.APPROVED).order_by('-created_at')
    serializer_class = PublicVendorSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['business_name', 'store_description', 'business_category']
    ordering_fields = ['business_name', 'created_at']


class VendorProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the authenticated vendor's business profile and bank settlement settings.
    """
    serializer_class = VendorProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    def get_object(self):
        return self.request.user.vendor_profile


class VendorDocumentUploadView(generics.ListCreateAPIView):
    """
    Upload and list compliance/KYC verification documents (PAN, Citizenship, Company Registration).
    """
    serializer_class = VendorDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VendorDocument.objects.none()
        return VendorDocument.objects.filter(vendor=self.request.user.vendor_profile)

    def perform_create(self, serializer):
        serializer.save(vendor=self.request.user.vendor_profile)


class VendorDashboardOverviewView(APIView):
    """
    Merchant control panel overview metrics: sales, orders pipeline, product inventory health, and settlements.
    """
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(
        summary="Vendor: Dashboard Overview KPIs",
        description="Consolidates sales, order processing states, inventory levels, and settlement figures for the merchant.",
        responses={200: VendorDashboardOverviewResponseSerializer}
    )
    def get(self, request, *args, **kwargs):
        vendor = request.user.vendor_profile
        data = VendorDashboardService.get_overview_metrics(vendor)
        serializer = VendorDashboardOverviewResponseSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class VendorSalesTrendsView(APIView):
    """
    Vendor timeseries performance over the past N days.
    """
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(
        summary="Vendor: Sales Trends Timeseries",
        description="Daily sales, earnings, and order volume breakdown for charting.",
        parameters=[
            OpenApiParameter('days', OpenApiTypes.INT, description="Number of days to look back (default 30)", required=False)
        ],
        responses={200: VendorSalesTrendItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        try:
            days = int(request.query_params.get('days', 30))
        except (ValueError, TypeError):
            days = 30
        vendor = request.user.vendor_profile
        data = VendorDashboardService.get_sales_trends(vendor=vendor, days=days)
        serializer = VendorSalesTrendItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class VendorTopProductsView(APIView):
    """
    Vendor's top-selling catalog items ranked by units ordered.
    """
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(
        summary="Vendor: Top Selling Products",
        description="Best-performing products by units sold for this merchant.",
        parameters=[
            OpenApiParameter('limit', OpenApiTypes.INT, description="Maximum items (default 5)", required=False)
        ],
        responses={200: VendorTopProductItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        try:
            limit = int(request.query_params.get('limit', 5))
        except (ValueError, TypeError):
            limit = 5
        vendor = request.user.vendor_profile
        data = VendorDashboardService.get_top_selling_products(vendor=vendor, limit=limit)
        serializer = VendorTopProductItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminVendorKYCListView(generics.ListAPIView):
    """
    List vendors with KYC documents for administrative review.
    """
    serializer_class = VendorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VendorProfile.objects.none()
        from apps.accounts.models import UserRole
        if self.request.user.role not in [UserRole.SUPER_ADMIN, UserRole.OPERATIONS_ADMIN]:
            return VendorProfile.objects.none()
        status_filter = self.request.query_params.get('status', 'PENDING')
        return VendorProfile.objects.filter(status=status_filter).prefetch_related('documents')


class AdminVendorVerifyView(APIView):
    """
    Super Admin endpoint to approve or reject a vendor's KYC registration.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Admin: Verify Vendor KYC",
        description="Approves or rejects a vendor organization with audit log creation.",
        request=VendorKYCVerificationSerializer,
        responses={200: OpenApiResponse(description="KYC verification status updated")}
    )
    def post(self, request, pk, *args, **kwargs):
        from apps.accounts.models import UserRole
        from apps.audit.services import AuditService
        from apps.audit.models import AuditAction

        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.OPERATIONS_ADMIN]:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            vendor = VendorProfile.objects.get(id=pk)
        except VendorProfile.DoesNotExist:
            return Response({'error': 'Vendor not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = VendorKYCVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        rejection_reason = serializer.validated_data.get('rejection_reason', '')

        old_status = vendor.status
        vendor.status = new_status
        vendor.rejection_reason = rejection_reason
        vendor.save()

        # Update documents verified flag if approved
        if new_status == 'APPROVED':
            from django.utils import timezone
            vendor.documents.all().update(is_verified=True, verified_at=timezone.now())

        AuditService.log(
            action=AuditAction.KYC_VERIFICATION,
            target_model='VendorProfile',
            user=request.user,
            target_id=str(vendor.id),
            description=f"Vendor {vendor.business_name} status changed from {old_status} to {new_status}. Reason: {rejection_reason}",
            delta_changes={'old_status': old_status, 'new_status': new_status, 'rejection_reason': rejection_reason},
            request=request
        )

        return Response({
            'success': True,
            'message': f"Vendor {vendor.business_name} successfully updated to {new_status}."
        }, status=status.HTTP_200_OK)


class VendorStaffViewSet(viewsets.ModelViewSet):
    """
    Manage staff accounts and assign permissions for the authenticated vendor's organization.
    """
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    def get_serializer_class(self):
        from .serializers import VendorStaffMemberSerializer
        return VendorStaffMemberSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            from apps.vendors.models import VendorStaffMember
            return VendorStaffMember.objects.none()
        from apps.vendors.models import VendorStaffMember
        return VendorStaffMember.objects.filter(vendor=self.request.user.vendor_profile).select_related('user')

    def perform_create(self, serializer):
        serializer.save(vendor=self.request.user.vendor_profile)


class PublicVendorRegisterView(APIView):
    """
    Public self-service vendor registration for prospective merchants.
    Creates or links the merchant user, registers VendorProfile and creates initial Store.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        store_name = request.data.get('store_name', '').strip()
        contact_person = request.data.get('contact_person', '').strip()
        phone = request.data.get('phone', '').strip()
        email = request.data.get('email', '').strip()
        area = request.data.get('area', '').strip()
        city = request.data.get('city', 'Kathmandu').strip()
        category = request.data.get('category', 'General').strip()

        if not store_name or not phone or not contact_person:
            return Response({
                'success': False,
                'message': 'Store name, contact person, and phone number are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        from apps.accounts.models import User, UserRole
        from apps.vendors.models import VendorProfile, VendorStatus
        from apps.stores.models import Store
        from django.utils.text import slugify
        from apps.accounts.serializers import normalize_phone_number

        cleaned_phone = normalize_phone_number(phone) or phone
        email_val = email or f"vendor_{cleaned_phone}@oyopasal.com"

        with transaction.atomic():
            user = User.objects.filter(email__iexact=email_val).first()
            if not user and cleaned_phone:
                user = User.objects.filter(phone_number=cleaned_phone).first()

            if not user:
                first_name = contact_person.split(' ')[0]
                last_name = ' '.join(contact_person.split(' ')[1:]) or 'Owner'
                user = User.objects.create_user(
                    email=email_val,
                    phone_number=cleaned_phone,
                    role=UserRole.VENDOR_OWNER,
                    first_name=first_name,
                    last_name=last_name,
                    password='SecurePassword123!'
                )
            else:
                if user.role not in [UserRole.VENDOR_OWNER, UserRole.SUPER_ADMIN]:
                    user.role = UserRole.VENDOR_OWNER
                    user.save(update_fields=['role'])

            base_slug = slugify(store_name) or f"store-{str(user.id)[:8]}"
            slug = base_slug
            c = 1
            while VendorProfile.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{c}"
                c += 1

            vendor_profile, created = VendorProfile.objects.get_or_create(
                user=user,
                defaults={
                    'business_name': store_name,
                    'slug': slug,
                    'business_category': category,
                    'status': VendorStatus.APPROVED,
                    'store_description': f"{store_name} located in {area}, {city}"
                }
            )

            store, _ = Store.objects.get_or_create(
                vendor=vendor_profile,
                defaults={
                    'name': store_name,
                    'slug': slug,
                    'address': f"{area}, {city}",
                    'contact_phone': phone,
                    'contact_email': email_val,
                    'is_active': True,
                    'description': f"Official store of {store_name}"
                }
            )

        return Response({
            'success': True,
            'message': 'Vendor application submitted and store provisioned successfully.',
            'vendor': {
                'id': str(vendor_profile.id),
                'name': vendor_profile.business_name,
                'slug': vendor_profile.slug,
                'status': vendor_profile.status,
                'area': f"{area}, {city}",
                'rating': 4.8,
                'delivery_time_mins': '15-25 mins',
                'is_online': True
            }
        }, status=status.HTTP_201_CREATED)


