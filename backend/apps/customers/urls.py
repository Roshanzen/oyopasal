from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerProfileView, CustomerAddressViewSet

app_name = 'customers'

router = DefaultRouter()
router.register(r'addresses', CustomerAddressViewSet, basename='customer-address')

urlpatterns = [
    path('me/', CustomerProfileView.as_view(), name='customer_profile_me'),
    path('', include(router.urls)),
]

