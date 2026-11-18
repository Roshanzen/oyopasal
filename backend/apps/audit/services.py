import logging
from .models import AuditLog, AuditAction

logger = logging.getLogger(__name__)

class AuditService:
    """Centralized service for recording security and compliance audit events."""

    @staticmethod
    def log(
        action: AuditAction | str,
        target_model: str,
        user=None,
        target_id: str = '',
        description: str = '',
        delta_changes: dict = None,
        request=None
    ) -> AuditLog:
        ip_address = None
        user_agent = ''

        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')

            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
            if not user and request.user.is_authenticated:
                user = request.user

        user_email = user.email if user and hasattr(user, 'email') else ''

        log_entry = AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_email=user_email,
            action=action,
            target_model=target_model,
            target_id=str(target_id),
            description=description,
            delta_changes=delta_changes or {},
            ip_address=ip_address,
            user_agent=user_agent
        )

        logger.info(f"AUDIT: {action} on {target_model} by {user_email or 'System'}")
        return log_entry

