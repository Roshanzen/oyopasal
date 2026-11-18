from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.common.permissions import IsVendor, IsSupplier, IsSuperAdmin
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    SupplierInvoice
)
from apps.procurement.serializers import (
    SupplierProductSerializer,
    QuotationRequestSerializer,
    SupplierQuotationSerializer,
    PurchaseOrderSerializer,
    SupplierInvoiceSerializer,
    CreateRFQSerializer,
    SubmitQuotationSerializer,
    AcceptQuotationSerializer,
    ProcessGRNSerializer,
    DispatchPOSerializer,
)
from apps.procurement.services import ProcurementService

class WholesaleProductListView(generics.ListAPIView):
    """Wholesale marketplace catalog where vendors discover bulk products."""
    serializer_class = SupplierProductSerializer
    permission_classes = [IsVendor | IsSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'sku', 'supplier__company_name']
    ordering_fields = ['wholesale_price', 'created_at']

    def get_queryset(self):
        return SupplierProduct.objects.filter(is_active=True, supplier__status='APPROVED').select_related('supplier', 'category')

    @extend_schema(summary="Browse Wholesale Catalog (Vendor)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class SupplierProductManageView(generics.ListCreateAPIView):
    """Supplier portal for creating and managing wholesale products."""
    serializer_class = SupplierProductSerializer
    permission_classes = [IsSupplier]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SupplierProduct.objects.none()
        user = self.request.user
        if not hasattr(user, 'supplier_profile'):
            return SupplierProduct.objects.none()
        return SupplierProduct.objects.filter(supplier=user.supplier_profile)

    def perform_create(self, serializer):
        from django.utils.text import slugify
        name = serializer.validated_data['name']
        base_slug = slugify(name) or 'sup-prod'
        serializer.save(
            supplier=self.request.user.supplier_profile,
            slug=f"{base_slug}-{self.request.user.supplier_profile.id.hex[:6]}"
        )


class VendorRFQListCreateView(APIView):
    """Vendors view their submitted RFQs or create a new quotation request."""
    permission_classes = [IsVendor]

    @extend_schema(summary="List Vendor RFQs", responses={200: QuotationRequestSerializer(many=True)})
    def get(self, request):
        rfqs = QuotationRequest.objects.filter(vendor=request.user.vendor_profile).select_related('supplier', 'product')
        return Response({
            'success': True,
            'data': QuotationRequestSerializer(rfqs, many=True).data
        })

    @extend_schema(summary="Submit RFQ to Supplier", request=CreateRFQSerializer, responses={201: QuotationRequestSerializer})
    def post(self, request):
        serializer = CreateRFQSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            prod = SupplierProduct.objects.get(id=serializer.validated_data['product_id'])
            rfq = ProcurementService.create_rfq(
                vendor=request.user.vendor_profile,
                product=prod,
                quantity=serializer.validated_data['quantity'],
                target_price=serializer.validated_data.get('target_price'),
                notes=serializer.validated_data.get('notes', '')
            )
            return Response({
                'success': True,
                'message': 'RFQ submitted to supplier.',
                'data': QuotationRequestSerializer(rfq).data
            }, status=status.HTTP_201_CREATED)
        except (SupplierProduct.DoesNotExist, ValueError) as e:
            return Response({
                'success': False,
                'error': {'code': 'RFQ_FAILED', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class SupplierRFQListView(generics.ListAPIView):
    """Supplier view of quotation requests submitted by vendors."""
    serializer_class = QuotationRequestSerializer
    permission_classes = [IsSupplier]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return QuotationRequest.objects.none()
        user = self.request.user
        if not hasattr(user, 'supplier_profile'):
            return QuotationRequest.objects.none()
        return QuotationRequest.objects.filter(supplier=user.supplier_profile).select_related('vendor', 'product')


class SupplierSubmitQuotationView(APIView):
    """Supplier submits formal quotation in response to an RFQ."""
    permission_classes = [IsSupplier]

    @extend_schema(
        summary="Submit Quotation (Supplier)",
        request=SubmitQuotationSerializer,
        responses={201: SupplierQuotationSerializer}
    )
    def post(self, request, rfq_id):
        serializer = SubmitQuotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            quote = ProcurementService.submit_quotation(
                supplier=request.user.supplier_profile,
                rfq_id=rfq_id,
                unit_price=serializer.validated_data['unit_price'],
                lead_time_days=serializer.validated_data.get('lead_time_days', 3),
                validity_days=serializer.validated_data.get('validity_days', 14),
                remarks=serializer.validated_data.get('remarks', '')
            )
            return Response({
                'success': True,
                'message': 'Quotation submitted to vendor.',
                'data': SupplierQuotationSerializer(quote).data
            }, status=status.HTTP_201_CREATED)
        except (QuotationRequest.DoesNotExist, ValueError) as e:
            return Response({
                'success': False,
                'error': {'code': 'QUOTATION_FAILED', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class VendorAcceptQuotationView(APIView):
    """Vendor accepts quotation and issues official Purchase Order (PO)."""
    permission_classes = [IsVendor]

    @extend_schema(
        summary="Accept Quotation & Issue Purchase Order (Vendor)",
        request=AcceptQuotationSerializer,
        responses={201: PurchaseOrderSerializer}
    )
    def post(self, request, quotation_id):
        serializer = AcceptQuotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            po = ProcurementService.accept_quotation_and_create_po(
                vendor=request.user.vendor_profile,
                quotation_id=quotation_id,
                warehouse_id=serializer.validated_data['destination_warehouse_id'],
                payment_terms=serializer.validated_data.get('payment_terms', '30_DAYS_CREDIT'),
                notes=serializer.validated_data.get('notes', '')
            )
            return Response({
                'success': True,
                'message': f"Purchase Order {po.po_number} issued to supplier.",
                'data': PurchaseOrderSerializer(po).data
            }, status=status.HTTP_201_CREATED)
        except (SupplierQuotation.DoesNotExist, ValueError) as e:
            return Response({
                'success': False,
                'error': {'code': 'PO_CREATION_FAILED', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class SupplierPOListView(generics.ListAPIView):
    """Supplier view of Purchase Orders issued by vendors."""
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsSupplier]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['po_number', 'vendor__business_name']
    ordering_fields = ['created_at', 'grand_total']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return PurchaseOrder.objects.none()
        user = self.request.user
        if not hasattr(user, 'supplier_profile'):
            return PurchaseOrder.objects.none()
        return PurchaseOrder.objects.filter(supplier=user.supplier_profile).select_related('vendor', 'destination_warehouse').prefetch_related('items')


class SupplierInvoiceListView(generics.ListAPIView):
    """Supplier view of wholesale commercial invoices and payment statuses."""
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [IsSupplier]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'vendor__business_name']
    ordering_fields = ['created_at', 'billed_amount']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SupplierInvoice.objects.none()
        user = self.request.user
        if not hasattr(user, 'supplier_profile'):
            return SupplierInvoice.objects.none()
        return SupplierInvoice.objects.filter(supplier=user.supplier_profile).select_related('vendor', 'purchase_order')


class SupplierDispatchPOView(APIView):
    """Supplier confirms and dispatches Purchase Order with tracking."""
    permission_classes = [IsSupplier]

    @extend_schema(
        summary="Dispatch Purchase Order (Supplier)",
        request=DispatchPOSerializer,
        responses={200: PurchaseOrderSerializer}
    )
    def post(self, request, id):
        serializer = DispatchPOSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tracking_number = serializer.validated_data.get('tracking_number', 'SUP-EXP-TRACK')
        try:
            po = ProcurementService.confirm_and_dispatch_po(
                supplier=request.user.supplier_profile,
                po_id=id,
                tracking_number=tracking_number
            )
            return Response({
                'success': True,
                'message': f"PO {po.po_number} dispatched.",
                'data': PurchaseOrderSerializer(po).data
            })
        except PurchaseOrder.DoesNotExist:
            return Response({'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'PO not found.'}}, status=status.HTTP_404_NOT_FOUND)


class VendorProcessGRNView(APIView):
    """
    Vendor receives bulk delivery, verifies accepted vs damaged goods,
    automatically updates warehouse inventory, and generates supplier invoice.
    """
    permission_classes = [IsVendor]

    @extend_schema(
        summary="Process Goods Receipt Note (GRN) & Stock Intake",
        request=ProcessGRNSerializer,
        responses={200: dict}
    )
    def post(self, request, id):
        serializer = ProcessGRNSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            grn = ProcurementService.process_goods_receipt(
                vendor=request.user.vendor_profile,
                po_id=id,
                accepted_items=serializer.validated_data['accepted_items'],
                damaged_items=serializer.validated_data.get('damaged_items', {}),
                missing_items=serializer.validated_data.get('missing_items', {}),
                user=request.user,
                remarks=serializer.validated_data.get('remarks', '')
            )
            return Response({
                'success': True,
                'message': f"Goods received verified. Inventory updated via GRN {grn.grn_number}.",
                'data': {
                    'grn_number': grn.grn_number,
                    'po_number': grn.purchase_order.po_number,
                    'invoice_number': grn.purchase_order.invoice.invoice_number,
                    'billed_amount': str(grn.purchase_order.invoice.billed_amount)
                }
            })
        except (PurchaseOrder.DoesNotExist, ValueError) as e:
            return Response({
                'success': False,
                'error': {'code': 'GRN_FAILED', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)
