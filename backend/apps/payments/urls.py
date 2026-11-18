from django.urls import path
from apps.payments.views import (
    PaymentInitiateView,
    PaymentVerifyView,
    AdminLedgerListView,
)

app_name = 'payments'

urlpatterns = [
    path('initiate/', PaymentInitiateView.as_view(), name='initiate_payment'),
    path('verify/', PaymentVerifyView.as_view(), name='verify_payment'),
    path('admin/ledger/', AdminLedgerListView.as_view(), name='admin_ledger_list'),
]

