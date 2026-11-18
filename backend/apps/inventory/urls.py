from django.urls import path
from apps.inventory.views import (
    VendorInventoryListView,
    VendorInventoryDetailView,
    StockAdjustmentView,
    LowStockAlertsView,
    StockMovementHistoryView,
)

app_name = 'inventory'

urlpatterns = [
    path('', VendorInventoryListView.as_view(), name='inventory_list_create'),
    path('alerts/low-stock/', LowStockAlertsView.as_view(), name='low_stock_alerts'),
    path('<uuid:id>/', VendorInventoryDetailView.as_view(), name='inventory_detail'),
    path('<uuid:id>/adjust/', StockAdjustmentView.as_view(), name='inventory_adjust'),
    path('<uuid:id>/movements/', StockMovementHistoryView.as_view(), name='inventory_movements'),
]

