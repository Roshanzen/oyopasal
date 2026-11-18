from django.urls import path
from apps.vendors.seller_views import (
    SellerDashboardView,
    SellerAnalyticsView,
    SellerProductsView,
    SellerProductDetailView,
    SellerToggleStockView,
    SellerRestockView,
    SellerOrdersView,
    SellerOrderStatusView,
    SellerStoreView,
    SellerReviewsView,
    SellerInventoryMovementsView,
)

app_name = 'seller'

urlpatterns = [
    path('dashboard/', SellerDashboardView.as_view(), name='dashboard'),
    path('analytics/', SellerAnalyticsView.as_view(), name='analytics'),
    path('products/', SellerProductsView.as_view(), name='products'),
    path('products/<str:id>/', SellerProductDetailView.as_view(), name='product_detail'),
    path('products/<str:id>/toggle-stock/', SellerToggleStockView.as_view(), name='product_toggle_stock'),
    path('products/<str:id>/restock/', SellerRestockView.as_view(), name='product_restock'),
    path('orders/', SellerOrdersView.as_view(), name='orders'),
    path('orders/<int:fulfillment_id>/status/', SellerOrderStatusView.as_view(), name='order_status'),
    path('store/', SellerStoreView.as_view(), name='store'),
    path('reviews/', SellerReviewsView.as_view(), name='reviews'),
    path('inventory/movements/', SellerInventoryMovementsView.as_view(), name='inventory_movements'),
    path('inventory-movements/', SellerInventoryMovementsView.as_view(), name='inventory_movements_alias'),
]
