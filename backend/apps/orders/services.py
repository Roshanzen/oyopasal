import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.cart.models import Cart
from apps.orders.models import (
    Order,
    VendorSubOrder,
    OrderItem,
    OrderStatus,
    OrderStatusHistory
)
from apps.warehouse.models import Warehouse
from apps.inventory.models import InventoryItem
from apps.inventory.services import InventoryService, InsufficientStockError

class CheckoutService:
    @classmethod
    @transaction.atomic
    def process_checkout(cls, user, shipping_address_data: dict, payment_method: str = 'COD', customer_notes: str = '', delivery_option: str = 'EXPRESS_12_MINS') -> Order:
        """
        Executes atomic multi-vendor checkout:
        1. Validates cart content and active product statuses.
        2. Validates local delivery radius for express orders.
        3. Reserves required stock across warehouse records.
        4. Groups line items by vendor.
        5. Calculates suborders, commissions, and taxes.
        6. Generates Parent Order and VendorSubOrders.
        7. Clears customer cart.
        """
        try:
            cart = Cart.objects.select_for_update().filter(user=user).first()
        except Exception:
            cart = None

        if not cart:
            raise ValueError("Customer cart not found. Please add items before checking out.")

        cart_items = list(cart.items.select_related(
            'variant', 'variant__product', 'variant__product__vendor', 'variant__product__store'
        ))

        if not cart_items:
            raise ValueError("Your cart is empty. Please add items before checking out.")

        # Validate that all items and products are active and approved, refresh pricing fresh from DB
        for item in cart_items:
            if not item.variant or not getattr(item.variant, 'product', None):
                raise ValueError("An item in your cart is no longer available.")
            if item.variant.product.status != 'APPROVED' or not item.variant.is_active:
                raise ValueError(f"Product '{item.variant.product.name}' is no longer available.")
            if item.quantity <= 0:
                raise ValueError(f"Invalid quantity ({item.quantity}) for {item.variant.product.name}.")
            item.variant.refresh_from_db()
            if item.variant.selling_price is None or item.variant.selling_price <= 0:
                raise ValueError(f"Invalid pricing configured for {item.variant.product.name}.")

        # Generate unique order number
        order_uuid_suffix = uuid.uuid4().hex[:8].upper()
        order_date_str = timezone.now().strftime('%Y%m%d')
        order_number = f"ORD-{order_date_str}-{order_uuid_suffix}"

        # Group items by vendor
        vendor_groups = {}
        for item in cart_items:
            v_id = item.variant.product.vendor_id or 'v-default'
            if v_id not in vendor_groups:
                vendor_groups[v_id] = {
                    'vendor': getattr(item.variant.product, 'vendor', None),
                    'store': getattr(item.variant.product, 'store', None),
                    'items': []
                }
            vendor_groups[v_id]['items'].append(item)

        # Validate delivery radius for Express options
        from apps.delivery.views import haversine_km
        cust_lat = shipping_address_data.get('latitude') or shipping_address_data.get('lat')
        cust_lng = shipping_address_data.get('longitude') or shipping_address_data.get('lng')

        if (delivery_option or '').upper() in ['EXPRESS', 'EXPRESS_12_MINS', 'INSTANT'] and cust_lat is not None and cust_lng is not None:
            for group in vendor_groups.values():
                store = group.get('store')
                vendor = group.get('vendor')
                store_lat = float(store.latitude) if (store and getattr(store, 'latitude', None) is not None) else (
                    float(vendor.latitude) if (vendor and getattr(vendor, 'latitude', None) is not None) else None
                )
                store_lng = float(store.longitude) if (store and getattr(store, 'longitude', None) is not None) else (
                    float(vendor.longitude) if (vendor and getattr(vendor, 'longitude', None) is not None) else None
                )
                if store_lat is not None and store_lng is not None:
                    dist_km = haversine_km(store_lat, store_lng, cust_lat, cust_lng)
                    max_radius = float(store.max_local_delivery_km) if (store and getattr(store, 'max_local_delivery_km', None) is not None) else 15.0
                    if dist_km > max_radius:
                        raise ValueError(
                            f"Outside {max_radius:g} km Express Zone ({dist_km:.1f} km away) — Available via Intercity Standard Delivery (1–2 Days)"
                        )

        # Calculate authoritative subtotal
        order_subtotal = Decimal('0.00')
        order_tax_total = Decimal('0.00')
        for item in cart_items:
            item_total = Decimal(str(item.quantity)) * Decimal(str(item.variant.selling_price))
            order_subtotal += item_total

        # Standard delivery fee matching cart logic: Free over 499, else 35
        if order_subtotal >= Decimal('499.00') or order_subtotal == Decimal('0.00'):
            order_delivery_total = Decimal('0.00')
        else:
            order_delivery_total = Decimal('35.00')

        # Reserve inventory for each item using deterministic row locking to prevent deadlocks and overselling
        sorted_cart_items = sorted(cart_items, key=lambda x: str(x.variant_id))
        reservations = []
        for item in sorted_cart_items:
            # Locate an inventory item with available stock using row-level locking
            inv_record = InventoryItem.objects.select_for_update().filter(
                variant=item.variant,
                quantity_on_hand__gte=item.quantity
            ).first()

            if not inv_record:
                inv_record = InventoryItem.objects.select_for_update().filter(
                    variant=item.variant
                ).first()

            if not inv_record or inv_record.quantity_available < item.quantity:
                avail = inv_record.quantity_available if inv_record else 0
                raise InsufficientStockError(
                    f"Insufficient stock available for {item.variant.product.name} ({item.variant.sku}). "
                    f"Requested: {item.quantity}, Available: {avail}."
                )

            res = InventoryService.reserve_stock(
                warehouse_id=inv_record.warehouse_id,
                variant_id=item.variant_id,
                quantity=item.quantity,
                session_id=order_number
            )
            reservations.append((item, res))

        # Initial Parent Order
        norm_payment = 'COD' if (payment_method or '').upper() in ['COD', 'CASH_ON_DELIVERY', 'CASH'] else payment_method
        initial_status = OrderStatus.CONFIRMED if norm_payment == 'COD' else OrderStatus.PENDING_PAYMENT
        parent_order = Order.objects.create(
            order_number=order_number,
            customer=user,
            status=initial_status,
            subtotal=order_subtotal,
            delivery_total=order_delivery_total,
            tax_total=Decimal('0.00'),
            grand_total=Decimal('0.00'),
            payment_method=norm_payment,
            payment_status='UNPAID',
            shipping_address_snapshot=shipping_address_data,
            customer_notes=customer_notes
        )

        # Create VendorSubOrders and OrderItems with delivery fee consistency
        suborder_counter = 1
        num_vendors = len(vendor_groups)
        allocated_delivery = Decimal('0.00')

        for idx, (v_id, group) in enumerate(vendor_groups.items()):
            sub_order_number = f"SUB-{order_date_str}-{order_uuid_suffix}-V{suborder_counter:02d}"
            suborder_counter += 1

            vendor = group['vendor']
            store = group['store']
            sub_items = group['items']

            sub_subtotal = sum(Decimal(str(i.quantity)) * Decimal(str(i.variant.selling_price)) for i in sub_items)

            # Ensure delivery fee across vendor suborders matches parent order delivery total exactly
            if order_delivery_total == Decimal('0.00'):
                sub_delivery = Decimal('0.00')
            elif idx == num_vendors - 1:
                sub_delivery = order_delivery_total - allocated_delivery
            else:
                sub_delivery = round(order_delivery_total / Decimal(num_vendors), 2)
                allocated_delivery += sub_delivery

            # Commission calculation (vendor override if specified, else default 10%)
            commission_rate = getattr(vendor, 'commission_rate_override', None) if vendor else None
            if commission_rate is None:
                commission_rate = Decimal('10.00')
            commission_amount = round((sub_subtotal * (commission_rate / Decimal('100.00'))), 2)
            vendor_net = sub_subtotal - commission_amount

            sub_order = VendorSubOrder.objects.create(
                parent_order=parent_order,
                sub_order_number=sub_order_number,
                vendor=vendor,
                store=store,
                status=initial_status,
                subtotal=sub_subtotal,
                delivery_fee=sub_delivery,
                commission_rate=commission_rate,
                commission_amount=commission_amount,
                vendor_net_amount=vendor_net
            )

            # Create OrderItems with authoritative prices
            for item in sub_items:
                matched_res = next((r for i, r in reservations if i.id == item.id), None)
                res_id = matched_res.id if matched_res else None

                u_price = Decimal(str(item.variant.selling_price))
                t_price = Decimal(str(item.quantity)) * u_price

                prod_tax = getattr(item.variant.product, 'tax_rate', Decimal('0.00')) or Decimal('0.00')
                item_tax = round(t_price * (prod_tax / Decimal('100.00')), 2)
                order_tax_total += item_tax

                OrderItem.objects.create(
                    sub_order=sub_order,
                    variant=item.variant,
                    product_name=item.variant.product.name,
                    variant_sku=item.variant.sku,
                    attributes_snapshot=item.variant.attributes,
                    unit_price=u_price,
                    quantity=item.quantity,
                    total_price=t_price,
                    tax_rate=prod_tax,
                    tax_amount=item_tax,
                    reservation_id=res_id
                )

            # Timeline log for suborder
            vendor_name = vendor.business_name if vendor else 'Local Vendor'
            OrderStatusHistory.objects.create(
                order=parent_order,
                sub_order=sub_order,
                previous_status='CREATED',
                new_status=initial_status,
                remarks=f"Sub-order created for vendor {vendor_name}",
                changed_by=user
            )

        # Update parent totals
        parent_order.subtotal = order_subtotal
        parent_order.tax_total = order_tax_total
        parent_order.delivery_total = order_delivery_total
        parent_order.grand_total = order_subtotal + order_delivery_total + order_tax_total

        # Enforce Cash On Delivery threshold limit
        if norm_payment == 'COD' and parent_order.grand_total > Decimal('50000.00'):
            raise ValueError("Cash on Delivery (COD) is limited to orders up to NPR 50,000.00. Please select an online payment method.")

        parent_order.save(update_fields=['subtotal', 'tax_total', 'delivery_total', 'grand_total', 'updated_at'])

        # Timeline log for parent
        OrderStatusHistory.objects.create(
            order=parent_order,
            previous_status='CREATED',
            new_status=initial_status,
            remarks=f"Order {order_number} placed via {payment_method}",
            changed_by=user
        )

        # Empty cart
        cart.items.all().delete()

        return parent_order


