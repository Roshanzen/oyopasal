from django.urls import path
from apps.delivery.views import (
    PublicDeliveryZoneListView,
    CheckDeliveryServiceabilityView,
    AdminDeliveryZoneListCreateView,
)

app_name = 'delivery'

urlpatterns = [
    path('zones/', PublicDeliveryZoneListView.as_view(), name='public_zone_list'),
    path('check-serviceability/', CheckDeliveryServiceabilityView.as_view(), name='check_serviceability'),
    path('admin/zones/', AdminDeliveryZoneListCreateView.as_view(), name='admin_zone_list_create'),
]

