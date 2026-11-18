from django.urls import path
from apps.cart.views import CartView, CartItemDetailView, CartClearView

app_name = 'cart'

urlpatterns = [
    path('', CartView.as_view(), name='cart_detail'),
    path('items/', CartView.as_view(), name='cart_items_create'),
    path('items/<str:id>/', CartItemDetailView.as_view(), name='cart_item_detail'),
    path('clear/', CartClearView.as_view(), name='cart_clear'),
]

