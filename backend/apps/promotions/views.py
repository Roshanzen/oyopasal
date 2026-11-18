from decimal import Decimal
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsSuperAdmin
from .models import Coupon, MarketingPromotion, Advertisement
from .serializers import (
    CouponSerializer,
    CouponValidateSerializer,
    CouponValidationResultSerializer,
    MarketingPromotionSerializer,
    AdvertisementSerializer,
)

DEFAULT_PROMOTIONS = [
    {
        "id": "promo-1",
        "title": "Fast & Fresh in 10-15 Minutes",
        "title_ne": "१०-१५ मिनेटमै ताजा र छिटो डेलिभरी",
        "subtitle": "Free delivery on all orders over Rs. 499 from verified local neighborhood sellers.",
        "subtitle_ne": "रु. ४९९ माथिका सबै अर्डरमा प्रमाणित स्थानीय पसलबाट निःशुल्क डेलिभरी।",
        "badge": "SUPER SAVINGS",
        "badge_ne": "सुपर बचत",
        "cta_text": "Explore Fresh Produce",
        "cta_text_ne": "ताजा तरकारी हेर्नुहोस्",
        "cta_category": "fruits-vegetables",
        "image": "/src/assets/images/hero_groceries_fresh_1794407355931.jpg",
        "code": "FREEDELIVERY",
        "color_theme": "emerald",
        "placement": "hero",
        "sort_order": 1,
        "is_active": True
    },
    {
        "id": "promo-2",
        "title": "Farm Harvest Morning Festival",
        "title_ne": "फार्म ताजा बिहानी महोत्सव",
        "subtitle": "Directly sourced from Kavre & Dhading organic farms. Up to 30% off today.",
        "subtitle_ne": "काभ्रे र धादिङका अर्गानिक फार्मबाट सिधै। आज ३०% सम्म छुट।",
        "badge": "FARM DIRECT",
        "badge_ne": "सिधै फार्मबाट",
        "cta_text": "Order Farm Harvest",
        "cta_text_ne": "फार्म ताजा अर्डर गर्नुहोस्",
        "cta_category": "fruits-vegetables",
        "image": "/src/assets/images/promo_fresh_produce_1794407354982.jpg",
        "code": "FARMFRESH",
        "color_theme": "teal",
        "placement": "hero",
        "sort_order": 2,
        "is_active": True
    },
    {
        "id": "promo-3",
        "title": "Artisan Bakery & Daily Dairy Essentials",
        "title_ne": "कारीगरी बेकरी र दैनिक दुग्ध सामग्री",
        "subtitle": "Pure cow milk, artisan sourdoughs, fresh paneer & ghee delivered piping fresh.",
        "subtitle_ne": "शुद्ध गाईको दूध, ताजा पनीर, घ्यू र बेकरी उत्पादनहरू।",
        "badge": "DAILY ESSENTIALS",
        "badge_ne": "दैनिक आवश्यकता",
        "cta_text": "Shop Dairy & Bakery",
        "cta_text_ne": "दुध र बेकरी किन्नुहोस्",
        "cta_category": "dairy-bakery",
        "image": "/src/assets/images/vendor_bakery_dairy_1794407355670.jpg",
        "code": "DAIRY10",
        "color_theme": "amber",
        "placement": "hero",
        "sort_order": 3,
        "is_active": True
    },
    {
        "id": "promo-4",
        "title": "Crunchy Evening Snacks & Herbal Teas",
        "title_ne": "साँझको खाजा र जडीबुटी चिया",
        "subtitle": "Authentic Ilam orthodox tea, crunchy roasted chiura & healthy dry fruits.",
        "subtitle_ne": "इलामको चिया, भुटेको चिउरा र स्वस्थ ड्राई फ्रुट्स।",
        "badge": "NEPALI FLAVORS",
        "badge_ne": "नेपाली स्वाद",
        "cta_text": "Explore Tea & Snacks",
        "cta_text_ne": "चिया र खाजा हेर्नुहोस्",
        "cta_category": "snacks-beverages",
        "image": "/src/assets/images/promo_snacks_drinks_1794407356711.jpg",
        "code": "SNACKTIME",
        "color_theme": "rose",
        "placement": "hero",
        "sort_order": 4,
        "is_active": True
    }
]

