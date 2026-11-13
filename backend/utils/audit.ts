import { db } from '../../src/db/index.ts';
import { auditLogs, notifications } from '../../src/db/schema.ts';

export async function recordAuditLog(params: {
  actorUserId?: number | null;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole || 'system',
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId),
      details: params.details || {},
      ipAddress: params.ipAddress || null,
    });
  } catch (err) {
    console.warn('Audit log write failed:', err);
  }
}

export async function createNotification(params: {
  userId?: number | null;
  roleScope?: 'all' | 'customer' | 'seller' | 'admin' | 'delivery_agent';
  title: string;
  message: string;
  type?: string;
  referenceUrl?: string;
}) {
  try {
    await db.insert(notifications).values({
      userId: params.userId ?? null,
      roleScope: params.roleScope || 'customer',
      title: params.title,
      message: params.message,
      type: params.type || 'info',
      referenceUrl: params.referenceUrl || null,
      isRead: false,
    });
  } catch (err) {
    console.warn('Notification insert failed:', err);
  }
}
