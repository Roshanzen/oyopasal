from django.db.models import Q, Count
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from drf_spectacular.utils import extend_schema

from apps.vendors.models import (
    SellerApplication,
    SellerApplicationStatus,
)
from apps.vendors.application_serializers import (
    SellerApplicationCreateSerializer,
    SellerApplicationTrackSerializer,
    SellerApplicationListSerializer,
    SellerApplicationDetailSerializer,
    AdminApplicationStatusUpdateSerializer,
    VendorActivationSubmitSerializer,
)
from apps.vendors.application_services import (
    create_seller_application,
    track_seller_application,
    admin_update_status,
    admin_approve_and_invite,
    admin_resend_invitation,
    verify_invitation_token,
    activate_vendor_account,
)


class IsAdminUserOrStaff(permissions.BasePermission):
    """Allows access only to Super Admins, Operations Admins, or platform Staff."""
    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or user.is_staff:
            return True
        return getattr(user, 'role', '') in ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN']


class SellerApplicationPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100


class SellerApplicationApplyView(APIView):
    """Public endpoint for submitting a merchant partner onboarding application."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Submit Seller Application",
        description="Public registration form for aspiring merchants to apply to sell on OyoPasal.",
        request=SellerApplicationCreateSerializer,
        responses={201: dict}
    )
    def post(self, request):
        serializer = SellerApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        application = create_seller_application(serializer.validated_data, applicant_user=user)

        return Response({
            'success': True,
            'message': 'Your seller application has been submitted successfully and is awaiting review.',
            'application_number': application.application_number,
            'status': application.status,
            'data': {
                'application_number': application.application_number,
                'business_name': application.business_name,
                'email': application.email,
                'status': application.status,
                'created_at': application.created_at,
            }
        }, status=status.HTTP_201_CREATED)


class SellerApplicationTrackView(APIView):
    """Secure endpoint for checking application status using reference number and email."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Track Seller Application Status",
        request=SellerApplicationTrackSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = SellerApplicationTrackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        info = track_seller_application(
            application_number=serializer.validated_data['application_number'],
            email=serializer.validated_data['email']
        )
        return Response({
            'success': True,
            'data': info
        }, status=status.HTTP_200_OK)


class AdminSellerApplicationListView(APIView):
    """Admin-only listing and overview stats for seller onboarding applications."""
    permission_classes = [IsAdminUserOrStaff]
    pagination_class = SellerApplicationPagination

    def get(self, request):
        qs = SellerApplication.objects.all().order_by('-created_at')

        # Global summary metrics for dashboard cards
        counts = SellerApplication.objects.aggregate(
            total=Count('id'),
            pending=Count('id', filter=Q(status=SellerApplicationStatus.PENDING)),
            under_review=Count('id', filter=Q(status=SellerApplicationStatus.UNDER_REVIEW)),
            approved=Count('id', filter=Q(status=SellerApplicationStatus.APPROVED)),
            invitation_sent=Count('id', filter=Q(status=SellerApplicationStatus.INVITATION_SENT)),
            active=Count('id', filter=Q(status=SellerApplicationStatus.ACTIVE)),
            rejected=Count('id', filter=Q(status=SellerApplicationStatus.REJECTED)),
        )

        # Filters
        status_filter = request.query_params.get('status')
        if status_filter and status_filter.upper() != 'ALL':
            qs = qs.filter(status=status_filter.upper())

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(application_number__icontains=search) |
                Q(business_name__icontains=search) |
                Q(full_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(pan_vat_number__icontains=search)
            )

        category = request.query_params.get('category')
        if category:
            qs = qs.filter(business_category__iexact=category)

        province = request.query_params.get('province')
        if province:
            qs = qs.filter(province__iexact=province)

        paginator = self.pagination_class()
        paginated_qs = paginator.paginate_queryset(qs, request)
        serializer = SellerApplicationListSerializer(paginated_qs, many=True)

        return paginator.get_paginated_response({
            'summary': counts,
            'applications': serializer.data
        })