DEFAULT_ADVERTISEMENTS = [
    {
        "id": "ad-1",
        "db_id": 1,
        "title": "Fast 10-Minute Delivery Guarantee",
        "title_ne": "१० मिनेट डेलिभरी ग्यारेन्टी",
        "subtitle": "Kathmandu Valley's fastest hyperlocal grocery dispatch",
        "subtitle_ne": "काठमाडौँ उपत्यकाको सबैभन्दा छिटो किराना सेवा",
        "image_url": "/src/assets/images/promo_fresh_produce_1794407354982.jpg",
        "destination_url": "/category/fruits-vegetables",
        "placement": "sidebar",
        "priority": 1,
        "is_active": True,
        "clicks_count": 42
    },
    {
        "id": "ad-2",
        "db_id": 2,
        "title": "0% Commission for Local Sellers",
        "title_ne": "स्थानीय विक्रेतालाई ०% कमिसन",
        "subtitle": "Join 450+ Kathmandu valley vendors today",
        "subtitle_ne": "आजै ४५०+ विक्रेताहरूसँग जोडिनुहोस्",
        "image_url": "/src/assets/images/vendor_bakery_dairy_1794407355670.jpg",
        "destination_url": "/seller",
        "placement": "sidebar",
        "priority": 2,
        "is_active": True,
        "clicks_count": 28
    }
]


class PublicPromotionListView(APIView):
    """List active marketing banner promotions for hero carousel & deals."""
    permission_classes = [AllowAny]

    def get(self, request):
        placement = request.query_params.get('placement')
        try:
            qs = MarketingPromotion.objects.filter(is_active=True)
            if placement:
                qs = qs.filter(placement=placement)
            promos = list(MarketingPromotionSerializer(qs, many=True).data)
        except Exception:
            promos = []

        if not promos:
            promos = [p for p in DEFAULT_PROMOTIONS if not placement or p.get('placement') == placement]

        return Response({
            'count': len(promos),
            'next': None,
            'previous': None,
            'results': promos,
            'data': promos,
            'success': True
        })


class PublicAdvertisementListView(APIView):
    """List banner advertisements and promotions."""
    permission_classes = [AllowAny]

    def get(self, request):
        placement = request.query_params.get('placement')
        try:
            qs = Advertisement.objects.filter(is_active=True)
            if placement:
                qs = qs.filter(placement=placement)
            ads = list(AdvertisementSerializer(qs, many=True).data)
        except Exception:
            ads = []

        if not ads:
            ads = [a for a in DEFAULT_ADVERTISEMENTS if not placement or a.get('placement') == placement]

        return Response({
            'count': len(ads),
            'results': ads,
            'data': ads,
            'success': True
        })


class AdvertisementClickView(APIView):
    """Track advertisement click event."""
    permission_classes = [AllowAny]

    def post(self, request, id):
        try:
            ad = Advertisement.objects.filter(id=id).first()
            if ad:
                ad.clicks_count += 1
                ad.save(update_fields=['clicks_count'])
        except Exception:
            pass
        return Response({'success': True})


