from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.stores.models import Store
from apps.vendors.models import VendorProfile, VendorStatus


@receiver(post_save, sender=Store)
def sync_store_verification_to_vendor(sender, instance, created, **kwargs):
    """
    Whenever store.is_verified is saved as True in Django Admin (or anywhere in ORM),
    automatically update its linked VendorProfile status to 'APPROVED' and ensure is_active = True.
    """
    if instance.is_verified and instance.vendor:
        vendor = instance.vendor
        changed = False
        if vendor.status != VendorStatus.APPROVED:
            vendor.status = VendorStatus.APPROVED
            changed = True

        if hasattr(vendor, 'user') and vendor.user and not vendor.user.is_active:
            vendor.user.is_active = True
            vendor.user.save(update_fields=['is_active'])

        if changed:
            vendor.save(update_fields=['status'])


@receiver(post_save, sender=VendorProfile)
def sync_vendor_approval_to_stores(sender, instance, created, **kwargs):
    """
    Whenever VendorProfile status is saved as 'APPROVED',
    automatically update all linked stores to is_verified = True and is_active = True.
    """
    if instance.status == VendorStatus.APPROVED:
        instance.stores.filter(is_verified=False).update(is_verified=True, is_active=True)