class AdminSellerApplicationDetailView(APIView):
    """Admin-only retrieval of full application data, submitted documents, and audit logs."""
    permission_classes = [IsAdminUserOrStaff]

    def get(self, request, pk):
        from apps.common.utils import is_valid_uuid
        if is_valid_uuid(pk):
            app = SellerApplication.objects.filter(id=pk).first()
        else:
            app = SellerApplication.objects.filter(application_number__iexact=str(pk)).first()

        if not app:
            return Response({'detail': 'Seller application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SellerApplicationDetailSerializer(app)
        return Response({
            'success': True,
            'application': serializer.data
        })


class AdminSellerApplicationStatusView(APIView):
    """Admin action to transition status (e.g. Move to Under Review, Request Info)."""
    permission_classes = [IsAdminUserOrStaff]

    def post(self, request, pk):
        from apps.common.utils import is_valid_uuid
        app = SellerApplication.objects.filter(id=pk).first() if is_valid_uuid(pk) else SellerApplication.objects.filter(application_number__iexact=str(pk)).first()
        if not app:
            return Response({'detail': 'Seller application not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminApplicationStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_status = serializer.validated_data.get('status') or app.status
        updated_app = admin_update_status(
            application=app,
            new_status=target_status,
            admin_user=request.user,
            notes=serializer.validated_data.get('notes', ''),
            rejection_reason=serializer.validated_data.get('rejection_reason', ''),
            additional_info=serializer.validated_data.get('additional_info', ''),
        )

        return Response({
            'success': True,
            'message': f"Application status updated to {updated_app.status}.",
            'status': updated_app.status
        })


class AdminSellerApplicationApproveView(APIView):
    """Admin approval: creates/links vendor profile, issues single-use activation invitation, sends email."""
    permission_classes = [IsAdminUserOrStaff]

    def post(self, request, pk):
        from apps.common.utils import is_valid_uuid
        app = SellerApplication.objects.filter(id=pk).first() if is_valid_uuid(pk) else SellerApplication.objects.filter(application_number__iexact=str(pk)).first()
        if not app:
            return Response({'detail': 'Seller application not found.'}, status=status.HTTP_404_NOT_FOUND)

        frontend_url = request.data.get('frontend_url') or request.META.get('HTTP_ORIGIN') or 'http://127.0.0.1:3000'
        res = admin_approve_and_invite(application=app, admin_user=request.user, frontend_base_url=frontend_url)
        return Response(res, status=status.HTTP_200_OK)


class AdminSellerApplicationRejectView(APIView):
    """Admin rejection: sets status to REJECTED with mandatory reason, notifies applicant."""
    permission_classes = [IsAdminUserOrStaff]

    def post(self, request, pk):
        from apps.common.utils import is_valid_uuid
        app = SellerApplication.objects.filter(id=pk).first() if is_valid_uuid(pk) else SellerApplication.objects.filter(application_number__iexact=str(pk)).first()
        if not app:
            return Response({'detail': 'Seller application not found.'}, status=status.HTTP_404_NOT_FOUND)

        rejection_reason = request.data.get('rejection_reason', '').strip()
        if not rejection_reason:
            return Response({'rejection_reason': 'A rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        updated_app = admin_update_status(
            application=app,
            new_status=SellerApplicationStatus.REJECTED,
            admin_user=request.user,
            notes=request.data.get('notes', ''),
            rejection_reason=rejection_reason
        )

        return Response({
            'success': True,
            'message': f"Application {app.application_number} has been rejected.",
            'status': updated_app.status
        })


class AdminSellerApplicationResendInviteView(APIView):
    """Resend a fresh single-use activation token to an approved applicant."""
    permission_classes = [IsAdminUserOrStaff]

    def post(self, request, pk):
        from apps.common.utils import is_valid_uuid
        app = SellerApplication.objects.filter(id=pk).first() if is_valid_uuid(pk) else SellerApplication.objects.filter(application_number__iexact=str(pk)).first()
        if not app:
            return Response({'detail': 'Seller application not found.'}, status=status.HTTP_404_NOT_FOUND)

        frontend_url = request.data.get('frontend_url') or request.META.get('HTTP_ORIGIN') or 'http://127.0.0.1:3000'
        res = admin_resend_invitation(application=app, admin_user=request.user, frontend_base_url=frontend_url)
        return Response(res, status=status.HTTP_200_OK)


class VendorActivationVerifyView(APIView):
    """Validates an invitation token before displaying the password creation form."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        data = verify_invitation_token(token)
        return Response({
            'success': True,
            'data': data
        })


class VendorActivationSubmitView(APIView):
    """Consumes invitation token, sets vendor password, and activates merchant store."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VendorActivationSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        res = activate_vendor_account(
            token=serializer.validated_data['token'],
            password=serializer.validated_data['password']
        )
        return Response(res, status=status.HTTP_200_OK)
