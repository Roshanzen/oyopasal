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
    """Allows access only to Vendor Owners."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'VENDOR_OWNER'
        )


class IsVendor(permissions.BasePermission):
    """Allows access to Vendor Owners and Vendor Staff."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role in ['VENDOR_OWNER', 'VENDOR_STAFF']
        )


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
    """Allows access to Customers."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'CUSTOMER'
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """Object-level permission allowing only the owner or superadmin to edit."""
    def has_object_permission(self, request, view, obj):
        if request.user.role == 'SUPER_ADMIN' or request.user.is_superuser:
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        return False

