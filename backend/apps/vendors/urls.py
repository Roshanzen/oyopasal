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
from .application_views import (
    SellerApplicationApplyView,
    SellerApplicationTrackView,
    AdminSellerApplicationListView,
    AdminSellerApplicationDetailView,
    AdminSellerApplicationStatusView,
    AdminSellerApplicationApproveView,
    AdminSellerApplicationRejectView,
    AdminSellerApplicationResendInviteView,
    VendorActivationVerifyView,
    VendorActivationSubmitView,
)

app_name = 'vendors'

router = SimpleRouter()
router.register(r'staff', VendorStaffViewSet, basename='vendor-staff')

urlpatterns = [
    # Seller Application & Activation
    path('applications/apply/', SellerApplicationApplyView.as_view(), name='application_apply'),
    path('applications/track/', SellerApplicationTrackView.as_view(), name='application_track'),
    path('admin/applications/', AdminSellerApplicationListView.as_view(), name='admin_applications_list'),
    path('admin/applications/<str:pk>/', AdminSellerApplicationDetailView.as_view(), name='admin_application_detail'),
    path('admin/applications/<str:pk>/status/', AdminSellerApplicationStatusView.as_view(), name='admin_application_status'),
    path('admin/applications/<str:pk>/approve/', AdminSellerApplicationApproveView.as_view(), name='admin_application_approve'),
    path('admin/applications/<str:pk>/reject/', AdminSellerApplicationRejectView.as_view(), name='admin_application_reject'),
    path('admin/applications/<str:pk>/resend-invitation/', AdminSellerApplicationResendInviteView.as_view(), name='admin_application_resend_invite'),
    path('activation/verify/', VendorActivationVerifyView.as_view(), name='activation_verify'),
    path('activation/activate/', VendorActivationSubmitView.as_view(), name='activation_submit'),

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

