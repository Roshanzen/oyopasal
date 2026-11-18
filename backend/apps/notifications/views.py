from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from .models import Notification
from .serializers import NotificationSerializer

class NotificationListView(generics.ListAPIView):
    """User in-app notifications center with filtering by read/unread status."""
    serializer_class = NotificationSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Notification.objects.none()
        qs = Notification.objects.filter(recipient=user).order_by('-created_at')
        unread_only = self.request.query_params.get('unread')
        if unread_only and unread_only.lower() in ['true', '1']:
            qs = qs.filter(is_read=False)
        return qs

    @extend_schema(summary="List User In-App Notifications")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class NotificationMarkReadView(APIView):
    """Mark a specific notification as read."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Mark Notification As Read")
    def post(self, request, id):
        return self._mark_read(request, id)

    def patch(self, request, id):
        return self._mark_read(request, id)

    def _mark_read(self, request, id):
        try:
            notif = Notification.objects.get(id=id, recipient=request.user)
            notif.is_read = True
            notif.save(update_fields=['is_read'])
            return Response({
                'success': True,
                'message': 'Notification marked as read.',
                'data': NotificationSerializer(notif).data
            })
        except Notification.DoesNotExist:
            return Response({'success': False, 'message': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class NotificationMarkAllReadView(APIView):
    """Mark all unread notifications for the active user as read."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Mark All Notifications As Read")
    def post(self, request):
        return self._mark_all_read(request)

    def patch(self, request):
        return self._mark_all_read(request)

    def _mark_all_read(self, request):
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)

        return Response({
            'success': True,
            'message': f'{updated_count} notification(s) marked as read.',
            'count': updated_count
        })


class UnreadNotificationCountView(APIView):
    """Returns total unread notification count for badge counters."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get Unread Notification Count")
    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})

