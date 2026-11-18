from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class VendorStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Verification'
    APPROVED = 'APPROVED', 'Approved & Active'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class VendorProfile(BaseModel):
    """
    Vendor business organization representing an independent merchant store owner.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='vendor_profile'
    )
    business_name = models.CharField(max_length=255, unique=True, db_index=True)
    slug = models.SlugField(max_length=255, unique=True)
    pan_vat_number = models.CharField('PAN / VAT Number', max_length=50, blank=True)
    registration_number = models.CharField('Company Registration No', max_length=100, blank=True)
    business_category = models.CharField(max_length=100, blank=True)
    store_description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=VendorStatus.choices,
        default=VendorStatus.PENDING,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True)

    # Commission override (null means use global category rule)
    commission_rate_override = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Custom percentage commission override for this vendor (e.g. 8.50 for 8.5%)'
    )

    # Settlement Bank Details
    bank_name = models.CharField(max_length=150, blank=True)
    bank_account_name = models.CharField(max_length=150, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_branch = models.CharField(max_length=100, blank=True)

    # Assets
    logo_url = models.URLField(max_length=500, blank=True)
    banner_url = models.URLField(max_length=500, blank=True)

    class Meta:
        verbose_name = 'Vendor Profile'
        verbose_name_plural = 'Vendor Profiles'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.business_name} ({self.get_status_display()})"


class VendorDocument(BaseModel):
    """Verification documents required for KYC compliance in Nepal."""
    DOC_TYPES = (
        ('CITIZENSHIP', 'Citizenship Card (Nagrikta)'),
        ('PAN_CERTIFICATE', 'PAN / VAT Certificate'),
        ('COMPANY_REG', 'Company Registration Document'),
        ('BANK_CHEQUE', 'Cancelled Cheque'),
        ('OTHER', 'Other Supporting Document'),
    )

    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOC_TYPES)
    document_url = models.URLField(max_length=500)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.vendor.business_name} - {self.get_document_type_display()}"


class VendorStaffMember(BaseModel):
    """
    Granular permission assignments for vendor employee accounts.
    Enforces that staff cannot access financial settlements unless explicitly granted.
    """
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='staff_members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='vendor_staff_roles')
    can_manage_products = models.BooleanField(default=True)
    can_manage_orders = models.BooleanField(default=True)
    can_manage_inventory = models.BooleanField(default=True)
    can_view_settlements = models.BooleanField(default=False)
    can_manage_staff = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Vendor Staff Member'
        verbose_name_plural = 'Vendor Staff Members'
        unique_together = ('vendor', 'user')

    def __str__(self):
        return f"Staff {self.user.email} -> {self.vendor.business_name}"


