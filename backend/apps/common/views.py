import os
import time
import django
from django.db import connection
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.services.imagekit_service import ImageKitService


class ApiHomepageView(APIView):
    """
    Root API homepage describing the service and providing navigation links.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="API Root Homepage",
        description="Public API entry point and directory.",
        responses={200: dict}
    )
    def get(self, request):
        return Response({
            "success": True,
            "project": "OyoPasal",
            "message": "OyoPasal API is running successfully",
            "version": getattr(settings, 'APP_VERSION', '1.0.0'),
            "documentation": "/api/docs/",
            "health_check": "/api/v1/health/"
        }, status=status.HTTP_200_OK)


@csrf_exempt
def api_not_found_view(request, exception=None, *args, **kwargs):
    """
    Standard JSON 404 response for unmatched API routes.
    """
    return JsonResponse({
        "success": False,
        "error": {
            "code": "NOT_FOUND",
            "message": f"The requested endpoint '{request.path}' was not found on this server.",
            "details": {
                "documentation": "/api/docs/",
                "health_check": "/api/v1/health/"
            }
        }
    }, status=status.HTTP_404_NOT_FOUND)


@csrf_exempt
def api_server_error_view(request, *args, **kwargs):
    """
    Standard JSON 500 response preventing traceback leaks.
    """
    return JsonResponse({
        "success": False,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected server error occurred while processing your request.",
            "details": None
        }
    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HealthCheckView(APIView):
    """
    Service health check endpoint reporting live status, connectivity across database,
    cache, and essential configuration without exposing sensitive credentials.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Service Health Check",
        description="Verify backend availability, database connectivity, cache layer, and configuration status.",
        responses={200: dict}
    )
    def get(self, request):
        db_healthy = True
        db_error = None
        db_latency = 0.0
        try:
            t0 = time.perf_counter()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            db_latency = round((time.perf_counter() - t0) * 1000, 2)
        except Exception:
            db_healthy = False
            db_error = "Database connectivity failure"

        cache_healthy = True
        cache_error = None
        cache_latency = 0.0
        try:
            t0 = time.perf_counter()
            cache.set('__health_test__', 1, timeout=5)
            val = cache.get('__health_test__')
            if val != 1:
                cache_healthy = False
            cache_latency = round((time.perf_counter() - t0) * 1000, 2)
        except Exception:
            cache_healthy = False
            cache_error = "Cache layer unavailable"

        # Verify required core configurations
        required_configs = {
            'secret_key_configured': bool(getattr(settings, 'SECRET_KEY', None)),
            'database_configured': bool(getattr(settings, 'DATABASES', None)),
            'jwt_configured': bool(getattr(settings, 'SIMPLE_JWT', None)),
            'cors_configured': bool(getattr(settings, 'CORS_ALLOWED_ORIGINS', None) or getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False)),
        }
        config_healthy = all(required_configs.values())

        is_healthy = db_healthy and config_healthy
        http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

        status_text = 'HEALTHY' if is_healthy else 'DEGRADED'
        environment_name = os.getenv('ENVIRONMENT', 'development' if settings.DEBUG else 'production')

        data = {
            'application': {
                'name': 'OyoPasal',
                'status': 'healthy',
                'version': getattr(settings, 'APP_VERSION', '1.0.0'),
                'environment': environment_name,
                'django_version': django.__version__,
            },
            'status': status_text,
            'timestamp': timezone.now().isoformat(),
            'components': {
                'database': {
                    'status': 'healthy' if db_healthy else 'unhealthy',
                    'latency_ms': db_latency,
                    'error': db_error
                },
                'cache': {
                    'status': 'healthy' if cache_healthy else 'unhealthy',
                    'latency_ms': cache_latency,
                    'error': cache_error
                },
                'configuration': {
                    'status': 'healthy' if config_healthy else 'incomplete',
                    'checks': required_configs
                }
            },
            'services': {
                'database': {
                    'status': 'ONLINE' if db_healthy else 'OFFLINE',
                    'latency_ms': db_latency,
                },
                'cache': {
                    'status': 'ONLINE' if cache_healthy else 'OFFLINE',
                    'latency_ms': cache_latency,
                },
                'imagekit': {
                    'status': 'CONNECTED' if getattr(settings, 'IMAGEKIT_PUBLIC_KEY', None) else 'CONFIGURED',
                }
            }
        }

        return Response({
            'success': is_healthy,
            'message': 'Service operational' if is_healthy else 'Service degraded',
            'data': data
        }, status=http_status)


