from django.db import models
from django.utils import timezone
from apps.common.models import BaseModel, SoftDeletableModel
from apps.catalogue.models import Category
from apps.vendors.models import VendorProfile
from apps.orders.models import VendorSubOrder

class CommissionRuleType(models.TextChoices):
    GLOBAL = 'GLOBAL', 'Global Default Rule'
    CATEGORY = 'CATEGORY', 'Category-specific Rule'
    VENDOR = 'VENDOR', 'Vendor-specific Custom Override'


class CommissionRule(BaseModel, SoftDeletableModel):
    """
    Versioned platform commission rules.
    Historical suborders preserve their applied rates even when rules are updated.
    """
    name = models.CharField(max_length=150)
    rule_type = models.CharField(
        max_length=20,
        choices=CommissionRuleType.choices,
        default=CommissionRuleType.GLOBAL,
        db_index=True
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='commission_rules'
    )
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='commission_rules'
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=10.00,
        help_text='Commission percentage e.g. 10.00 for 10%'
    )
    fixed_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text='Additional fixed NPR fee per order transaction'
    )
    is_active = models.BooleanField(default=True, db_index=True)
    effective_from = models.DateTimeField(default=timezone.now)
    effective_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Commission Rule'
        verbose_name_plural = 'Commission Rules'
        ordering = ['-created_at']

    def __str__(self):
        target = self.vendor.business_name if self.vendor else (self.category.name if self.category else 'Global')
        return f"{self.name} [{self.get_rule_type_display()} - {target}]: {self.percentage}%"


class CommissionRecord(BaseModel):
    """
    Immutable commission record calculated and attached to every completed VendorSubOrder.
    """
    sub_order = models.OneToOneField(
        VendorSubOrder,
        on_delete=models.CASCADE,
        related_name='commission_record'
    )
    rule = models.ForeignKey(
        CommissionRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='records'
    )
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    tax_on_commission = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    net_vendor_earning = models.DecimalField(max_digits=12, decimal_places=2)
    is_settled = models.BooleanField(default=False, db_index=True)

    class Meta:
        verbose_name = 'Commission Record'
        verbose_name_plural = 'Commission Records'
        ordering = ['-created_at']

    def __str__(self):
        return f"Commission for {self.sub_order.sub_order_number}: NPR {self.commission_amount}"

