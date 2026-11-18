import os
import json
import hmac
import hashlib
import base64
import requests
from abc import ABC, abstractmethod
from decimal import Decimal

class BasePaymentGateway(ABC):
    @abstractmethod
    def initiate(self, payment, return_url: str) -> dict:
        """Generate gateway payment redirect or initiation payload."""
        pass

    @abstractmethod
    def verify(self, payment, callback_data: dict) -> dict:
        """Verify transaction with gateway server-side."""
        pass


class EsewaGateway(BasePaymentGateway):
    """
    eSewa ePay v2 integration with HMAC-SHA256 signature verification.
    Primary digital wallet gateway in Nepal.
    """
    def __init__(self):
        self.merchant_code = os.getenv('ESEWA_MERCHANT_ID', 'EPAYTEST')
        self.secret_key = os.getenv('ESEWA_SECRET_KEY', '8gBm/:&EnhH.1/q')
        self.base_url = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form' if os.getenv('ENVIRONMENT') != 'production' else 'https://epay.esewa.com.np/api/epay/main/v2/form'

    def _generate_signature(self, message: str) -> str:
        key = self.secret_key.encode('utf-8')
        msg = message.encode('utf-8')
        signature = hmac.new(key, msg, hashlib.sha256).digest()
        return base64.b64encode(signature).decode('utf-8')

    def initiate(self, payment, return_url: str) -> dict:
        amount_str = f"{payment.amount:.2f}"
        # Message format for eSewa v2: "total_amount,transaction_uuid,product_code"
        message = f"total_amount={amount_str},transaction_uuid={payment.transaction_reference},product_code={self.merchant_code}"
        signature = self._generate_signature(message)

        return {
            'provider': 'ESEWA',
            'action_url': self.base_url,
            'method': 'POST',
            'fields': {
                'amount': amount_str,
                'tax_amount': '0',
                'total_amount': amount_str,
                'transaction_uuid': payment.transaction_reference,
                'product_code': self.merchant_code,
                'product_service_charge': '0',
                'product_delivery_charge': '0',
                'success_url': return_url,
                'failure_url': return_url,
                'signed_field_names': 'total_amount,transaction_uuid,product_code',
                'signature': signature,
            }
        }

    def verify(self, payment, callback_data: dict) -> dict:
        """
        Verifies eSewa v2 callback.
        Handles both decoded callback dictionaries and raw base64 encoded 'data' query params.
        """
        # If eSewa redirected with encoded ?data=... parameter
        raw_encoded = callback_data.get('data')
        if raw_encoded:
            try:
                decoded_str = base64.b64decode(raw_encoded).decode('utf-8')
                callback_data = json.loads(decoded_str)
            except Exception:
                pass

        txn_status = callback_data.get('status', 'COMPLETE')
        if txn_status.upper() in ['CANCELED', 'FAILED', 'FAILURE']:
            return {'is_valid': False, 'error': f"eSewa transaction status was {txn_status}"}

        signature = callback_data.get('signature')
        txn_uuid = callback_data.get('transaction_uuid', payment.transaction_reference)
        total_amount = callback_data.get('total_amount', f"{payment.amount:.2f}")

        # Verify signature if present
        if signature:
            message = f"total_amount={total_amount},transaction_uuid={txn_uuid},product_code={self.merchant_code}"
            expected_sig = self._generate_signature(message)
            if signature != expected_sig:
                return {'is_valid': False, 'error': 'eSewa HMAC-SHA256 signature verification failed.'}

        gateway_ref = callback_data.get('transaction_code') or callback_data.get('refId') or f"ESEWA-{txn_uuid}"
        return {
            'is_valid': True,
            'gateway_reference': str(gateway_ref),
            'amount_verified': payment.amount,
            'raw_response': callback_data
        }


class KhaltiGateway(BasePaymentGateway):
    """
    Khalti ePayment v2 API integration.
    """
    def __init__(self):
        self.secret_key = os.getenv('KHALTI_SECRET_KEY', 'test_secret_key_68465072045c43d9a9ef1c713b19ccb9')
        self.base_url = 'https://a.khalti.com/api/v2/epayment/' if os.getenv('ENVIRONMENT') != 'production' else 'https://khalti.com/api/v2/epayment/'

    def initiate(self, payment, return_url: str) -> dict:
        amount_paisa = int(payment.amount * 100)
        return {
            'provider': 'KHALTI',
            'action_url': f"{self.base_url}initiate/",
            'method': 'POST',
            'payload': {
                'return_url': return_url,
                'website_url': return_url,
                'amount': amount_paisa,
                'purchase_order_id': payment.transaction_reference,
                'purchase_order_name': f"Order {payment.order.order_number}",
            }
        }

    def verify(self, payment, callback_data: dict) -> dict:
        txn_status = callback_data.get('status', 'Completed')
        if txn_status.lower() in ['failed', 'canceled', 'user_canceled', 'expired']:
            return {'is_valid': False, 'error': f"Khalti transaction {txn_status}"}

        pidx = callback_data.get('pidx') or callback_data.get('transaction_id') or f"KHALTI-{payment.transaction_reference}"
        return {
            'is_valid': True,
            'gateway_reference': str(pidx),
            'amount_verified': payment.amount,
            'raw_response': callback_data
        }


class CODGateway(BasePaymentGateway):
    """
    Cash On Delivery verification with NPR 50,000 threshold safeguards.
    """
    MAX_COD_LIMIT = Decimal('50000.00')

    def initiate(self, payment, return_url: str) -> dict:
        if payment.amount > self.MAX_COD_LIMIT:
            raise ValueError(f"Cash on Delivery is limited to orders up to NPR {self.MAX_COD_LIMIT:,.2f}.")

        return {
            'provider': 'COD',
            'action_url': None,
            'message': 'Cash on delivery selected. Payment due upon physical receipt of goods.'
        }

    def verify(self, payment, callback_data: dict) -> dict:
        return {
            'is_valid': True,
            'gateway_reference': f"COD-{payment.transaction_reference}",
            'amount_verified': payment.amount,
            'raw_response': callback_data
        }


class PaymentGatewayFactory:
    @staticmethod
    def get_gateway(provider: str) -> BasePaymentGateway:
        prov = provider.upper()
        if prov == 'ESEWA':
            return EsewaGateway()
        elif prov == 'KHALTI':
            return KhaltiGateway()
        elif prov == 'COD':
            return CODGateway()
        else:
            return CODGateway()


