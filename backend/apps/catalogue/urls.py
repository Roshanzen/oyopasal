from django.urls import path
from apps.catalogue.views import (
    PublicCategoryListView,
    PublicCategoryDetailView,
    PublicBrandListView,
    PublicProductListView,
    PublicProductDetailView,
    ProductAutocompleteView,
    SimilarProductsView,
    ProductReviewsCombinedView,
    VendorProductListCreateView,
    VendorProductDetailView,
    VendorProductSubmitView,
    AdminProductModerationListView,
    AdminProductModerateView,
)

app_name = 'catalogue'

urlpatterns = [
    # Public Category & Brand
    path('categories/', PublicCategoryListView.as_view(), name='public_category_list'),
    path('categories/<slug:slug>/', PublicCategoryDetailView.as_view(), name='public_category_detail'),
    path('brands/', PublicBrandListView.as_view(), name='public_brand_list'),

    # Public Products
    path('products/', PublicProductListView.as_view(), name='public_product_list'),
    path('products/autocomplete/', ProductAutocompleteView.as_view(), name='product_autocomplete'),
    path('products/<str:product_id>/reviews/', ProductReviewsCombinedView.as_view(), name='product_reviews'),
    path('products/<str:id>/similar/', SimilarProductsView.as_view(), name='product_similar'),
    path('products/<str:slug>/', PublicProductDetailView.as_view(), name='public_product_detail'),

    # Vendor Product Management
    path('vendor/products/', VendorProductListCreateView.as_view(), name='vendor_product_list_create'),
    path('vendor/products/<uuid:id>/', VendorProductDetailView.as_view(), name='vendor_product_detail'),
    path('vendor/products/<uuid:id>/submit/', VendorProductSubmitView.as_view(), name='vendor_product_submit'),
    path('vendor-products/', VendorProductListCreateView.as_view(), name='vendor_product_list_create_alias'),
    path('vendor-products/<uuid:id>/', VendorProductDetailView.as_view(), name='vendor_product_detail_alias'),
    path('vendor-products/<uuid:id>/submit/', VendorProductSubmitView.as_view(), name='vendor_product_submit_alias'),

    # Admin Moderation
    path('admin/moderation/', AdminProductModerationListView.as_view(), name='admin_product_moderation_list'),
    path('admin/products/<uuid:id>/moderate/', AdminProductModerateView.as_view(), name='admin_product_moderate'),
]

