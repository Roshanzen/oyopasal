from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from apps.common.permissions import IsSuperAdmin
from .services import AnalyticsService
from .serializers import (
    AdminDashboardResponseSerializer,
    SalesTrendItemSerializer,
    TopVendorItemSerializer,
    TopProductItemSerializer,
)

class AdminDashboardKPIView(APIView):
    """
    Super Admin high-level operational and financial KPIs across all 4 ecosystems:
    Customers, Vendors, Suppliers, and Marketplace Orders.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        summary="Admin: Executive KPI Dashboard",
        description="Returns consolidated business, sales, financial, and wholesale procurement KPIs.",
        responses={200: AdminDashboardResponseSerializer}
    )
    def get(self, request, *args, **kwargs):
        data = AnalyticsService.get_dashboard_kpis()
        serializer = AdminDashboardResponseSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminSalesTrendsView(APIView):
    """
    Time-series sales metrics grouped by day for platform trend charts and forecasting.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        summary="Admin: Sales Trends Timeseries",
        description="Returns daily GMV, order volume, subtotal, and tax breakdowns over the requested window.",
        parameters=[
            OpenApiParameter('days', OpenApiTypes.INT, description="Number of days to look back (default 30)", required=False)
        ],
        responses={200: SalesTrendItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        try:
            days = int(request.query_params.get('days', 30))
        except (ValueError, TypeError):
            days = 30
        data = AnalyticsService.get_sales_trends(days=days)
        serializer = SalesTrendItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminTopVendorsView(APIView):
    """
    Vendor leaderboard ranked by delivered order volume and gross marketplace revenue.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        summary="Admin: Top Performing Vendors",
        description="Ranks top active merchants by gross sales, completed orders, and platform commission generated.",
        parameters=[
            OpenApiParameter('limit', OpenApiTypes.INT, description="Maximum number of merchants to return (default 10)", required=False)
        ],
        responses={200: TopVendorItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        try:
            limit = int(request.query_params.get('limit', 10))
        except (ValueError, TypeError):
            limit = 10
        data = AnalyticsService.get_top_performing_vendors(limit=limit)
        serializer = TopVendorItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminTopProductsView(APIView):
    """
    Product leaderboard ranked by units sold and generated revenue.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        summary="Admin: Top Selling Products",
        description="Ranks best-selling catalog items across all stores by units sold.",
        parameters=[
            OpenApiParameter('limit', OpenApiTypes.INT, description="Maximum number of products to return (default 10)", required=False)
        ],
        responses={200: TopProductItemSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        try:
            limit = int(request.query_params.get('limit', 10))
        except (ValueError, TypeError):
            limit = 10
        data = AnalyticsService.get_top_selling_products(limit=limit)
        serializer = TopProductItemSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

