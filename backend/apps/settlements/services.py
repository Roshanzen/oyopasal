import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.settlements.models import VendorSettlement, SettlementItem, SettlementStatus
from apps.commissions.models import CommissionRecord
from apps.orders.models import VendorSubOrder, OrderStatus
from apps.payments.models import FinancialLedgerEntry, LedgerEntryType, DebitCredit

class SettlementService:
    @classmethod
    @transaction.atomic
    def generate_settlement_for_vendor(cls, vendor, user=None) -> VendorSettlement:
        """
        Consolidates eligible delivered vendor suborders into an official settlement batch.
        """
        # Find delivered suborders not yet settled
        unsettled_suborders = VendorSubOrder.objects.filter(
            vendor=vendor,
            status=OrderStatus.DELIVERED,
            commission_record__is_settled=False
        ).select_related('commission_record')

        if not unsettled_suborders.exists():
            raise ValueError(f"No unsettled delivered orders found for vendor {vendor.business_name}.")

        gross_total = Decimal('0.00')
        commission_total = Decimal('0.00')
        net_total = Decimal('0.00')

        suborder_list = list(unsettled_suborders)
        for sub in suborder_list:
            gross_total += sub.subtotal
            commission_total += sub.commission_amount
            net_total += sub.vendor_net_amount

        settlement_num = f"SETTLE-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        settlement = VendorSettlement.objects.create(
            settlement_number=settlement_num,
            vendor=vendor,
            status=SettlementStatus.APPROVED,
            gross_amount=gross_total,
            platform_commission=commission_total,
            net_payout=net_total,
            processed_by=user
        )

        for sub in suborder_list:
            SettlementItem.objects.create(
                settlement=settlement,
                sub_order=sub,
                amount=sub.vendor_net_amount
            )
            # Mark commission record as settled
            rec = sub.commission_record
            rec.is_settled = True
            rec.save(update_fields=['is_settled', 'updated_at'])

        return settlement

    @classmethod
    @transaction.atomic
    def mark_settlement_paid(cls, settlement_id, bank_reference: str, user=None) -> VendorSettlement:
        """
        Marks a vendor settlement as PAID, sets bank reference,
        and logs a debit in the financial ledger.
        """
        settlement = VendorSettlement.objects.select_for_update().get(id=settlement_id)
        if settlement.status == SettlementStatus.PAID:
            return settlement

        settlement.status = SettlementStatus.PAID
        settlement.bank_reference = bank_reference
        settlement.paid_at = timezone.now()
        settlement.processed_by = user
        settlement.save(update_fields=['status', 'bank_reference', 'paid_at', 'processed_by', 'updated_at'])

        # Financial Ledger Entry for Settlement Payout
        FinancialLedgerEntry.objects.create(
            entry_type=LedgerEntryType.SETTLEMENT_PAYOUT,
            direction=DebitCredit.DEBIT,
            amount=settlement.net_payout,
            vendor=settlement.vendor,
            reference_id=settlement.settlement_number,
            description=f"Bank payout to {settlement.vendor.business_name} via ref {bank_reference}"
        )

        return settlement

