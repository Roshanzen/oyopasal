from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class AuditAction(models.TextChoices):
    LOGIN = 'LOGIN', 'User Login'
    LOGOUT = 'LOGOUT', 'User Logout'
    CREATE = 'CREATE', 'Record Created'
    UPDATE = 'UPDATE', 'Record Updated'
    DELETE = 'DELETE', 'Record Deleted'
    KYC_VERIFICATION = 'KYC_VERIFICATION', 'KYC Approved or Rejected'
    SETTLEMENT_APPROVAL = 'SETTLEMENT_APPROVAL', 'Vendor Settlement Approved'
    REFUND_DISBURSEMENT = 'REFUND_DISBURSEMENT', 'Customer Refund Disbursed'
    PLAN_CHANGE = 'PLAN_CHANGE', 'SaaS Plan Modified'
    SYSTEM_CONFIG = 'SYSTEM_CONFIG', 'Platform Setting Modified'


class AuditLog(BaseModel):
    """
    Immutable audit trail for compliance, security investigation, and IRD regulatory auditing.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    user_email = models.CharField(max_length=255, blank=True)
    action = models.CharField(max_length=50, choices=AuditAction.choices, db_index=True)
    target_model = models.CharField(max_length=100, db_index=True)
    target_id = models.CharField(max_length=100, blank=True, db_index=True)
    description = models.TextField(blank=True)
    delta_changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['target_model', 'created_at']),
            models.Index(fields=['action', 'created_at']),
        ]

    def __str__(self):
        actor = self.user_email or (self.user.email if self.user else 'System')
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {actor} - {self.action} on {self.target_model}"

