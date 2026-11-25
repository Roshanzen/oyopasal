from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsSuperAdmin
from .models import SubscriptionPlan, TenantSubscription, SubscriptionInvoice
from .services import SubscriptionService
from .serializers import (
    SubscriptionPlanSerializer,
    TenantSubscriptionSerializer,
    SubscriptionInvoiceSerializer,
    SubscribeRequestSerializer,
    TenantUsageResponseSerializer,
)

class PublicSubscriptionPlansView(generics.ListAPIView):
    """
    Public catalog of available subscription plans with feature tiers and pricing.
    """
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by('price_monthly')


class TenantCurrentSubscriptionView(APIView):
    """
    Returns current active subscription status and resource usage quotas (products, stores, features).
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Subscriptions: Current Tenant Quotas & Limits",
        description="Live status of subscription, days remaining, and resource limit headroom.",
        responses={200: TenantUsageResponseSerializer}
    )
    def get(self, request, *args, **kwargs):
        user = request.user
        tenant = getattr(user, 'vendor_profile', None)
        if not tenant:
            return Response({'detail': 'Only vendors have subscription accounts.'}, status=status.HTTP_400_BAD_REQUEST)

        usage = SubscriptionService.get_tenant_limits_usage(tenant)
        serializer = TenantUsageResponseSerializer(usage)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SubscribeOrUpgradeView(APIView):
    """
    Subscribe or upgrade to a new tier (e.g. Basic, Pro, Enterprise).
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Subscriptions: Subscribe or Upgrade Plan",
        request=SubscribeRequestSerializer,
        responses={200: TenantSubscriptionSerializer}
    )
    def post(self, request, *args, **kwargs):
        user = request.user
        tenant = getattr(user, 'vendor_profile', None)
        if not tenant:
            return Response({'detail': 'Only vendors can subscribe to plans.'}, status=status.HTTP_400_BAD_REQUEST)

        req_serializer = SubscribeRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        data = req_serializer.validated_data

        try:
            plan = SubscriptionPlan.objects.get(slug=data['plan_slug'], is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Requested subscription plan is not available.'}, status=status.HTTP_404_NOT_FOUND)

        subscription = SubscriptionService.subscribe_or_upgrade(
            tenant=tenant,
            plan=plan,
            billing_interval=data['billing_interval'],
            payment_method=data['payment_method']
        )
        serializer = TenantSubscriptionSerializer(subscription)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CancelSubscriptionView(APIView):
    """
    Disables auto-renewal at period end.
    """
    serializer_class = TenantSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Subscriptions: Cancel Auto-Renewal",
        request=None,
        responses={200: TenantSubscriptionSerializer}
    )
    def post(self, request, *args, **kwargs):
        user = request.user
        tenant = getattr(user, 'vendor_profile', None) or getattr(user, 'supplier_profile', None)
        if not tenant or not hasattr(tenant, 'subscription'):
            return Response({'detail': 'Active subscription not found.'}, status=status.HTTP_404_NOT_FOUND)

        sub = SubscriptionService.cancel_subscription(tenant.subscription, immediate=False)
        serializer = TenantSubscriptionSerializer(sub)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SubscriptionInvoicesListView(generics.ListAPIView):
    """
    Lists past billing invoices and receipts for the authenticated vendor or supplier.
    """
    serializer_class = SubscriptionInvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SubscriptionInvoice.objects.none()
        user = self.request.user
        tenant = getattr(user, 'vendor_profile', None) or getattr(user, 'supplier_profile', None)
        if not tenant or not hasattr(tenant, 'subscription'):
            return SubscriptionInvoice.objects.none()
        return SubscriptionInvoice.objects.filter(subscription=tenant.subscription)


class AdminSubscriptionPlansView(generics.ListCreateAPIView):
    """
    Super Admin endpoint to configure plans, monthly/annual fees, and resource quotas.
    """
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    queryset = SubscriptionPlan.objects.all().order_by('price_monthly')

