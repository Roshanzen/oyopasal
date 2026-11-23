from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import (
    SupplierProfileView,
    SupplierDocumentUploadView,
    SupplierDashboardOverviewView,
    AdminSupplierKYCListView,
    AdminSupplierVerifyView,
    SupplierStaffViewSet,
)

app_name = 'suppliers'

router = SimpleRouter()
router.register(r'staff', SupplierStaffViewSet, basename='supplier-staff')

urlpatterns = [
    path('profile/', SupplierProfileView.as_view(), name='supplier_profile'),
    path('documents/', SupplierDocumentUploadView.as_view(), name='supplier_documents'),
    path('dashboard/overview/', SupplierDashboardOverviewView.as_view(), name='supplier_dashboard_overview'),
    # Administrative verification routes
    path('admin/kyc/', AdminSupplierKYCListView.as_view(), name='admin_supplier_kyc_list'),
    path('admin/<uuid:pk>/verify/', AdminSupplierVerifyView.as_view(), name='admin_supplier_verify'),
    path('', include(router.urls)),
]

