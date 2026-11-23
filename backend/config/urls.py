from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView
)
from apps.common.views import (
    ApiHomepageView,
    HealthCheckView,
    DbStatusView,
    ImageKitAuthView,
    ResolveImageUrlView,
    PublicSettingsView,
    api_not_found_view,
    api_server_error_view
)
from apps.common.media_views import (
    MediaUploadView,
    MediaAssetListView,
    MediaAssetDetailView
)
from apps.promotions.views import (
    PublicAdvertisementListView,
    AdvertisementClickView,
    ActiveCouponsListView,
    CouponApplyView,
    CouponRemoveView,
    HeroBannerPublicListView,
    AdminHeroBannerListCreateView,
    AdminHeroBannerDetailView,
    AdminHeroBannerReorderView
)
from apps.catalogue.views import PublicCategoryListView, PublicCategoryDetailView
from apps.customers.views import WishlistListView, WishlistToggleView, CustomerAddressViewSet
from apps.cart.views import ValidateCheckoutView
from apps.delivery.views import PublicDeliveryZoneListView

urlpatterns = [
    # Homepage API Welcome Directory
    path('', ApiHomepageView.as_view(), name='api_homepage'),

    # Administration
    path('admin/', admin.site.urls),

    # Health Check & Common Utilities
    path('api/v1/health/', HealthCheckView.as_view(), name='health_check'),
    path('api/v1/db/status/', DbStatusView.as_view(), name='db_status'),
    path('api/v1/settings/public/', PublicSettingsView.as_view(), name='public_settings'),
    path('api/v1/advertisements/', PublicAdvertisementListView.as_view(), name='public_advertisements'),
    path('api/v1/advertisements/<str:id>/click/', AdvertisementClickView.as_view(), name='advertisement_click'),
    path('api/v1/wishlist/', WishlistListView.as_view(), name='wishlist_list'),
    path('api/v1/wishlist/toggle/', WishlistToggleView.as_view(), name='wishlist_toggle'),
    path('api/v1/media/upload/', MediaUploadView.as_view(), name='media_upload'),
    path('api/media/upload/', MediaUploadView.as_view(), name='media_upload_alias'),
    path('api/v1/media/', MediaAssetListView.as_view(), name='media_list'),
    path('api/v1/media/<int:pk>/', MediaAssetDetailView.as_view(), name='media_detail'),
    path('api/v1/media/imagekit-auth/', ImageKitAuthView.as_view(), name='imagekit_auth'),
    path('api/v1/media/resolve-image/', ResolveImageUrlView.as_view(), name='resolve_image_url'),

    # Direct static file serving for /uploads/ and assets
    re_path(r'^uploads/(?P<path>.*)$', serve, {'document_root': settings.BASE_DIR.parent / 'public' / 'uploads'}),
    re_path(r'^(?P<path>(src/assets/images|assets/images)/.*)$', serve, {'document_root': settings.BASE_DIR.parent / 'public'}),

    # Checkout & Cart Validation
    path('api/v1/checkout/validate/', ValidateCheckoutView.as_view(), name='checkout_validate'),

    # Promotional Coupons
    path('api/v1/coupons/active/', ActiveCouponsListView.as_view(), name='active_coupons'),
    path('api/v1/coupons/apply/', CouponApplyView.as_view(), name='apply_coupon'),
    path('api/v1/coupons/remove/', CouponRemoveView.as_view(), name='remove_coupon'),

    # Delivery Zones
    path('api/v1/zones/', PublicDeliveryZoneListView.as_view(), name='public_zones'),

    # Customer Account Addresses
    path('api/v1/account/addresses/', CustomerAddressViewSet.as_view({'get': 'list', 'post': 'create'}), name='account_addresses'),
    path('api/v1/account/addresses/<uuid:pk>/', CustomerAddressViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='account_address_detail'),

    # OpenAPI 3 Schema & Interactive Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # API v1 Domain Routes
    path('api/v1/seller/', include('apps.vendors.seller_urls', namespace='seller')),
    path('api/v1/vendors/seller/', include('apps.vendors.seller_urls', namespace='vendors_seller')),
    path('api/v1/auth/', include('apps.accounts.urls', namespace='auth')),
    path('api/v1/customers/', include('apps.customers.urls', namespace='customers')),
    path('api/v1/vendors/', include('apps.vendors.urls', namespace='vendors')),
    path('api/v1/suppliers/', include('apps.suppliers.urls', namespace='suppliers')),
    path('api/v1/stores/', include('apps.stores.urls', namespace='stores')),
    path('api/v1/warehouses/', include('apps.warehouse.urls', namespace='warehouse')),
    path('api/v1/inventory/', include('apps.inventory.urls', namespace='inventory')),
    path('api/v1/delivery/', include('apps.delivery.urls', namespace='delivery')),
    path('api/v1/cart/', include('apps.cart.urls', namespace='cart')),
    path('api/v1/orders/', include('apps.orders.urls', namespace='orders')),
    path('api/v1/payments/', include('apps.payments.urls', namespace='payments')),
    path('api/v1/settlements/', include('apps.settlements.urls', namespace='settlements')),
    path('api/v1/refunds/', include('apps.refunds.urls', namespace='refunds')),
    path('api/v1/procurement/', include('apps.procurement.urls', namespace='procurement')),
    path('api/v1/analytics/', include('apps.analytics.urls', namespace='analytics')),
    path('api/v1/reports/', include('apps.reports.urls', namespace='reports')),
    path('api/v1/subscriptions/', include('apps.subscriptions.urls', namespace='subscriptions')),
    path('api/v1/chat/', include('apps.ai.chat_urls', namespace='chat')),
    path('api/v1/ai/', include('apps.ai.urls', namespace='ai')),
    path('api/v1/audit/', include('apps.audit.urls', namespace='audit')),
    path('api/v1/promotions/', include('apps.promotions.urls', namespace='promotions')),
    path('api/categories/', PublicCategoryListView.as_view(), name='public_categories_root'),
    path('api/categories/<slug:slug>/', PublicCategoryDetailView.as_view(), name='public_category_detail_root'),
    path('api/admin/categories/', PublicCategoryListView.as_view(), name='admin_categories_root'),
    path('api/admin/categories/<str:slug>/', PublicCategoryDetailView.as_view(), name='admin_category_detail_root'),
    path('api/hero-banners/', HeroBannerPublicListView.as_view(), name='public_hero_banners_root'),
    path('api/admin/hero-banners/', AdminHeroBannerListCreateView.as_view(), name='admin_hero_banners_root'),
    path('api/admin/hero-banners/<int:pk>/', AdminHeroBannerDetailView.as_view(), name='admin_hero_banners_detail_root'),
    path('api/admin/hero-banners/reorder/', AdminHeroBannerReorderView.as_view(), name='admin_hero_banners_reorder_root'),
    path('api/v1/hero-banners/', HeroBannerPublicListView.as_view(), name='public_hero_banners_v1'),
    path('api/v1/admin/hero-banners/', AdminHeroBannerListCreateView.as_view(), name='admin_hero_banners_v1'),
    path('api/v1/admin/hero-banners/<int:pk>/', AdminHeroBannerDetailView.as_view(), name='admin_hero_banners_detail_v1'),
    path('api/v1/admin/hero-banners/reorder/', AdminHeroBannerReorderView.as_view(), name='admin_hero_banners_reorder_v1'),
    path('api/v1/reviews/', include('apps.reviews.urls', namespace='reviews')),
    path('api/v1/notifications/', include('apps.notifications.urls', namespace='notifications')),
    path('api/v1/support/', include('apps.support.urls', namespace='support')),
    path('api/v1/catalogue/', include('apps.catalogue.urls', namespace='catalogue_alias')),
    path('api/v1/', include('apps.catalogue.urls', namespace='catalogue')),

    # API Catch-all 404 for undefined api routes
    path('api/<path:unmatched>', api_not_found_view, name='api_not_found_catchall'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

handler404 = 'apps.common.views.api_not_found_view'
handler500 = 'apps.common.views.api_server_error_view'


