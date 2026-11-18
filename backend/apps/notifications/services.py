from .models import Notification, NotificationType

class NotificationService:
    @staticmethod
    def send(
        recipient,
        title: str,
        message: str,
        notification_type: str = NotificationType.SYSTEM,
        action_url: str = '',
        metadata: dict = None
    ) -> Notification:
        return Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type,
            action_url=action_url,
            metadata=metadata or {}
        )

