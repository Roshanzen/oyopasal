from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class VendorStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Verification'
    APPROVED = 'APPROVED', 'Approved & Active'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    ARCHIVED = 'ARCHIVED', 'Archived'


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


class SellerApplicationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    APPROVED = 'APPROVED', 'Approved'
    INVITATION_SENT = 'INVITATION_SENT', 'Invitation Sent'
    ACTIVE = 'ACTIVE', 'Active'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class SellerApplication(BaseModel):
    """
    Formal public application submitted by an applicant wishing to onboard as an OyoPasal merchant.
    Requires review and approval by an authorized platform administrator before merchant activation.
    """
    application_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text='Unique reference code e.g. APP-2026-XXXXX'
    )
    applicant_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='seller_applications'
    )
    full_name = models.CharField(max_length=150)
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=20, db_index=True)
    alt_phone = models.CharField(max_length=20, blank=True)

    # Business Information
    business_name = models.CharField(max_length=255, db_index=True)
    business_category = models.CharField(max_length=100)
    business_description = models.TextField(blank=True)
    business_contact_phone = models.CharField(max_length=20, blank=True)
    business_contact_email = models.EmailField(blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    pan_vat_number = models.CharField(max_length=50, blank=True)

    # Store Location
    province = models.CharField(max_length=100, blank=True)
    district = models.CharField(max_length=100, blank=True)
    municipality = models.CharField(max_length=100, blank=True)
    ward_number = models.CharField(max_length=10, blank=True)
    complete_address = models.CharField(max_length=255)
    postal_code = models.CharField(max_length=20, blank=True)

    # Document References
    registration_doc_url = models.URLField(max_length=500, blank=True)
    pan_vat_doc_url = models.URLField(max_length=500, blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    supporting_docs = models.JSONField(default=list, blank=True)

    # Declaration
    declaration_confirmed = models.BooleanField(default=True)

    # Application Status & Admin Review
    status = models.CharField(
        max_length=30,
        choices=SellerApplicationStatus.choices,
        default=SellerApplicationStatus.PENDING,
        db_index=True
    )
    admin_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    additional_info_requested = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_seller_applications'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Linked VendorProfile once created
    vendor_profile = models.ForeignKey(
        VendorProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='applications'
    )

    class Meta:
        verbose_name = 'Seller Application'
        verbose_name_plural = 'Seller Applications'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.application_number} - {self.business_name} ({self.get_status_display()})"


class VendorInvitation(BaseModel):
    """
    Cryptographically secure single-use invitation token issued to an approved applicant
    to set their merchant account password and activate their vendor store.
    """
    application = models.ForeignKey(
        SellerApplication,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    token = models.CharField(max_length=128, unique=True, db_index=True)
    email = models.EmailField(db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    is_used = models.BooleanField(default=False, db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = 'Vendor Invitation'
        verbose_name_plural = 'Vendor Invitations'
        ordering = ['-created_at']

    def __str__(self):
        status = "Used" if self.is_used else "Active"
        return f"Invitation for {self.email} ({status})"

    def is_valid(self):
        from django.utils import timezone
        return (not self.is_used) and (timezone.now() <= self.expires_at)


class SellerApplicationAudit(models.Model):
    """
    Immutable audit trail recording every state change, review note, and administrative action
    taken on a seller application.
    """
    application = models.ForeignKey(
        SellerApplication,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True)
    previous_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Seller Application Audit'
        verbose_name_plural = 'Seller Application Audits'
        ordering = ['-created_at']

    def __str__(self):
        actor_name = self.actor.email if self.actor else "System"
        return f"{self.application.application_number} - {self.action} by {actor_name} at {self.created_at}"



