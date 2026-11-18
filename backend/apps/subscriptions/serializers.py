from rest_framework import serializers
from .models import SubscriptionPlan, TenantSubscription, SubscriptionInvoice

class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = (
            'id', 'name', 'slug', 'tier', 'description', 'price_monthly', 'price_annually',
            'trial_days', 'max_products', 'max_stores', 'max_staff_accounts',
            'max_monthly_orders', 'has_advanced_inventory', 'has_custom_domain',
            'has_analytics_reports', 'has_api_access', 'has_priority_support', 'is_active'
        )
        read_only_fields = ('id', 'slug')


class SubscriptionInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionInvoice
        fields = (
            'id', 'invoice_number', 'amount', 'tax_amount', 'grand_total',
            'billing_date', 'due_date', 'paid_at', 'payment_method',
            'payment_status', 'transaction_reference'
        )
        read_only_fields = ('id', 'invoice_number', 'paid_at')


class TenantSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    invoices = SubscriptionInvoiceSerializer(many=True, read_only=True)

    class Meta:
        model = TenantSubscription
        fields = (
            'id', 'plan', 'billing_interval', 'status', 'current_period_start',
            'current_period_end', 'trial_ends_at', 'grace_period_ends_at',
            'auto_renew', 'cancelled_at', 'invoices', 'created_at'
        )
        read_only_fields = ('id', 'status', 'created_at')


class SubscribeRequestSerializer(serializers.Serializer):
    plan_slug = serializers.SlugField()
    billing_interval = serializers.ChoiceField(choices=['MONTHLY', 'ANNUAL'], default='MONTHLY')
    payment_method = serializers.CharField(default='ESEWA')


class TenantLimitsDetailSerializer(serializers.Serializer):
    max_products = serializers.IntegerField()
    current_products = serializers.IntegerField()
    can_create_product = serializers.BooleanField()
    max_stores = serializers.IntegerField()
    current_stores = serializers.IntegerField()
    can_create_store = serializers.BooleanField()
    has_advanced_inventory = serializers.BooleanField()
    has_analytics_reports = serializers.BooleanField()
    has_api_access = serializers.BooleanField()


class TenantUsageResponseSerializer(serializers.Serializer):
    plan_name = serializers.CharField()
    is_valid_subscription = serializers.BooleanField()
    status = serializers.CharField()
    expires_at = serializers.CharField(allow_null=True)
    limits = TenantLimitsDetailSerializer()