class ImageKitAuthView(APIView):
    """
    Returns signed client-side authentication tokens for uploading assets directly
    to ImageKit CDN without bottlenecking the Django application server.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get ImageKit Direct Upload Auth Token",
        description="Generates signed token, expire timestamp, and HMAC-SHA1 signature for secure direct client uploads.",
        responses={200: dict}
    )
    def get(self, request):
        auth_params = ImageKitService.get_client_upload_auth()
        return Response({
            'success': True,
            'message': 'ImageKit upload authentication generated',
            'data': auth_params
        }, status=status.HTTP_200_OK)


class ResolveImageUrlView(APIView):
    """
    Resolves indirect links (e.g. Google Search share links, Google Drive,
    Instagram/Pinterest share URLs) into direct image binary URLs.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Resolve Indirect Image Link",
        description="Resolves Google Share, Google Drive, or indirect URLs into direct image URLs.",
        responses={200: dict}
    )
    def get(self, request):
        raw_url = request.query_params.get('url', '').strip()
        from apps.common.services.image_resolver import resolve_image_url
        resolved = resolve_image_url(raw_url)
        return Response({
            'success': True,
            'original_url': raw_url,
            'resolved_url': resolved,
            'is_resolved': resolved != raw_url
        }, status=status.HTTP_200_OK)


class PublicSettingsView(APIView):
    """
    Public platform configuration: delivery fee tiers, commission policies,
    operating hours, and brand support contacts.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'delivery_fees': {
                'baseDeliveryFee': 35,
                'freeDeliveryThreshold': 499,
                'handlingFee': 15,
                'defaultEtaMins': 12,
            },
            'commission_policy': {
                'defaultCommissionRate': 10,
                'newSellerZeroCommissionDays': 30,
            },
            'store_support': {
                'brandName': 'OyoPasal',
                'tagline': '10–15 MIN DELIVERY',
                'email': 'support@oyopasal.com.np',
                'phone': '+977 1-4782910',
                'address': 'New Baneshwor, Kathmandu, Nepal',
                'hours': '6:00 AM – 11:00 PM Daily',
            },
        }, status=status.HTTP_200_OK)


    def post(self, request):
        raw_url = request.data.get('url', '').strip()
        from apps.common.services.image_resolver import resolve_image_url
        resolved = resolve_image_url(raw_url)
        return Response({
            'success': True,
            'original_url': raw_url,
            'resolved_url': resolved,
            'is_resolved': resolved != raw_url
        }, status=status.HTTP_200_OK)


class PublicSettingsView(APIView):
    """
    Public platform configuration: delivery fee tiers, commission policies,
    operating hours, and brand support contacts.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'delivery_fees': {
                'baseDeliveryFee': 35,
                'freeDeliveryThreshold': 499,
                'handlingFee': 15,
                'defaultEtaMins': 12,
            },
            'commission_policy': {
                'defaultCommissionRate': 10,
                'newSellerZeroCommissionDays': 30,
            },
            'store_support': {
                'brandName': 'OyoPasal',
                'tagline': '10–15 MIN DELIVERY',
                'email': 'support@oyopasal.com.np',
                'phone': '+977 1-4782910',
                'address': 'New Baneshwor, Kathmandu, Nepal',
                'hours': '6:00 AM – 11:00 PM Daily',
            },
        }, status=status.HTTP_200_OK)



