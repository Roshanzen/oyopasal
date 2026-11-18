from django.urls import path
from .views import (
    AdminDashboardKPIView,
    AdminSalesTrendsView,
    AdminTopVendorsView,
    AdminTopProductsView,
)

app_name = 'analytics'

urlpatterns = [
    path('admin/kpis/', AdminDashboardKPIView.as_view(), name='admin_kpis'),
    path('admin/sales-trends/', AdminSalesTrendsView.as_view(), name='admin_sales_trends'),
    path('admin/top-vendors/', AdminTopVendorsView.as_view(), name='admin_top_vendors'),
    path('admin/top-products/', AdminTopProductsView.as_view(), name='admin_top_products'),
]

