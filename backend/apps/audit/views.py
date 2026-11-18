from rest_framework import generics, permissions
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes
from apps.common.permissions import IsSuperAdmin
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogListView(generics.ListAPIView):
    """
    Query platform audit logs. Restricted strictly to Super Administrators.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    filterset_fields = ['action', 'target_model']
    search_fields = ['user_email', 'target_id', 'description']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return AuditLog.objects.none()
        return AuditLog.objects.all().select_related('user')

    @extend_schema(
        summary="Admin: List Audit Logs",
        description="Inspect immutable compliance logs of administrative actions, KYC updates, and financial operations."
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

