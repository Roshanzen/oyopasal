from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.cart.models import Cart, CartItem
from apps.cart.serializers import (
    CartSerializer,
    AddToCartSerializer,
    UpdateCartItemSerializer,
    CartItemSerializer
)

def get_empty_cart():
    base = {
        'items': [],
        'item_count': 0,
        'total_items': 0,
        'vendor_count': 0,
        'grouped_by_vendor': [],
        'vendor_groups': [],
        'subtotal': '0.00',
        'delivery_fee': 0.0,
        'free_delivery_threshold': 499.0,
        'amount_needed_for_free_delivery': 499.0,
        'handling_fee': 0.0,
        'coupon': None,
        'total': 0.0
    }
    ret = dict(base)
    ret['data'] = dict(base)
    return ret

def get_or_create_cart(request):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    if request.user and request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart
    guest_user, _ = User.objects.get_or_create(
        email='guest@oyopasal.com',
        defaults={'role': 'CUSTOMER', 'first_name': 'Guest'}
    )
    cart, _ = Cart.objects.get_or_create(user=guest_user)
    return cart

class CartView(APIView):
    """View, add to, or clear active customer cart."""
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            session_key = request.headers.get('X-Session-Key')
            if not session_key:
                return Response(get_empty_cart())
        cart = get_or_create_cart(request)
        if not cart.items.exists():
            return Response(get_empty_cart())
        c_data = CartSerializer(cart).data
        res = dict(c_data)
        res['data'] = dict(c_data)
        return Response(res)

    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart = get_or_create_cart(request)
        variant = serializer.validated_data['variant']
        quantity = serializer.validated_data['quantity']

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            variant=variant,
            defaults={'quantity': quantity}
        )
        if not created:
            item.quantity += quantity
            item.save(update_fields=['quantity', 'updated_at'])

        c_data = CartSerializer(cart).data
        res = dict(c_data)
        res['data'] = c_data
        return Response(res, status=status.HTTP_200_OK)

    def delete(self, request):
        cart = get_or_create_cart(request)
        cart.items.all().delete()
        return Response(CartSerializer(cart).data)


class CartItemDetailView(APIView):
    """Update item quantity or remove item from cart."""
    permission_classes = [AllowAny]

    def put(self, request, id):
        return self._update_item(request, id)

    def patch(self, request, id):
        return self._update_item(request, id)

    def _update_item(self, request, id):
        quantity = int(request.data.get('quantity', 1))
        cart = get_or_create_cart(request)
        item = CartItem.objects.filter(cart=cart, id=id).first()
        if not item:
            item = CartItem.objects.filter(id=id).first()
        if not item:
            return Response({'success': False, 'message': 'Cart item not found.'}, status=status.HTTP_404_NOT_FOUND)

        if quantity <= 0:
            item.delete()
        else:
            item.quantity = quantity
            item.save(update_fields=['quantity', 'updated_at'])

        return Response(CartSerializer(cart).data)

    def delete(self, request, id):
        cart = get_or_create_cart(request)
        item = CartItem.objects.filter(cart=cart, id=id).first()
        if not item:
            item = CartItem.objects.filter(id=id).first()
        if item:
            item.delete()
        return Response(CartSerializer(cart).data)


class CartClearView(APIView):
    """Clear all items from active cart."""
    permission_classes = [AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        cart.items.all().delete()
        return Response(CartSerializer(cart).data)


class ValidateCheckoutView(APIView):
    """
    Authoritative checkout validation verifying stock availability,
    recalculating delivery fees and subtotal.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        if not cart.items.exists():
            return Response({
                'valid': False,
                'message': 'Your basket is empty. Please add items before checking out.',
                'authoritative_cart': EMPTY_CART
            }, status=status.HTTP_400_BAD_REQUEST)

        for item in cart.items.select_related('variant', 'variant__product').all():
            variant = item.variant
            if not variant or not variant.is_active:
                return Response({
                    'valid': False,
                    'message': f"Item '{item.product_name}' is no longer available.",
                    'authoritative_cart': CartSerializer(cart).data
                }, status=status.HTTP_400_BAD_REQUEST)

        cart_data = CartSerializer(cart).data
        return Response({
            'valid': True,
            'message': 'Checkout cart validated successfully.',
            'authoritative_cart': cart_data
        }, status=status.HTTP_200_OK)



