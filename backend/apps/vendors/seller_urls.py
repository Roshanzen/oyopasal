from django.urls import path
from apps.delivery.views import OrderDeliveryTrackingView
from apps.vendors.store_profile_views import SellerStoreProfileView
from apps.vendors.seller_views import (
    SellerDashboardView,
    SellerAnalyticsView,
    SellerProductsView,
    SellerProductDetailView,
    SellerToggleStockView,
    SellerRestockView,
    SellerOrdersView,
    SellerOrderStatusView,
    SellerStoreView,
    SellerReviewsView,
    SellerInventoryMovementsView,
)
from apps.vendors.application_views import (
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

app_name = 'seller'

urlpatterns = [
    # Seller Onboarding & Application Public Endpoints
    path('applications/apply/', SellerApplicationApplyView.as_view(), name='application_apply'),
    path('applications/track/', SellerApplicationTrackView.as_view(), name='application_track'),

    # Admin Management of Seller Applications
    path('admin/applications/', AdminSellerApplicationListView.as_view(), name='admin_applications_list'),
    path('admin/applications/<str:pk>/', AdminSellerApplicationDetailView.as_view(), name='admin_application_detail'),
    path('admin/applications/<str:pk>/status/', AdminSellerApplicationStatusView.as_view(), name='admin_application_status'),
    path('admin/applications/<str:pk>/approve/', AdminSellerApplicationApproveView.as_view(), name='admin_application_approve'),
    path('admin/applications/<str:pk>/reject/', AdminSellerApplicationRejectView.as_view(), name='admin_application_reject'),
    path('admin/applications/<str:pk>/resend-invitation/', AdminSellerApplicationResendInviteView.as_view(), name='admin_application_resend_invite'),

    # Vendor Invitation & Account Activation
    path('activation/verify/', VendorActivationVerifyView.as_view(), name='activation_verify'),
    path('activation/activate/', VendorActivationSubmitView.as_view(), name='activation_submit'),

    # Vendor Portal Internal Operations
    path('dashboard/', SellerDashboardView.as_view(), name='dashboard'),
    path('analytics/', SellerAnalyticsView.as_view(), name='analytics'),
    path('products/', SellerProductsView.as_view(), name='products'),
    path('products/<str:id>/', SellerProductDetailView.as_view(), name='product_detail'),
    path('products/<str:id>/toggle-stock/', SellerToggleStockView.as_view(), name='product_toggle_stock'),
    path('products/<str:id>/restock/', SellerRestockView.as_view(), name='product_restock'),
    path('orders/', SellerOrdersView.as_view(), name='orders'),
    path('orders/<str:fulfillment_id>/status/', SellerOrderStatusView.as_view(), name='order_status'),
    path('orders/<str:order_id>/tracking/', OrderDeliveryTrackingView.as_view(), name='order_tracking'),
    path('store/', SellerStoreView.as_view(), name='store'),
    path('store-profile/', SellerStoreProfileView.as_view(), name='store_profile'),
    path('reviews/', SellerReviewsView.as_view(), name='reviews'),
    path('inventory/movements/', SellerInventoryMovementsView.as_view(), name='inventory_movements'),
    path('inventory-movements/', SellerInventoryMovementsView.as_view(), name='inventory_movements_alias'),
]