class OrderService:
    VALID_TRANSITIONS = {
        OrderStatus.PENDING_PAYMENT: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.CANCELLED],
        OrderStatus.PAYMENT_PROCESSING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED, OrderStatus.FAILED],
        OrderStatus.CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.READY_FOR_DISPATCH, OrderStatus.CANCELLED],
        OrderStatus.PROCESSING: [OrderStatus.PACKED, OrderStatus.READY_FOR_DISPATCH, OrderStatus.CANCELLED],
        OrderStatus.PACKED: [OrderStatus.READY_FOR_DISPATCH, OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
        OrderStatus.READY_FOR_DISPATCH: [OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        OrderStatus.SHIPPED: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        OrderStatus.OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        OrderStatus.DELIVERED: [OrderStatus.RETURN_REQUESTED],
        OrderStatus.RETURN_REQUESTED: [OrderStatus.RETURNED],
    }

    @classmethod
    @transaction.atomic
    def transition_suborder(cls, sub_order_id, new_status: str, user, remarks: str = '', tracking_number: str = '', delivery_provider: str = '') -> VendorSubOrder:
        """
        Executes a validated state transition for a vendor sub-order.
        Automatically commits inventory reservations when shipped, or releases them if cancelled.
        """
        sub_order = VendorSubOrder.objects.select_for_update().get(id=sub_order_id)
        current_status = sub_order.status

        # Idempotent: already at target status
        if current_status == new_status:
            if tracking_number:
                sub_order.tracking_number = tracking_number
            if delivery_provider:
                sub_order.delivery_provider = delivery_provider
            sub_order.save(update_fields=['tracking_number', 'delivery_provider', 'updated_at'])
            return sub_order

        # Validate transition rules
        allowed = cls.VALID_TRANSITIONS.get(current_status, [])
        if new_status not in allowed and not (user.is_superuser or user.role == 'SUPER_ADMIN'):
            raise ValueError(f"Invalid transition from {current_status} to {new_status}.")

        prev_status = sub_order.status
        sub_order.status = new_status

        if tracking_number:
            sub_order.tracking_number = tracking_number
        if delivery_provider:
            sub_order.delivery_provider = delivery_provider
        if new_status in [OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY]:
            if not sub_order.shipped_at:
                sub_order.shipped_at = timezone.now()
            # Commit all linked inventory reservations
            for item in sub_order.items.all():
                if item.reservation_id:
                    try:
                        InventoryService.commit_reservation(
                            reservation_id=item.reservation_id,
                            reference_id=sub_order.sub_order_number,
                            user=user
                        )
                    except Exception:
                        pass
        elif new_status == OrderStatus.DELIVERED:
            sub_order.delivered_at = timezone.now()
        elif new_status == OrderStatus.CANCELLED:
            sub_order.cancellation_reason = remarks
            # Release all linked inventory reservations
            for item in sub_order.items.all():
                if item.reservation_id:
                    try:
                        InventoryService.release_reservation(
                            reservation_id=item.reservation_id,
                            user=user
                        )
                    except Exception:
                        pass

        sub_order.save()

        # Log timeline
        OrderStatusHistory.objects.create(
            order=sub_order.parent_order,
            sub_order=sub_order,
            previous_status=prev_status,
            new_status=new_status,
            remarks=remarks,
            changed_by=user
        )

        # Check if parent order status should advance
        cls._sync_parent_order_status(sub_order.parent_order)

        return sub_order

    @classmethod
    def _sync_parent_order_status(cls, parent_order: Order):
        """
        Advances parent order status if all sibling vendor suborders reach completion.
        """
        suborders = parent_order.suborders.all()
        statuses = [s.status for s in suborders]

        if all(s == OrderStatus.DELIVERED for s in statuses):
            parent_order.status = OrderStatus.DELIVERED
            parent_order.save(update_fields=['status', 'updated_at'])
        elif all(s == OrderStatus.CANCELLED for s in statuses):
            parent_order.status = OrderStatus.CANCELLED
            parent_order.save(update_fields=['status', 'updated_at'])
        elif any(s in [OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY] for s in statuses):
            if parent_order.status != OrderStatus.DELIVERED:
                parent_order.status = OrderStatus.SHIPPED
                parent_order.save(update_fields=['status', 'updated_at'])
        elif any(s in [OrderStatus.PACKED, OrderStatus.READY_FOR_DISPATCH] for s in statuses):
            if parent_order.status not in [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
                parent_order.status = OrderStatus.PROCESSING
                parent_order.save(update_fields=['status', 'updated_at'])

