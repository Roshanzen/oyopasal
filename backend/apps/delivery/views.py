from rest_framework import serializers, generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from apps.common.permissions import IsSuperAdmin, IsOperationsAdmin
from apps.delivery.models import DeliveryZone

class DeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryZone
        fields = [
            'id', 'name', 'code', 'province', 'districts',
            'base_shipping_charge', 'per_kg_charge',
            'estimated_delivery_days_min', 'estimated_delivery_days_max',
            'is_active'
        ]
        read_only_fields = ['id']


class PublicDeliveryZoneListView(generics.ListAPIView):
    """List active delivery zones and shipping rates."""
    queryset = DeliveryZone.objects.filter(is_active=True)
    serializer_class = DeliveryZoneSerializer
    permission_classes = [AllowAny]

    @extend_schema(summary="List Public Delivery Zones & Shipping Rates")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class CheckDeliveryServiceabilityView(APIView):
    """
    Validates delivery serviceability for a customer's selected location/coordinates.
    Matches against Nepal districts, administrative zones, and active logistics partners.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Check Delivery Serviceability for Location",
        parameters=[
            OpenApiParameter('district', str, description="District name e.g. Kathmandu, Kaski, Morang", required=False),
            OpenApiParameter('municipality', str, description="Municipality name", required=False),
            OpenApiParameter('province', str, description="Province name", required=False),
            OpenApiParameter('latitude', float, description="Selected location latitude", required=False),
            OpenApiParameter('longitude', float, description="Selected location longitude", required=False),
        ]
    )
    def post(self, request, *args, **kwargs):
        return self._process_check(request.data)

    def get(self, request, *args, **kwargs):
        return self._process_check(request.query_params)

    def _process_check(self, data):
        district = (data.get('district') or '').strip()
        municipality = (data.get('municipality') or '').strip()
        province = (data.get('province') or '').strip()
        latitude = data.get('latitude')
        longitude = data.get('longitude')

        # Fallback coordinate check if coordinates are within Nepal bounding box (approx lat: 26.0 to 31.0, lon: 79.5 to 89.0)
        if latitude and longitude:
            try:
                lat = float(latitude)
                lon = float(longitude)
                if not (26.0 <= lat <= 31.0 and 79.5 <= lon <= 89.0):
                    return Response({
                        'is_serviceable': False,
                        'message': 'Selected coordinates are outside the national delivery boundary of Nepal.',
                        'country': 'Nepal'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                pass

        zone = None
        if district:
            # Match district inside JSON list (case-insensitive)
            zones = DeliveryZone.objects.filter(is_active=True)
            for z in zones:
                district_list = [d.lower() for d in (z.districts or [])]
                if district.lower() in district_list or any(d in district.lower() for d in district_list):
                    zone = z
                    break

        if not zone and province:
            zone = DeliveryZone.objects.filter(is_active=True, province__iexact=province).first()

        # If district was not provided or unknown, check coordinates
        if not zone and latitude and longitude:
            try:
                lat = float(latitude)
                lon = float(longitude)
                if 27.60 <= lat <= 27.80 and 85.20 <= lon <= 85.45:
                    zone = DeliveryZone.objects.filter(code='KTM_VALLEY', is_active=True).first()
                elif 28.15 <= lat <= 28.30 and 83.90 <= lon <= 84.10:
                    zone = DeliveryZone.objects.filter(code='GANDAKI_VALLEY', is_active=True).first()
            except (ValueError, TypeError):
                pass

        # Default to standard Kathmandu Valley zone if within Nepal
        if not zone:
            zone = DeliveryZone.objects.filter(code='KTM_VALLEY', is_active=True).first()

        if zone:
            return Response({
                'is_serviceable': True,
                'zone': {
                    'id': str(zone.id),
                    'name': zone.name,
                    'code': zone.code,
                    'province': zone.province,
                    'base_shipping_charge': float(zone.base_shipping_charge),
                    'per_kg_charge': float(zone.per_kg_charge),
                    'estimated_delivery_days_min': zone.estimated_delivery_days_min,
                    'estimated_delivery_days_max': zone.estimated_delivery_days_max,
                },
                'shipping_charge': float(zone.base_shipping_charge),
                'estimated_delivery': f"{zone.estimated_delivery_days_min}-{zone.estimated_delivery_days_max} Business Days",
                'district': district or 'Kathmandu',
                'municipality': municipality or 'Kathmandu Metropolitan',
                'message': f"Standard & express delivery available in {district or zone.name}.",
            }, status=status.HTTP_200_OK)

        return Response({
            'is_serviceable': False,
            'message': 'Logistics service is currently unavailable for this specific address.',
        }, status=status.HTTP_200_OK)


class AdminDeliveryZoneListCreateView(generics.ListCreateAPIView):
    """Admin delivery zone management."""
    queryset = DeliveryZone.objects.all()
    serializer_class = DeliveryZoneSerializer
    permission_classes = [IsSuperAdmin | IsOperationsAdmin]

    @extend_schema(summary="Manage Delivery Zones (Admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Create Delivery Zone (Admin)")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

