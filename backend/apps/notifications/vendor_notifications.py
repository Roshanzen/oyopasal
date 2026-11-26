import logging
import os
import re
import requests
from decimal import Decimal
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import escape

from apps.notifications.models import VendorOrderNotificationLog
from apps.orders.models import Order, VendorSubOrder, OrderStatus

logger = logging.getLogger('apps.notifications.vendor')


class VendorEmailDispatcher:
    """
    Transactional email dispatcher supporting:
    1. Resend REST API (when RESEND_API_KEY is configured).
    2. Standard Django EmailBackend (console in dev, SMTP/locmem in testing).
    """
    RESEND_API_ENDPOINT = "https://api.resend.com/emails"

    @classmethod
    def send(cls, to_email: str, subject: str, html_content: str, text_content: str = "", from_email: str = None) -> tuple[bool, str, str]:
        sender = from_email or getattr(settings, 'DEFAULT_FROM_EMAIL', 'notifications@oyopasal.com')
        resend_api_key = getattr(settings, 'RESEND_API_KEY', '') or os.getenv('RESEND_API_KEY', '')

        backend_used = 'django_email_backend'

        # If Resend API Key is set and non-empty, use Resend REST API
        if resend_api_key and resend_api_key.startswith('re_'):
            backend_used = 'resend_api'
            try:
                headers = {
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "from": f"OyoPasal Notifications <{sender}>" if '<' not in sender else sender,
                    "to": [to_email],
                    "subject": subject,
                    "html": html_content,
                    "text": text_content or ""
                }
                resp = requests.post(cls.RESEND_API_ENDPOINT, json=payload, headers=headers, timeout=10)
                if resp.status_code in [200, 201, 202]:
                    logger.info("Successfully dispatched email via Resend API to %s for subject '%s'", to_email, subject)
                    return True, resp.text, backend_used
                else:
                    error_msg = f"Resend API error (status {resp.status_code}): {resp.text}"
                    logger.warning(error_msg)
                    return False, error_msg, backend_used
            except Exception as ex:
                error_msg = f"Resend HTTP request exception: {str(ex)}"
                logger.exception(error_msg)
                return False, error_msg, backend_used

        # Otherwise fallback to Django configured email backend (Console in dev, Locmem in tests)
        try:
            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content or "Please enable HTML viewing to review your order notification.",
                from_email=f"OyoPasal Notifications <{sender}>" if '<' not in sender else sender,
                to=[to_email]
            )
            email_msg.attach_alternative(html_content, "text/html")
            email_msg.send(fail_silently=False)
            logger.info("Successfully dispatched email via Django backend (%s) to %s", getattr(settings, 'EMAIL_BACKEND', 'console'), to_email)
            return True, "Delivered via Django EmailBackend", backend_used
        except Exception as ex:
            error_msg = f"Django send_mail exception: {str(ex)}"
            logger.warning(error_msg)
            return False, error_msg, backend_used


