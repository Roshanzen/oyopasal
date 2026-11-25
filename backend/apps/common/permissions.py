from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    """Allows access only to Super Admin users."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or request.user.role == 'SUPER_ADMIN')
        )


class IsFinanceAdmin(permissions.BasePermission):
    """Allows access to Super Admins and Finance Admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['SUPER_ADMIN', 'FINANCE_ADMIN']
        )


class IsOperationsAdmin(permissions.BasePermission):
    """Allows access to Super Admins and Operations Admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']
        )


class IsSupportAdmin(permissions.BasePermission):
    """Allows access to Super Admins and Support Admins."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['SUPER_ADMIN', 'SUPPORT_ADMIN']
        )


class IsVendorOwner(permissions.BasePermission):
    """Allows access to Vendor Owners (by role or attached vendor profile)."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                request.user.role == 'VENDOR_OWNER' or
                hasattr(request.user, 'vendor_profile') or
                request.user.is_superuser or
                request.user.role == 'SUPER_ADMIN'
            )
        )


class IsVendor(permissions.BasePermission):
    """Allows access to Vendor Owners and Vendor Staff."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                request.user.role in ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SUPER_ADMIN'] or
                hasattr(request.user, 'vendor_profile') or
                (hasattr(request.user, 'vendor_staff_roles') and request.user.vendor_staff_roles.exists()) or
                request.user.is_superuser
            )
        )


class IsApprovedVendor(permissions.BasePermission):
    """
    Strictly verifies that the authenticated user is an APPROVED vendor.
    Rejects customers, pending/rejected/suspended vendors, and unauthenticated users.
    """
    message = "Only active and approved merchant store owners can configure store profiles."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or getattr(request.user, 'role', '') in ['SUPER_ADMIN', 'ADMIN']:
            return True
        if getattr(request.user, 'role', '') == 'CUSTOMER' and not hasattr(request.user, 'vendor_profile'):
            return False
        if hasattr(request.user, 'vendor_profile'):
            vp = request.user.vendor_profile
            return str(getattr(vp, 'status', '')).upper() == 'APPROVED'
        if getattr(request.user, 'role', '') in ['VENDOR', 'VENDOR_OWNER']:
            if hasattr(request.user, 'vendor_profile'):
                return str(getattr(request.user.vendor_profile, 'status', '')).upper() == 'APPROVED'
            return True
        return False


class IsAuthenticatedVendor(permissions.BasePermission):
    """
    Strictly verifies that the user is authenticated, has a vendor role or store/vendor_profile,
    and is NOT a customer-only account.
    Enforces that only APPROVED & ACTIVE vendor profiles are permitted access.
    """
    message = "You do not have vendor permissions or your vendor account is not active."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or getattr(request.user, 'role', '') in ['SUPER_ADMIN', 'ADMIN']:
            return True
        if getattr(request.user, 'role', '') == 'CUSTOMER' and not hasattr(request.user, 'vendor_profile'):
            return False
        if hasattr(request.user, 'vendor_profile'):
            vp = request.user.vendor_profile
            if getattr(vp, 'status', '') != 'APPROVED':
                return False
            return True
        if hasattr(request.user, 'vendor_staff_roles') and request.user.vendor_staff_roles.exists():
            return True
        if getattr(request.user, 'role', '') in ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF']:
            return True
        return False


class IsSupplierOwner(permissions.BasePermission):
    """Allows access only to Supplier Owners."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'SUPPLIER_OWNER'
        )


class IsSupplier(permissions.BasePermission):
    """Allows access to Supplier Owners and Supplier Staff."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['SUPPLIER_OWNER', 'SUPPLIER_STAFF']
        )


class IsCustomer(permissions.BasePermission):
    """Allows access to Customers (including vendor owners and staff shopping as customers)."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """Object-level permission allowing only the owner or superadmin to edit."""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN' or request.user.is_superuser:
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False


class CanManageCategories(permissions.BasePermission):
    """
    Allows read-only access (GET, HEAD, OPTIONS) to all users (AllowAny).
    Restricts mutating operations (POST, PUT, PATCH, DELETE) exclusively to authenticated
    Admins (Super Admin, Operations Admin, or staff).
    Strictly denies Sellers/Vendors, Customers, and unauthenticated users.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False

        # Strictly check for Admin / Super Admin permissions
        if user.is_superuser or user.is_staff:
            return True

        admin_roles = {'SUPER_ADMIN', 'OPERATIONS_ADMIN'}
        if getattr(user, 'role', None) in admin_roles:
            return True

        # All sellers/vendors, customers, and other roles are rejected with 403 Forbidden
        return False


