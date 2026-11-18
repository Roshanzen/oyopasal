from django.urls import path
from .views import (
    ProductReviewListView,
    ProductReviewCreateView,
    VendorReviewReplyView,
)

app_name = 'reviews'

urlpatterns = [
    path('products/<uuid:product_id>/', ProductReviewListView.as_view(), name='product_review_list'),
    path('products/<uuid:product_id>/create/', ProductReviewCreateView.as_view(), name='product_review_create'),
    path('<uuid:id>/reply/', VendorReviewReplyView.as_view(), name='vendor_review_reply'),
]

