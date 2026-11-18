import uuid
from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from apps.catalogue.models import Product
from apps.stores.models import Store
from .models import (
    SubscriptionPlan,
    TenantSubscription,
    SubscriptionInvoice,
    SubscriptionStatus,
    SubscriptionTier,
    BillingInterval
)

class SubscriptionLimitExceededError(Exception):
    """Raised when a vendor or supplier attempts an action exceeding their plan quota."""
    pass


class SubscriptionService:
    @classmethod
    def get_or_create_default_trial_plan(cls) -> SubscriptionPlan:
        plan, _ = SubscriptionPlan.objects.get_or_create(
            slug='free-trial',
            defaults={
                'name': 'Free Trial Starter',
                'tier': SubscriptionTier.FREE_TRIAL,
                'description': '14-day full feature trial to get your store up and running.',
                'price_monthly': Decimal('0.00'),
                'price_annually': Decimal('0.00'),
                'trial_days': 14,
                'max_products': 50,
                'max_stores': 3,
                'max_staff_accounts': 3,
                'max_monthly_orders': 200,
                'has_advanced_inventory': False,
                'has_analytics_reports': True,
                'has_api_access': False,
            }
        )
        return plan

    @classmethod
    @transaction.atomic
    def assign_free_trial(cls, tenant, plan: SubscriptionPlan = None) -> TenantSubscription:
        """
        Enrolls a new vendor or supplier into an initial free trial.
        """
        if not plan:
            plan = cls.get_or_create_default_trial_plan()

        now = timezone.now()
        trial_end = now + timedelta(days=plan.trial_days)

        is_vendor = hasattr(tenant, 'business_name')
        vendor_arg = tenant if is_vendor else None
        supplier_arg = tenant if not is_vendor else None

        subscription, created = TenantSubscription.objects.update_or_create(
            vendor=vendor_arg,
            supplier=supplier_arg,
            defaults={
                'plan': plan,
                'billing_interval': BillingInterval.MONTHLY,
                'status': SubscriptionStatus.TRIALING,
                'current_period_start': now,
                'current_period_end': trial_end,
                'trial_ends_at': trial_end,
                'auto_renew': True,
            }
        )
        return subscription

    @classmethod
    @transaction.atomic
    def subscribe_or_upgrade(
        cls,
        tenant,
        plan: SubscriptionPlan,
        billing_interval: str = BillingInterval.MONTHLY,
        payment_method: str = 'ESEWA'
    ) -> TenantSubscription:
        """
        Subscribes or upgrades a tenant to a paid tier and generates a paid invoice.
        """
        now = timezone.now()
        if billing_interval == BillingInterval.ANNUAL:
            price = plan.price_annually
            period_end = now + timedelta(days=365)
        else:
            price = plan.price_monthly
            period_end = now + timedelta(days=30)

        tax_amount = round(price * Decimal('0.13'), 2) # Nepal 13% VAT
        grand_total = price + tax_amount

        is_vendor = hasattr(tenant, 'business_name')
        vendor_arg = tenant if is_vendor else None
        supplier_arg = tenant if not is_vendor else None

        subscription, _ = TenantSubscription.objects.update_or_create(
            vendor=vendor_arg,
            supplier=supplier_arg,
            defaults={
                'plan': plan,
                'billing_interval': billing_interval,
                'status': SubscriptionStatus.ACTIVE,
                'current_period_start': now,
                'current_period_end': period_end,
                'trial_ends_at': None,
                'grace_period_ends_at': None,
                'cancelled_at': None,
                'auto_renew': True,
            }
        )

        # Generate Invoice
        invoice_number = f"SUB-INV-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        SubscriptionInvoice.objects.create(
            invoice_number=invoice_number,
            subscription=subscription,
            amount=price,
            tax_amount=tax_amount,
            grand_total=grand_total,
            billing_date=now.date(),
            due_date=now.date(),
            paid_at=now,
            payment_method=payment_method,
            payment_status='PAID',
            transaction_reference=f"TXN-{uuid.uuid4().hex[:8].upper()}"
        )

        return subscription

    @classmethod
    @transaction.atomic
    def cancel_subscription(cls, subscription: TenantSubscription, immediate: bool = False) -> TenantSubscription:
        """
        Cancels renewal or immediately expires tenant subscription.
        """
        now = timezone.now()
        subscription.auto_renew = False
        subscription.cancelled_at = now
        if immediate:
            subscription.status = SubscriptionStatus.CANCELLED
            subscription.current_period_end = now
        subscription.save(update_fields=['auto_renew', 'cancelled_at', 'status', 'current_period_end', 'updated_at'])
        return subscription

    @classmethod
    def get_tenant_limits_usage(cls, vendor) -> dict:
        """
        Inspects live resource usage against configured plan quotas.
        """
        subscription = getattr(vendor, 'subscription', None)
        if not subscription or not subscription.is_valid:
            # Fallback default limits
            plan = cls.get_or_create_default_trial_plan()
            is_valid = False
            plan_name = "None / Inactive"
        else:
            plan = subscription.plan
            is_valid = True
            plan_name = plan.name

        current_products = Product.objects.filter(vendor=vendor).count()
        current_stores = Store.objects.filter(vendor=vendor).count()

        return {
            'plan_name': plan_name,
            'is_valid_subscription': is_valid,
            'status': subscription.status if subscription else 'NO_SUBSCRIPTION',
            'expires_at': str(subscription.current_period_end) if subscription else None,
            'limits': {
                'max_products': plan.max_products,
                'current_products': current_products,
                'can_create_product': (plan.max_products == 0) or (current_products < plan.max_products),
                'max_stores': plan.max_stores,
                'current_stores': current_stores,
                'can_create_store': (plan.max_stores == 0) or (current_stores < plan.max_stores),
                'has_advanced_inventory': plan.has_advanced_inventory,
                'has_analytics_reports': plan.has_analytics_reports,
                'has_api_access': plan.has_api_access,
            }
        }

    @classmethod
    def enforce_product_limit(cls, vendor):
        """
        Guard method to prevent product creation if tenant plan limit is reached.
        """
        usage = cls.get_tenant_limits_usage(vendor)
        if not usage['limits']['can_create_product']:
            max_allowed = usage['limits']['max_products']
            raise SubscriptionLimitExceededError(
                f"Your subscription plan limit of {max_allowed} products has been reached. Please upgrade to add more products."
            )

    @classmethod
    def enforce_store_limit(cls, vendor):
        """
        Guard method to prevent store creation if tenant plan limit is reached.
        """
        usage = cls.get_tenant_limits_usage(vendor)
        if not usage['limits']['can_create_store']:
            max_allowed = usage['limits']['max_stores']
            raise SubscriptionLimitExceededError(
                f"Your subscription plan limit of {max_allowed} stores has been reached. Please upgrade to add more stores."
            )

