import uuid
from django.db import models
from django.utils import timezone
from apps.common.models import BaseModel, SoftDeletableModel
from apps.vendors.models import VendorProfile

class SubscriptionTier(models.TextChoices):
    FREE_TRIAL = 'FREE_TRIAL', 'Free Trial'
    BASIC = 'BASIC', 'Basic Starter'
    PROFESSIONAL = 'PROFESSIONAL', 'Professional Growth'
    ENTERPRISE = 'ENTERPRISE', 'Enterprise Scale'


class BillingInterval(models.TextChoices):
    MONTHLY = 'MONTHLY', 'Monthly'
    ANNUAL = 'ANNUAL', 'Annual'


class SubscriptionStatus(models.TextChoices):
    TRIALING = 'TRIALING', 'In Free Trial'
    ACTIVE = 'ACTIVE', 'Active Subscription'
    GRACE_PERIOD = 'GRACE_PERIOD', 'In Grace Period'
    PAST_DUE = 'PAST_DUE', 'Payment Past Due'
    CANCELLED = 'CANCELLED', 'Cancelled'
    EXPIRED = 'EXPIRED', 'Expired & Inactive'


class SubscriptionPlan(BaseModel, SoftDeletableModel):
    """
    Super Admin configurable SaaS subscription plan with multi-tenant limits and feature flags.
    """
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    tier = models.CharField(
        max_length=30,
        choices=SubscriptionTier.choices,
        default=SubscriptionTier.BASIC,
        db_index=True
    )
    description = models.TextField(blank=True)
    
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    price_annually = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    trial_days = models.PositiveIntegerField(default=14, help_text='Trial duration in days')

    # Hard Multi-Tenant Limits (0 indicates unlimited)
    max_products = models.PositiveIntegerField(default=25, help_text='Maximum product listings allowed (0 for unlimited)')
    max_stores = models.PositiveIntegerField(default=1, help_text='Maximum physical/online storefronts allowed')
    max_staff_accounts = models.PositiveIntegerField(default=2, help_text='Maximum staff logins allowed')
    max_monthly_orders = models.PositiveIntegerField(default=100, help_text='Maximum orders processed monthly before throttling')

    # Feature Flags & Capabilities
    has_advanced_inventory = models.BooleanField(default=False, help_text='Warehouse transfers, batch lots, and automated reorders')
    has_custom_domain = models.BooleanField(default=False, help_text='Custom storefront domain mapping')
    has_analytics_reports = models.BooleanField(default=False, help_text='Granular financial reports and CSV exports')
    has_api_access = models.BooleanField(default=False, help_text='REST API access and webhook delivery')
    has_priority_support = models.BooleanField(default=False, help_text='Dedicated account manager & 24/7 SLA')

    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = 'Subscription Plan'
        verbose_name_plural = 'Subscription Plans'
        ordering = ['price_monthly']

    def __str__(self):
        return f"{self.name} [{self.get_tier_display()}]: NPR {self.price_monthly}/mo"

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class TenantSubscription(BaseModel):
    """
    Active subscription contract linking a Vendor or Supplier organization to a Plan.
    """
    vendor = models.OneToOneField(
        VendorProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subscription'
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name='subscriptions'
    )
    billing_interval = models.CharField(
        max_length=20,
        choices=BillingInterval.choices,
        default=BillingInterval.MONTHLY
    )
    status = models.CharField(
        max_length=25,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.TRIALING,
        db_index=True
    )
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField()
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    grace_period_ends_at = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Tenant Subscription'
        verbose_name_plural = 'Tenant Subscriptions'
        ordering = ['-created_at']

    def __str__(self):
        target = self.vendor.business_name if self.vendor else (self.supplier.company_name if self.supplier else 'Unknown')
        return f"{target} - {self.plan.name} ({self.get_status_display()})"

    @property
    def is_valid(self):
        now = timezone.now()
        if self.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]:
            return True
        if self.status == SubscriptionStatus.GRACE_PERIOD:
            return bool(self.grace_period_ends_at and self.grace_period_ends_at > now)
        return False


class SubscriptionInvoice(BaseModel):
    """
    Billing invoice generated for subscription initiation or periodic renewal.
    """
    invoice_number = models.CharField(max_length=60, unique=True, db_index=True)
    subscription = models.ForeignKey(
        TenantSubscription,
        on_delete=models.CASCADE,
        related_name='invoices'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=10, decimal_places=2)
    
    billing_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    paid_at = models.DateTimeField(null=True, blank=True)
    
    payment_method = models.CharField(max_length=50, default='KHALTI')
    payment_status = models.CharField(max_length=30, default='PAID', db_index=True)
    transaction_reference = models.CharField(max_length=120, blank=True)

    class Meta:
        verbose_name = 'Subscription Invoice'
        verbose_name_plural = 'Subscription Invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.invoice_number}: NPR {self.grand_total} ({self.payment_status})"
