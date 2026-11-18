from django.urls import path
from apps.stores.views import (
    PublicStoreListView,
    PublicStoreDetailView,
    VendorStoreListCreateView,
    VendorStoreDetailView,
    CurrentVendorStoreView,
)

app_name = 'stores'

urlpatterns = [
    # Authenticated vendor primary store routes
    path('me/', CurrentVendorStoreView.as_view(), name='vendor_store_me'),
    path('vendor/me/', CurrentVendorStoreView.as_view(), name='vendor_store_me_alias'),

    # Public routes
    path('', PublicStoreListView.as_view(), name='public_store_list'),
    path('<slug:slug>/', PublicStoreDetailView.as_view(), name='public_store_detail'),

    # Vendor routes
    path('vendor/my-stores/', VendorStoreListCreateView.as_view(), name='vendor_store_list_create'),
    path('vendor/my-stores/<uuid:id>/', VendorStoreDetailView.as_view(), name='vendor_store_detail'),
]

