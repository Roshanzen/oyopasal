from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from apps.common.permissions import IsVendor, IsSuperAdmin, IsOperationsAdmin
from apps.orders.models import Order
from .services import (
    RecommendationEngine,
    DemandForecastingService,
    FraudRiskScoringService
)
from .serializers import (
    FrequentlyBoughtTogetherItemSerializer,
    TrendingProductItemSerializer,
    PersonalizedRecommendationItemSerializer,
    DemandForecastResponseSerializer,
    OrderRiskEvaluationResponseSerializer,
)

class FrequentlyBoughtTogetherView(APIView):
    """
    Returns items frequently co-purchased with the requested product.
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="AI: Frequently Bought Together",
        description="Calculates item co-occurrence affinity scores across historical suborders.",
        responses={200: FrequentlyBoughtTogetherItemSerializer(many=True)}
    )
    def get(self, request, product_id, *args, **kwargs):
        data = RecommendationEngine.get_frequently_bought_together(product_id=product_id)
        serializer = FrequentlyBoughtTogetherItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TrendingProductsView(APIView):
    """
    Returns high-velocity trending products over the last N days.
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="AI: Trending Catalog Items",
        description="Calculates sales momentum over recent lookback window.",
        parameters=[
            OpenApiParameter('days', OpenApiTypes.INT, description="Window in days (default 7)", required=False),
            OpenApiParameter('limit', OpenApiTypes.INT, description="Number of items (default 8)", required=False)
        ],
        responses={200: TrendingProductItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        try:
            days = int(request.query_params.get('days', 7))
        except (ValueError, TypeError):
            days = 7
        try:
            limit = int(request.query_params.get('limit', 8))
        except (ValueError, TypeError):
            limit = 8
        data = RecommendationEngine.get_trending_products(days=days, limit=limit)
        serializer = TrendingProductItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PersonalizedRecommendationsView(APIView):
    """
    Returns individualized product suggestions based on user shopping history.
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="AI: Personalized Feed Recommendations",
        description="Suggests products matched to customer historical affinities.",
        responses={200: PersonalizedRecommendationItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        data = RecommendationEngine.get_personalized_recommendations(user=request.user)
        serializer = PersonalizedRecommendationItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DemandForecastView(APIView):
    """
    Computes predictive run-rate velocity, days to stockout, and procurement suggestions for a variant.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="AI: Predictive Demand & Stockout Forecast",
        description="Forecasts future SKU depletion rate and generates automated replenishment recommendation.",
        parameters=[
            OpenApiParameter('lookback_days', OpenApiTypes.INT, description="Historical sample days (default 30)", required=False),
            OpenApiParameter('forecast_days', OpenApiTypes.INT, description="Target forecast period in days (default 30)", required=False),
        ],
        responses={200: DemandForecastResponseSerializer}
    )
    def get(self, request, variant_id, *args, **kwargs):
        try:
            lookback = int(request.query_params.get('lookback_days', 30))
        except (ValueError, TypeError):
            lookback = 30
        try:
            forecast = int(request.query_params.get('forecast_days', 30))
        except (ValueError, TypeError):
            forecast = 30

        try:
            data = DemandForecastingService.forecast_sku_demand(
                variant_id=variant_id,
                lookback_days=lookback,
                forecast_days=forecast
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_404_NOT_FOUND)

        serializer = DemandForecastResponseSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrderRiskEvaluationView(APIView):
    """
    Calculates ML/heuristic risk score for an order to prevent fraudulent payouts and unauthorized transactions.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin | IsOperationsAdmin]

    @extend_schema(
        summary="AI: Order Fraud & Abuse Risk Evaluation",
        description="Analyzes order velocity, transaction value, and payment history to compute risk score (0-100).",
        responses={200: OrderRiskEvaluationResponseSerializer}
    )
    def get(self, request, order_id, *args, **kwargs):
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = FraudRiskScoringService.evaluate_order_risk(order=order)
        serializer = OrderRiskEvaluationResponseSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)