class VendorOrderNotificationService:
    """
    Automated Multi-Vendor Order Notification Engine.
    Dispatches individualized, vendor-isolated order notifications.
    """

    @classmethod
    def notify_vendors_for_order(cls, order_or_id, force_resend: bool = False) -> list[dict]:
        """
        Processes an order and dispatches separated notification emails to each vendor.
        Returns a list of summary dicts detailing each suborder's notification outcome.
        Fail-safe: Never raises unhandled exceptions to prevent interrupting checkout.
        """
        results = []
        try:
            # 1. Fetch Order with complete vendor hierarchy
            if isinstance(order_or_id, (str, int)):
                try:
                    order = Order.objects.select_related('customer').prefetch_related(
                        'suborders',
                        'suborders__vendor',
                        'suborders__vendor__user',
                        'suborders__store',
                        'suborders__items',
                        'suborders__items__variant',
                        'suborders__items__variant__product'
                    ).get(id=order_or_id)
                except Order.DoesNotExist:
                    logger.error("Cannot send vendor notifications: Order %s not found.", order_or_id)
                    return [{'success': False, 'error': f"Order {order_or_id} not found"}]
            else:
                order = order_or_id

            # 2. Eligibility checks
            if order.status in [OrderStatus.FAILED, OrderStatus.CANCELLED]:
                logger.info("Skipping vendor notification for non-confirmed Order %s (status: %s)", order.order_number, order.status)
                return [{'success': False, 'skipped': True, 'reason': f"Order status is {order.status}"}]

            # Respect payment rules:
            # Online payments should only notify if confirmed/paid or order confirmed
            if order.payment_method not in ['COD', 'CASH_ON_DELIVERY', 'CASH']:
                if order.payment_status != 'PAID' and order.status not in [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED]:
                    logger.info("Skipping vendor notification for unpaid online Order %s (payment_status: %s, status: %s)", order.order_number, order.payment_status, order.status)
                    return [{'success': False, 'skipped': True, 'reason': f"Online payment not confirmed yet ({order.payment_status})"}]

            suborders = list(order.suborders.all())
            if not suborders:
                logger.warning("Order %s has no vendor suborders.", order.order_number)
                return [{'success': False, 'error': "No vendor suborders found"}]

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')

            # Extract snapshot customer address info safely
            snap = order.shipping_address_snapshot if isinstance(order.shipping_address_snapshot, dict) else {}
            customer = order.customer
            cust_name = snap.get('recipient_name') or (getattr(customer, 'first_name', '') + ' ' + getattr(customer, 'last_name', '')).strip() or 'Customer'
            cust_phone = snap.get('recipient_phone') or getattr(customer, 'phone_number', '') or ''

            # Format human-readable address
            addr_parts = [
                snap.get('tole_street') or snap.get('street', ''),
                snap.get('municipality') or snap.get('area', ''),
                snap.get('district') or snap.get('city', ''),
                snap.get('province', '')
            ]
            delivery_address = ", ".join([str(p).strip() for p in addr_parts if str(p).strip()]) or "Customer Delivery Location"
            customer_notes = (order.customer_notes or snap.get('landmark', '')).strip()

            order_date_formatted = timezone.localtime(order.created_at).strftime("%d %b %Y, %I:%M %p") if order.created_at else timezone.now().strftime("%d %b %Y, %I:%M %p")

            # 3. Process each vendor independently (Multi-Vendor Isolation)
            for sub_order in suborders:
                vendor = sub_order.vendor
                store = sub_order.store

                if not vendor:
                    logger.warning("Sub-order %s has no vendor assigned. Skipping.", sub_order.sub_order_number)
                    continue

                store_name = (store.name if store and store.name else None) or vendor.business_name or 'Valued Merchant'

                # Resolve trusted vendor email from backend relationship
                recipient_email = (store.contact_email if store and store.contact_email else None) or (vendor.user.email if vendor.user and vendor.user.email else None)
                recipient_email = (recipient_email or '').strip().lower()

                idempotency_key = f"VNOTIF_{order.order_number}_{sub_order.sub_order_number}"

                # Idempotency check: prevent duplicate notifications
                existing_log = VendorOrderNotificationLog.objects.filter(idempotency_key=idempotency_key).first()
                if existing_log and existing_log.status == VendorOrderNotificationLog.NotificationStatus.SENT and not force_resend:
                    logger.info("Notification for %s already successfully sent on %s. Skipping duplicate.", idempotency_key, existing_log.sent_at)
                    results.append({
                        'sub_order_number': sub_order.sub_order_number,
                        'vendor': vendor.business_name,
                        'status': 'ALREADY_SENT',
                        'skipped': True
                    })
                    continue

                # Validate email syntax
                is_email_valid = True
                if not recipient_email:
                    is_email_valid = False
                else:
                    try:
                        validate_email(recipient_email)
                    except ValidationError:
                        is_email_valid = False

                if not is_email_valid:
                    error_msg = f"Vendor '{store_name}' has no valid email address configured (found: '{recipient_email}')."
                    logger.error(error_msg)
                    VendorOrderNotificationLog.objects.update_or_create(
                        idempotency_key=idempotency_key,
                        defaults={
                            'order': order,
                            'sub_order': sub_order,
                            'vendor': vendor,
                            'store': store,
                            'recipient_email': recipient_email or 'invalid-vendor-email@oyopasal.local',
                            'subject': f"New Order Received – Order #{sub_order.sub_order_number}",
                            'status': VendorOrderNotificationLog.NotificationStatus.FAILED,
                            'error_message': error_msg,
                            'items_count': sub_order.items.count(),
                            'vendor_subtotal': sub_order.subtotal,
                        }
                    )
                    results.append({
                        'sub_order_number': sub_order.sub_order_number,
                        'vendor': vendor.business_name,
                        'status': 'FAILED',
                        'error': error_msg
                    })
                    continue

                # Compile vendor-isolated items
                items_data = []
                for order_item in sub_order.items.all():
                    # Resolve product image if available
                    prod = getattr(order_item.variant, 'product', None) if order_item.variant else None
                    img_url = ""
                    if prod and getattr(prod, 'primary_image', None):
                        img_url = prod.primary_image
                    elif prod and getattr(prod, 'thumbnail', None):
                        img_url = prod.thumbnail
                    elif prod and getattr(prod, 'image', None):
                        try:
                            img_url = prod.image.url
                        except Exception:
                            img_url = ""

                    attrs = getattr(order_item, 'attributes_snapshot', {}) or {}
                    attr_parts = [f"{k.capitalize()}: {v}" for k, v in attrs.items() if v and k not in ['id', 'sku']]
                    attr_str = " • ".join(attr_parts) if attr_parts else ""

                    items_data.append({
                        'product_name': escape(order_item.product_name),
                        'variant_sku': escape(order_item.variant_sku or ''),
                        'quantity': order_item.quantity,
                        'unit_price': f"{order_item.unit_price:.2f}",
                        'total_price': f"{order_item.total_price:.2f}",
                        'image_url': img_url,
                        'attributes_str': escape(attr_str)
                    })

                # Direct authenticated Vendor Dashboard deep link
                dashboard_order_url = f"{frontend_url}/seller?tab=orders&order_id={sub_order.sub_order_number}"

                email_subject = f"New Order Received – Order #{sub_order.sub_order_number}"

                context = {
                    'store_name': escape(store_name),
                    'sub_order_number': sub_order.sub_order_number,
                    'order_number': order.order_number,
                    'order_date': order_date_formatted,
                    'payment_method': order.payment_method,
                    'payment_status': order.payment_status,
                    'fulfillment_status': sub_order.get_status_display() if hasattr(sub_order, 'get_status_display') else sub_order.status,
                    'recipient_name': escape(cust_name),
                    'recipient_phone': escape(cust_phone),
                    'delivery_address': escape(delivery_address),
                    'customer_notes': escape(customer_notes),
                    'items': items_data,
                    'vendor_subtotal': f"{sub_order.subtotal:.2f}",
                    'delivery_fee': f"{sub_order.delivery_fee:.2f}",
                    'vendor_net_amount': f"{sub_order.vendor_net_amount:.2f}" if sub_order.vendor_net_amount else f"{sub_order.subtotal:.2f}",
                    'dashboard_order_url': dashboard_order_url,
                }

                # Render HTML and plain text templates
                html_body = render_to_string('emails/vendor_new_order.html', context)
                text_body = render_to_string('emails/vendor_new_order.txt', context)

                # Send email via Dispatcher
                is_sent, dispatch_resp, backend_used = VendorEmailDispatcher.send(
                    to_email=recipient_email,
                    subject=email_subject,
                    html_content=html_body,
                    text_content=text_body
                )

                # Create or update notification log
                log_entry, _ = VendorOrderNotificationLog.objects.update_or_create(
                    idempotency_key=idempotency_key,
                    defaults={
                        'order': order,
                        'sub_order': sub_order,
                        'vendor': vendor,
                        'store': store,
                        'recipient_email': recipient_email,
                        'sender_email': getattr(settings, 'DEFAULT_FROM_EMAIL', 'notifications@oyopasal.com'),
                        'subject': email_subject,
                        'status': VendorOrderNotificationLog.NotificationStatus.SENT if is_sent else VendorOrderNotificationLog.NotificationStatus.FAILED,
                        'sent_at': timezone.now() if is_sent else None,
                        'error_message': "" if is_sent else str(dispatch_resp),
                        'items_count': len(items_data),
                        'vendor_subtotal': sub_order.subtotal,
                        'provider_response': {'backend': backend_used, 'response': str(dispatch_resp)}
                    }
                )

                results.append({
                    'sub_order_number': sub_order.sub_order_number,
                    'vendor': vendor.business_name,
                    'recipient_email': recipient_email,
                    'status': 'SENT' if is_sent else 'FAILED',
                    'backend': backend_used,
                    'log_id': str(log_entry.id)
                })

        except Exception as ex:
            logger.exception("Critical error during vendor order notifications execution: %s", ex)
            results.append({'success': False, 'error': str(ex)})

        return results

    @classmethod
    def retry_failed_notifications(cls, max_retries: int = 3) -> int:
        """
        Retries failed notifications that have not exceeded max_retries.
        """
        failed_logs = VendorOrderNotificationLog.objects.filter(
            status=VendorOrderNotificationLog.NotificationStatus.FAILED,
            retry_count__lt=max_retries
        ).select_related('order', 'sub_order')

        retried_count = 0
        for log in failed_logs:
            try:
                log.retry_count += 1
                res = cls.notify_vendors_for_order(log.order, force_resend=True)
                retried_count += 1
            except Exception as e:
                logger.warning("Retry failed for notification log %s: %s", log.id, e)
                log.error_message = f"Retry attempt {log.retry_count} failed: {str(e)}"
                log.save(update_fields=['retry_count', 'error_message', 'updated_at'])

        return retried_count
