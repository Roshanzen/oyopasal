from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class SupplierStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Verification'
    APPROVED = 'APPROVED', 'Approved & Active'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class SupplierProfile(BaseModel):
    """
    Wholesale Supplier profile providing B2B inventory, RFQs, and purchase order fulfillment to vendors.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='supplier_profile'
    )
    company_name = models.CharField(max_length=255, unique=True, db_index=True)
    slug = models.SlugField(max_length=255, unique=True)
    pan_vat_number = models.CharField('PAN / VAT Number', max_length=50, blank=True)
    registration_number = models.CharField('Company Registration No', max_length=100, blank=True)
    wholesale_categories = models.CharField(max_length=255, blank=True)
    company_description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=SupplierStatus.choices,
        default=SupplierStatus.PENDING,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True)

    credit_terms_days = models.PositiveIntegerField(
        default=30,
        help_text='Payment credit period extended to verified vendors (in days)'
    )
    minimum_po_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text='Minimum purchase order amount accepted'
    )

    # Bank Details for Wholesale Invoicing
    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)

    logo_url = models.URLField(max_length=500, blank=True)

    class Meta:
        verbose_name = 'Supplier Profile'
        verbose_name_plural = 'Supplier Profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.company_name} ({self.get_status_display()})"


class SupplierDocument(BaseModel):
    """KYC & Commercial registration documents for wholesale suppliers."""
    DOC_TYPES = (
        ('PAN_CERTIFICATE', 'PAN / VAT Certificate'),
        ('COMPANY_REG', 'Company Registration Document'),
        ('EXIM_CODE', 'EXIM Code / Import License (if applicable)'),
        ('BANK_CHEQUE', 'Cancelled Cheque'),
        ('OTHER', 'Other Supporting Document'),
    )

    supplier = models.ForeignKey(SupplierProfile, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOC_TYPES)
    document_url = models.URLField(max_length=500)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.supplier.company_name} - {self.get_document_type_display()}"


class SupplierStaffMember(BaseModel):
    """
    Granular permission assignments for supplier staff accounts.
    """
    supplier = models.ForeignKey(SupplierProfile, on_delete=models.CASCADE, related_name='staff_members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='supplier_staff_roles')
    can_manage_catalogue = models.BooleanField(default=True)
    can_manage_quotations = models.BooleanField(default=True)
    can_fulfill_orders = models.BooleanField(default=True)
    can_view_financials = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Supplier Staff Member'
        verbose_name_plural = 'Supplier Staff Members'
        unique_together = ('supplier', 'user')

    def __str__(self):
        return f"Staff {self.user.email} -> {self.supplier.company_name}"


