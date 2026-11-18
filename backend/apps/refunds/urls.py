from django.urls import path
from apps.refunds.views import (
    CustomerRefundRequestView,
    AdminRefundListView,
    AdminRefundActionView,
)

app_name = 'refunds'

urlpatterns = [
    # Customer Refund Endpoints
    path('request/', CustomerRefundRequestView.as_view(), name='customer_refund_request'),

    # Admin Refund Management
    path('admin/all/', AdminRefundListView.as_view(), name='admin_refund_list'),
    path('admin/<uuid:id>/action/', AdminRefundActionView.as_view(), name='admin_refund_action'),
]

