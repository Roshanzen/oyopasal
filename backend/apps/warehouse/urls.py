from django.urls import path
from apps.warehouse.views import WarehouseListCreateView, WarehouseDetailView

app_name = 'warehouse'

urlpatterns = [
    path('', WarehouseListCreateView.as_view(), name='warehouse_list_create'),
    path('<uuid:id>/', WarehouseDetailView.as_view(), name='warehouse_detail'),
]

