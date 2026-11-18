from django.urls import path
from apps.procurement.views import (
    WholesaleProductListView,
    SupplierProductManageView,
    SupplierPOListView,
    SupplierInvoiceListView,
    VendorRFQListCreateView,
    SupplierRFQListView,
    SupplierSubmitQuotationView,
    VendorAcceptQuotationView,
    SupplierDispatchPOView,
    VendorProcessGRNView,
)

app_name = 'procurement'

urlpatterns = [
    # Wholesale Marketplace
    path('wholesale/products/', WholesaleProductListView.as_view(), name='wholesale_products'),
    path('supplier/products/', SupplierProductManageView.as_view(), name='supplier_product_manage'),

    # RFQ & Quotations
    path('rfqs/', VendorRFQListCreateView.as_view(), name='vendor_rfqs'),
    path('supplier/rfqs/', SupplierRFQListView.as_view(), name='supplier_rfqs'),
    path('supplier/rfqs/<uuid:rfq_id>/quote/', SupplierSubmitQuotationView.as_view(), name='supplier_submit_quote'),
    path('quotations/<uuid:quotation_id>/accept/', VendorAcceptQuotationView.as_view(), name='vendor_accept_quote'),

    # Purchase Orders & Fulfillment
    path('supplier/pos/', SupplierPOListView.as_view(), name='supplier_pos'),
    path('supplier/invoices/', SupplierInvoiceListView.as_view(), name='supplier_invoices'),
    path('supplier/pos/<uuid:id>/dispatch/', SupplierDispatchPOView.as_view(), name='supplier_dispatch_po'),
    path('vendor/pos/<uuid:id>/grn/', VendorProcessGRNView.as_view(), name='vendor_process_grn'),
]

