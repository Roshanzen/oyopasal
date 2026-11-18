from django.urls import path
from apps.orders.views import (
    CustomerCheckoutView,
    CustomerOrderListView,
    CustomerOrderDetailView,
    CustomerOrderListCreateView,
    CustomerOrderCancelView,
    CustomerOrderReorderView,
    CustomerOrderRefundView,
    VendorSubOrderListView,
    VendorSubOrderDetailView,
    VendorSubOrderTransitionView,
    AdminOrderListView,
)

app_name = 'orders'

urlpatterns = [
    # Customer Orders Frontend Routes
    path('', CustomerOrderListCreateView.as_view(), name='orders_list_create'),
    path('checkout/', CustomerCheckoutView.as_view(), name='checkout'),
    path('my-orders/', CustomerOrderListView.as_view(), name='customer_order_list'),
    path('my-orders/<uuid:id>/', CustomerOrderDetailView.as_view(), name='customer_order_detail'),
    path('<uuid:id>/', CustomerOrderDetailView.as_view(), name='order_detail'),
    path('<uuid:id>/cancel/', CustomerOrderCancelView.as_view(), name='order_cancel'),
    path('<uuid:id>/reorder/', CustomerOrderReorderView.as_view(), name='order_reorder'),
    path('<uuid:id>/refund/', CustomerOrderRefundView.as_view(), name='order_refund'),

    # Vendor Fulfillment Sub-Orders (supporting both slashed and hyphenated paths)
    path('vendor/suborders/', VendorSubOrderListView.as_view(), name='vendor_suborder_list'),
    path('vendor/suborders/<uuid:id>/', VendorSubOrderDetailView.as_view(), name='vendor_suborder_detail'),
    path('vendor/suborders/<uuid:id>/transition/', VendorSubOrderTransitionView.as_view(), name='vendor_suborder_transition'),
    path('vendor-suborders/', VendorSubOrderListView.as_view(), name='vendor_suborder_list_alias'),
    path('vendor-suborders/<uuid:id>/', VendorSubOrderDetailView.as_view(), name='vendor_suborder_detail_alias'),
    path('vendor-suborders/<uuid:id>/transition/', VendorSubOrderTransitionView.as_view(), name='vendor_suborder_transition_alias'),

    # Admin All Orders
    path('admin/all/', AdminOrderListView.as_view(), name='admin_order_list'),
]

