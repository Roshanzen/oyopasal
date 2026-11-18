from django.db.models import Avg, Count
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.catalogue.models import Product
from .models import ProductReview

class ReviewService:
    @staticmethod
    def verify_customer_purchase(user, product: Product) -> bool:
        """
        Check if the customer has completed and received a delivery containing this product.
        """
        return OrderItem.objects.filter(
            sub_order__parent_order__customer=user,
            variant__product=product,
            sub_order__status=OrderStatus.DELIVERED
        ).exists()

    @staticmethod
    def recalculate_product_rating(product: Product):
        """
        Recalculate average rating and review count for the product.
        """
        aggregates = ProductReview.objects.filter(
            product=product,
            is_approved=True
        ).aggregate(
            avg_rating=Avg('rating'),
            count=Count('id')
        )

        avg = aggregates['avg_rating'] or 5.0
        count = aggregates['count'] or 0

        # Update cached ratings on Product if fields exist
        if hasattr(product, 'average_rating'):
            product.average_rating = round(avg, 2)
        if hasattr(product, 'total_reviews'):
            product.total_reviews = count
        product.save(update_fields=[f for f in ['average_rating', 'total_reviews'] if hasattr(product, f)])

