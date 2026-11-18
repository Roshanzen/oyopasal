import logging
from celery import shared_task
from apps.inventory.services import InventoryService

logger = logging.getLogger(__name__)

@shared_task(name='inventory.release_expired_reservations')
def release_expired_reservations_task():
    """
    Celery background worker task to release expired stock reservations back to available inventory.
    Runs periodically to prevent holding stock hostage if customer checkout was abandoned.
    """
    logger.info("Executing release_expired_reservations_task...")
    released_count = InventoryService.release_expired_reservations()
    logger.info("Released %d expired stock reservations.", released_count)
    return {"released_count": released_count}

