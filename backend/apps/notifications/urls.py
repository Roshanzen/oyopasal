from django.urls import path
from .views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    UnreadNotificationCountView,
)

app_name = 'notifications'

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification_list'),
    path('unread-count/', UnreadNotificationCountView.as_view(), name='notification_unread_count'),
    path('mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification_mark_all_read'),
    path('read-all/', NotificationMarkAllReadView.as_view(), name='notification_read_all_alias'),
    path('<uuid:id>/read/', NotificationMarkReadView.as_view(), name='notification_mark_read'),
]

