from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsVendor
from apps.catalogue.models import Product
from .models import ProductReview
from .serializers import (
    ProductReviewSerializer,
    CreateReviewSerializer,
    VendorReplyReviewSerializer,
)
from .services import ReviewService

class ProductReviewListView(generics.ListAPIView):
    """Public list of approved reviews for a given product."""
    serializer_class = ProductReviewSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        product_id = self.kwargs.get('product_id')
        return ProductReview.objects.filter(
            product_id=product_id,
            is_approved=True
        ).select_related('user').order_by('-created_at')

    @extend_schema(summary="List Public Product Reviews")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class ProductReviewCreateView(APIView):
    """Customer submits rating and review for a product."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Submit Product Review",
        request=CreateReviewSerializer,
        responses={201: ProductReviewSerializer}
    )
    def post(self, request, product_id):
        try:
            product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Product not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        is_verified = ReviewService.verify_customer_purchase(user, product)

        # Update or create review
        review, created = ProductReview.objects.update_or_create(
            user=user,
            product=product,
            defaults={
                'rating': serializer.validated_data['rating'],
                'title': serializer.validated_data.get('title', ''),
                'comment': serializer.validated_data['comment'],
                'is_verified_purchase': is_verified,
                'is_approved': True,
            }
        )

        ReviewService.recalculate_product_rating(product)

        return Response({
            'success': True,
            'message': 'Review submitted successfully.',
            'data': ProductReviewSerializer(review).data
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class VendorReviewReplyView(APIView):
    """Store merchant replies to a customer review on their product."""
    permission_classes = [IsVendor]

    @extend_schema(
        summary="Vendor Reply to Review",
        request=VendorReplyReviewSerializer,
        responses={200: ProductReviewSerializer}
    )
    def post(self, request, id):
        try:
            review = ProductReview.objects.select_related('product__vendor').get(id=id)
        except ProductReview.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Review not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        vendor = getattr(request.user, 'vendor_profile', None)
        if not vendor or review.product.vendor != vendor:
            return Response({
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'You can only reply to reviews on your own products.'}
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = VendorReplyReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review.vendor_reply = serializer.validated_data['reply']
        review.vendor_replied_at = timezone.now()
        review.save(update_fields=['vendor_reply', 'vendor_replied_at'])

        return Response({
            'success': True,
            'message': 'Vendor reply recorded successfully.',
            'data': ProductReviewSerializer(review).data
        })

