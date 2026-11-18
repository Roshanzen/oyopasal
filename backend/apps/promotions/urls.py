from django.urls import path
from .views import (
    CouponValidateView,
    AdminCouponListCreateView,
    PublicPromotionListView,
    PublicAdvertisementListView,
    AdvertisementClickView,
    ActiveCouponsListView,
    CouponApplyView,
    CouponRemoveView,
)

app_name = 'promotions'

urlpatterns = [
    path('', PublicPromotionListView.as_view(), name='public_promotions'),
    path('advertisements/', PublicAdvertisementListView.as_view(), name='public_advertisements'),
    path('advertisements/<str:id>/click/', AdvertisementClickView.as_view(), name='advertisement_click'),
    path('coupons/active/', ActiveCouponsListView.as_view(), name='active_coupons'),
    path('coupons/apply/', CouponApplyView.as_view(), name='apply_coupon'),
    path('coupons/remove/', CouponRemoveView.as_view(), name='remove_coupon'),
    path('coupons/validate/', CouponValidateView.as_view(), name='coupon_validate'),
    path('admin/coupons/', AdminCouponListCreateView.as_view(), name='admin_coupons'),
]

