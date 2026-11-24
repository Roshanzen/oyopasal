from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from apps.common.models import BaseModel

class UserRole(models.TextChoices):
    SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
    SUPPORT_ADMIN = 'SUPPORT_ADMIN', 'Support Admin'
    FINANCE_ADMIN = 'FINANCE_ADMIN', 'Finance Admin'
    OPERATIONS_ADMIN = 'OPERATIONS_ADMIN', 'Operations Admin'
    ADMIN = 'ADMIN', 'Admin'
    VENDOR = 'VENDOR', 'Vendor'
    VENDOR_OWNER = 'VENDOR_OWNER', 'Vendor Owner'
    VENDOR_STAFF = 'VENDOR_STAFF', 'Vendor Staff'
    SUPPLIER_OWNER = 'SUPPLIER_OWNER', 'Supplier Owner'
    SUPPLIER_STAFF = 'SUPPLIER_STAFF', 'Supplier Staff'
    CUSTOMER = 'CUSTOMER', 'Customer'


class UserManager(BaseUserManager):
    """Custom user model manager where email is the unique identifier for auth."""
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email).lower()
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', UserRole.CUSTOMER)

        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.SUPER_ADMIN)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Primary User model for all 4 ecosystems (Customer, Vendor, Supplier, Admin).
    Uses email as the unique primary login identifier.
    """
    email = models.EmailField('Email Address', unique=True, db_index=True)
    phone_number = models.CharField('Phone Number', max_length=20, unique=True, null=True, blank=True, db_index=True)
    first_name = models.CharField('First Name', max_length=150, blank=True)
    last_name = models.CharField('Last Name', max_length=150, blank=True)
    role = models.CharField(
        'User Role',
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER,
        db_index=True
    )
    is_verified = models.BooleanField('Verified Status', default=False)
    is_active = models.BooleanField('Active Status', default=True)
    is_staff = models.BooleanField('Staff Status', default=False)
    avatar_url = models.URLField('Avatar URL', max_length=500, blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    @property
    def is_vendor(self):
        return bool(
            self.role in [UserRole.VENDOR, UserRole.VENDOR_OWNER, UserRole.VENDOR_STAFF] or
            hasattr(self, 'vendor_profile')
        )


class StaffProfile(BaseModel):
    """
    Staff assignment model linking a user to a vendor, supplier, or platform department
    with customizable granular permissions.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    department = models.CharField(max_length=100, blank=True)
    assigned_permissions = models.JSONField(
        default=dict,
        blank=True,
        help_text='Granular permission dictionary e.g. {"can_manage_inventory": true, "can_view_settlements": false}'
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Staff: {self.user.email} - {self.department}"

