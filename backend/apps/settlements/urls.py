from django.urls import path
from apps.settlements.views import (
    VendorSettlementListView,
    AdminSettlementListView,
    AdminGenerateSettlementView,
    AdminMarkSettlementPaidView,
)

app_name = 'settlements'

urlpatterns = [
    path('vendor/my-settlements/', VendorSettlementListView.as_view(), name='vendor_settlement_list'),
    path('admin/all/', AdminSettlementListView.as_view(), name='admin_settlement_list'),
    path('admin/generate/', AdminGenerateSettlementView.as_view(), name='admin_generate_settlement'),
    path('admin/<uuid:id>/mark-paid/', AdminMarkSettlementPaidView.as_view(), name='admin_mark_settlement_paid'),
]

