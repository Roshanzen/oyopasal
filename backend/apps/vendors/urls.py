from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    PublicVendorListView,
    PublicVendorRegisterView,
    VendorProfileView,
    VendorDocumentUploadView,
    VendorDashboardOverviewView,
    VendorSalesTrendsView,
    VendorTopProductsView,
    AdminVendorKYCListView,
    AdminVendorVerifyView,
    VendorStaffViewSet,
)

app_name = 'vendors'

router = SimpleRouter()
router.register(r'staff', VendorStaffViewSet, basename='vendor-staff')

urlpatterns = [
    path('', PublicVendorListView.as_view(), name='public_vendor_list'),
    path('register/', PublicVendorRegisterView.as_view(), name='vendor_register'),
    path('me/', VendorProfileView.as_view(), name='vendor_me'),
    path('profile/', VendorProfileView.as_view(), name='vendor_profile'),
    path('documents/', VendorDocumentUploadView.as_view(), name='vendor_documents'),
    path('dashboard/overview/', VendorDashboardOverviewView.as_view(), name='vendor_dashboard_overview'),
    path('dashboard/sales-trends/', VendorSalesTrendsView.as_view(), name='vendor_sales_trends'),
    path('dashboard/top-products/', VendorTopProductsView.as_view(), name='vendor_top_products'),
    # Administrative KYC routes
    path('admin/kyc/', AdminVendorKYCListView.as_view(), name='admin_vendor_kyc_list'),
    path('admin/<uuid:pk>/verify-kyc/', AdminVendorVerifyView.as_view(), name='admin_vendor_verify_kyc'),
    path('', include(router.urls)),
]

