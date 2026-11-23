import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.stores.models import Store
from apps.vendors.models import VendorProfile, VendorStatus

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Store)
def sync_vendor_approval_on_store_verification(sender, instance, created, **kwargs):
    """
    Automatically updates linked VendorProfile status to 'APPROVED' whenever a Store
    is marked verified (is_verified=True) or active (is_active=True).
    Ensures seamless real-time synchronization across Admin, Vendor Portal, and Storefront.
    """
    if not instance.vendor_id:
        return

    should_approve = bool(instance.is_verified)
    if should_approve:
        try:
            vendor = instance.vendor
            if vendor and vendor.status != VendorStatus.APPROVED:
                VendorProfile.objects.filter(id=instance.vendor_id).update(status=VendorStatus.APPROVED)
                logger.info(
                    "Auto-approved vendor %s (ID: %s) via store signal on store %s (ID: %s)",
                    vendor.business_name,
                    vendor.id,
                    instance.name,
                    instance.id
                )
        except Exception as e:
            logger.error("Failed to auto-approve vendor for store %s: %s", instance.id, e)
