from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from apps.inventory.models import (
    InventoryItem,
    StockMovement,
    StockMovementType,
    StockReservation,
)

class InsufficientStockError(Exception):
    """Raised when an operation requests more stock than currently available."""
    pass


class InventoryService:
    """
    Transactional inventory service handling atomic reservations, stock movements,
    concurrency locking, and automated expiration releases.
    """

    @classmethod
    @transaction.atomic
    def reserve_stock(cls, warehouse_id, variant_id, quantity: int, session_id: str, timeout_minutes: int = 15) -> StockReservation:
        """
        Atomically holds stock for a shopper checkout session.
        Uses select_for_update() row-level locking to prevent race conditions & overselling.
        """
        if quantity <= 0:
            raise ValueError("Reservation quantity must be greater than zero.")

        # Lock the inventory row
        item = InventoryItem.objects.select_for_update().get(
            warehouse_id=warehouse_id,
            variant_id=variant_id
        )

        if item.quantity_available < quantity:
            raise InsufficientStockError(
                f"Insufficient stock for variant {item.variant.sku}. "
                f"Requested: {quantity}, Available: {item.quantity_available}"
            )

        # Increment reserved counter
        item.quantity_reserved += quantity
        item.save(update_fields=['quantity_reserved', 'updated_at'])

        # Create reservation record
        expires_at = timezone.now() + timedelta(minutes=timeout_minutes)
        reservation = StockReservation.objects.create(
            inventory_item=item,
            session_id=session_id,
            quantity=quantity,
            expires_at=expires_at
        )

        # Audit movement
        StockMovement.objects.create(
            inventory_item=item,
            movement_type=StockMovementType.RESERVATION,
            quantity=quantity,
            balance_after=item.quantity_on_hand,
            reference_id=str(reservation.id),
            notes=f"Reserved {quantity} units for checkout session {session_id}"
        )

        return reservation

    @classmethod
    @transaction.atomic
    def release_reservation(cls, reservation_id, user=None) -> bool:
        """
        Releases reserved stock back to available status (e.g. on checkout expiry or abandonment).
        """
        reservation = StockReservation.objects.select_for_update().get(id=reservation_id)
        if reservation.is_released or reservation.is_committed:
            return False

        item = InventoryItem.objects.select_for_update().get(id=reservation.inventory_item_id)
        item.quantity_reserved = max(0, item.quantity_reserved - reservation.quantity)
        item.save(update_fields=['quantity_reserved', 'updated_at'])

        reservation.is_released = True
        reservation.save(update_fields=['is_released', 'updated_at'])

        # Audit movement
        StockMovement.objects.create(
            inventory_item=item,
            movement_type=StockMovementType.RESERVATION_RELEASE,
            quantity=-reservation.quantity,
            balance_after=item.quantity_on_hand,
            reference_id=str(reservation.id),
            notes=f"Released {reservation.quantity} reserved units for session {reservation.session_id}",
            created_by=user
        )

        return True

    @classmethod
    @transaction.atomic
    def commit_reservation(cls, reservation_id, reference_id: str, user=None) -> bool:
        """
        Finalizes reserved stock into permanent fulfillment dispatch upon order confirmation.
        Decrements physical quantity_on_hand and quantity_reserved simultaneously.
        """
        reservation = StockReservation.objects.select_for_update().get(id=reservation_id)
        if reservation.is_committed:
            return False
        if reservation.is_released:
            raise ValueError("Cannot commit an already released stock reservation.")

        item = InventoryItem.objects.select_for_update().get(id=reservation.inventory_item_id)

        item.quantity_on_hand = max(0, item.quantity_on_hand - reservation.quantity)
        item.quantity_reserved = max(0, item.quantity_reserved - reservation.quantity)
        item.save(update_fields=['quantity_on_hand', 'quantity_reserved', 'updated_at'])

        reservation.is_committed = True
        reservation.save(update_fields=['is_committed', 'updated_at'])

        # Audit movement
        StockMovement.objects.create(
            inventory_item=item,
            movement_type=StockMovementType.DISPATCH,
            quantity=-reservation.quantity,
            balance_after=item.quantity_on_hand,
            reference_id=reference_id,
            notes=f"Dispatched {reservation.quantity} units for confirmed order {reference_id}",
            created_by=user
        )

        return True

    @classmethod
    @transaction.atomic
    def adjust_stock(cls, inventory_item_id, delta: int, movement_type: str, reason: str, user=None, reference_id: str = '') -> InventoryItem:
        """
        Manual or supplier-received stock adjustments with mandatory audit trail.
        """
        if delta == 0:
            raise ValueError("Adjustment delta cannot be zero.")

        item = InventoryItem.objects.select_for_update().get(id=inventory_item_id)
        new_on_hand = item.quantity_on_hand + delta

        if new_on_hand < 0:
            raise ValueError(f"Cannot reduce stock below 0. Current on hand: {item.quantity_on_hand}, Requested delta: {delta}")

        item.quantity_on_hand = new_on_hand
        item.save(update_fields=['quantity_on_hand', 'updated_at'])

        # Audit movement
        StockMovement.objects.create(
            inventory_item=item,
            movement_type=movement_type,
            quantity=delta,
            balance_after=item.quantity_on_hand,
            reference_id=reference_id,
            notes=reason,
            created_by=user
        )

        return item

    @classmethod
    def release_expired_reservations(cls) -> int:
        """
        Periodically executed via Celery beat or checkout maintenance.
        Releases all active reservations whose TTL has lapsed.
        """
        expired_reservations = StockReservation.objects.filter(
            expires_at__lt=timezone.now(),
            is_released=False,
            is_committed=False
        )

        count = 0
        for reservation in expired_reservations:
            try:
                if cls.release_reservation(reservation.id):
                    count += 1
            except Exception:
                continue

        return count