class CouponValidateView(APIView):
    """
    Validate a promotional coupon code against an active shopping cart subtotal.
    Returns discounted amount and revised subtotal.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Validate Promotional Coupon Code",
        request=CouponValidateSerializer,
        responses={200: CouponValidationResultSerializer}
    )
    def post(self, request):
        serializer = CouponValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['code'].strip().upper()
        subtotal = serializer.validated_data['subtotal']

        try:
            coupon = Coupon.objects.get(code=code)
        except Coupon.DoesNotExist:
            return Response({
                'code': code,
                'is_valid': False,
                'discount_amount': '0.00',
                'new_subtotal': str(subtotal),
                'message': 'Invalid coupon code.',
            }, status=status.HTTP_400_BAD_REQUEST)

        is_valid, reason = coupon.is_valid(subtotal)
        if not is_valid:
            return Response({
                'code': code,
                'is_valid': False,
                'discount_amount': '0.00',
                'new_subtotal': str(subtotal),
                'message': reason,
            }, status=status.HTTP_400_BAD_REQUEST)

        discount = coupon.calculate_discount(subtotal)
        new_subtotal = max(Decimal('0.00'), subtotal - discount)

        return Response({
            'code': coupon.code,
            'is_valid': True,
            'discount_amount': str(discount.quantize(Decimal('0.01'))),
            'new_subtotal': str(new_subtotal.quantize(Decimal('0.01'))),
            'message': f"Coupon applied: NPR {discount:.2f} discount.",
        }, status=status.HTTP_200_OK)


class AdminCouponListCreateView(generics.ListCreateAPIView):
    """Super Admin / Operations view to list and create discount coupons."""
    serializer_class = CouponSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Coupon.objects.all()

    @extend_schema(summary="List Promotional Coupons (Admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Create Promotional Coupon (Admin)")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


DEFAULT_COUPONS = [
    {
        'id': 'coupon-1',
        'code': 'WELCOME50',
        'description': 'Flat Rs. 50 OFF on orders above Rs. 299',
        'discount_type': 'FLAT',
        'discount_value': 50.0,
        'min_order_amount': 299.0,
        'max_discount_amount': 50.0,
        'is_active': True
    },
    {
        'id': 'coupon-2',
        'code': 'OYO100',
        'description': 'Flat Rs. 100 OFF on orders above Rs. 999',
        'discount_type': 'FLAT',
        'discount_value': 100.0,
        'min_order_amount': 999.0,
        'max_discount_amount': 100.0,
        'is_active': True
    },
    {
        'id': 'coupon-3',
        'code': 'FREEDELIVERY',
        'description': 'Free delivery on orders over Rs. 499',
        'discount_type': 'FREE_DELIVERY',
        'discount_value': 100.0,
        'min_order_amount': 499.0,
        'max_discount_amount': 100.0,
        'is_active': True
    }
]


class ActiveCouponsListView(APIView):
    """List active coupons available for customers in the cart drawer."""
    permission_classes = [AllowAny]

    def get(self, request):
        coupons = Coupon.objects.filter(is_active=True).order_by('-created_at')
        if not coupons.exists():
            return Response({
                'count': len(DEFAULT_COUPONS),
                'results': DEFAULT_COUPONS
            })

        results = [
            {
                'id': str(c.id),
                'code': c.code,
                'description': f"{c.get_discount_type_display()}: NPR {c.discount_value} off on min orders of NPR {c.min_order_value}",
                'discount_type': c.discount_type,
                'discount_value': float(c.discount_value),
                'min_order_amount': float(c.min_order_value),
                'max_discount_amount': float(c.max_discount_amount or c.discount_value),
                'is_active': c.is_active
            }
            for c in coupons
        ]
        return Response({
            'count': len(results),
            'results': results
        })


class CouponApplyView(APIView):
    """Validate and apply a coupon to the active shopping cart."""
    permission_classes = [AllowAny]

    def post(self, request):
        from apps.cart.views import get_or_create_cart
        from apps.cart.serializers import CartSerializer
        code = request.data.get('code', '').strip().upper()
        if not code:
            return Response({'success': False, 'message': 'Coupon code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        cart = get_or_create_cart(request)
        cart_data = CartSerializer(cart).data
        subtotal = Decimal(str(cart_data['subtotal']))
        if subtotal <= 0:
            return Response({'success': False, 'message': 'Cart is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        db_coupon = Coupon.objects.filter(code=code, is_active=True).first()
        discount = Decimal('0.0')
        desc = ""
        if db_coupon:
            is_valid, reason = db_coupon.is_valid(subtotal)
            if not is_valid:
                return Response({'success': False, 'message': reason}, status=status.HTTP_400_BAD_REQUEST)
            discount = db_coupon.calculate_discount(subtotal)
            desc = f"NPR {discount:.2f} discount applied."
        else:
            matching = next((c for c in DEFAULT_COUPONS if c['code'] == code), None)
            if not matching:
                return Response({'success': False, 'message': 'Invalid promotional coupon code.'}, status=status.HTTP_400_BAD_REQUEST)
            if subtotal < Decimal(str(matching['min_order_amount'])):
                return Response({
                    'success': False,
                    'message': f"Minimum order amount of NPR {matching['min_order_amount']} required for {code}."
                }, status=status.HTTP_400_BAD_REQUEST)
            discount = Decimal(str(matching['discount_value']))
            desc = matching['description']

        cart_data['coupon'] = {
            'id': code,
            'code': code,
            'description': desc,
            'discount_amount': float(discount)
        }
        cart_data['discount_amount'] = float(discount)
        cart_data['total'] = max(0.0, float(subtotal + Decimal(str(cart_data['delivery_fee'])) - discount))

        return Response({
            'success': True,
            'coupon': cart_data['coupon'],
            'cart': cart_data
        }, status=status.HTTP_200_OK)


class CouponRemoveView(APIView):
    """Remove coupon and recalculate normal totals."""
    permission_classes = [AllowAny]

    def delete(self, request):
        from apps.cart.views import get_or_create_cart
        from apps.cart.serializers import CartSerializer
        cart = get_or_create_cart(request)
        cart_data = CartSerializer(cart).data
        cart_data['coupon'] = None
        cart_data['discount_amount'] = 0.0
        return Response({
            'success': True,
            'cart': cart_data
        }, status=status.HTTP_200_OK)


