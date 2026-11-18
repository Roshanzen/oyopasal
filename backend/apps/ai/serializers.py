from rest_framework import serializers

class FrequentlyBoughtTogetherItemSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()
    vendor_name = serializers.CharField()
    confidence_score = serializers.FloatField()


class TrendingProductItemSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()
    vendor_name = serializers.CharField()
    units_sold = serializers.IntegerField()
    orders_count = serializers.IntegerField()


class PersonalizedRecommendationItemSerializer(serializers.Serializer):
    product_id = serializers.CharField()
    name = serializers.CharField()
    slug = serializers.CharField()
    category_name = serializers.CharField()
    vendor_name = serializers.CharField()
    recommendation_reason = serializers.CharField()


class DemandForecastResponseSerializer(serializers.Serializer):
    variant_id = serializers.CharField()
    sku = serializers.CharField()
    product_name = serializers.CharField()
    lookback_days = serializers.IntegerField()
    historical_units_sold = serializers.IntegerField()
    daily_run_rate_velocity = serializers.FloatField()
    forecast_window_days = serializers.IntegerField()
    projected_demand_units = serializers.IntegerField()
    current_available_stock = serializers.IntegerField()
    days_until_stockout = serializers.IntegerField()
    stockout_risk_level = serializers.CharField()
    recommended_reorder_units = serializers.IntegerField()


class OrderRiskEvaluationResponseSerializer(serializers.Serializer):
    order_number = serializers.CharField()
    risk_score = serializers.IntegerField()
    risk_level = serializers.CharField()
    is_flagged_for_manual_review = serializers.BooleanField()
    risk_signals = serializers.ListField(child=serializers.CharField())

