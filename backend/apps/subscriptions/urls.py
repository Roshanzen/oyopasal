from django.urls import path
from .views import (
    PublicSubscriptionPlansView,
    TenantCurrentSubscriptionView,
    SubscribeOrUpgradeView,
    CancelSubscriptionView,
    SubscriptionInvoicesListView,
    AdminSubscriptionPlansView,
)

app_name = 'subscriptions'

urlpatterns = [
    path('plans/', PublicSubscriptionPlansView.as_view(), name='plans_list'),
    path('current/', TenantCurrentSubscriptionView.as_view(), name='current_subscription'),
    path('subscribe/', SubscribeOrUpgradeView.as_view(), name='subscribe_or_upgrade'),
    path('cancel/', CancelSubscriptionView.as_view(), name='cancel_subscription'),
    path('invoices/', SubscriptionInvoicesListView.as_view(), name='invoices_list'),
    path('admin/plans/', AdminSubscriptionPlansView.as_view(), name='admin_plans'),
]

