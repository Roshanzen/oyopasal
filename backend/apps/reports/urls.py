from django.urls import path
from .views import (
    SalesReportCSVView,
    TaxReportCSVView,
    SettlementsReportCSVView,
    InventoryReportCSVView,
)

app_name = 'reports'

urlpatterns = [
    path('sales/csv/', SalesReportCSVView.as_view(), name='sales_csv'),
    path('tax/csv/', TaxReportCSVView.as_view(), name='tax_csv'),
    path('settlements/csv/', SettlementsReportCSVView.as_view(), name='settlements_csv'),
    path('inventory/csv/', InventoryReportCSVView.as_view(), name='inventory_csv'),
]

