from django.urls import path
from .views import (
    FrequentlyBoughtTogetherView,
    TrendingProductsView,
    PersonalizedRecommendationsView,
    DemandForecastView,
    OrderRiskEvaluationView,
)

app_name = 'ai'

urlpatterns = [
    path('recommendations/frequently-bought/<uuid:product_id>/', FrequentlyBoughtTogetherView.as_view(), name='frequently_bought_together'),
    path('recommendations/trending/', TrendingProductsView.as_view(), name='trending_products'),
    path('recommendations/personalized/', PersonalizedRecommendationsView.as_view(), name='personalized_recommendations'),
    path('forecasting/demand/<uuid:variant_id>/', DemandForecastView.as_view(), name='demand_forecast'),
    path('fraud/risk/<uuid:order_id>/', OrderRiskEvaluationView.as_view(), name='order_risk_score'),
]

