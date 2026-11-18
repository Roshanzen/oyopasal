import { Request, Response, NextFunction } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  deliveryAgents,
  sellerProfiles,
  userSessions,
  users,
  vendors,
} from '../../src/db/schema.ts';
import { adminAuth } from '../../src/lib/firebase-admin.ts';
import { hashToken } from '../utils/crypto.ts';
import { ApiError } from '../utils/errors.ts';

export type UserRole = 'customer' | 'seller' | 'admin' | 'delivery_agent';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  username: string | null;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  isVerified: boolean;
  vendorId?: number | null;
  vendorExternalKey?: string | null;
  vendorApprovalStatus?: string | null;
  agentId?: number | null;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
  authToken?: string;
  requestId?: string;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (header.startsWith('Token ')) return header.slice(6).trim();
  return null;
}

async function hydrateUserContext(userRow: typeof users.$inferSelect): Promise<AuthenticatedUser> {
  let vendorId: number | null = null;
  let vendorExternalKey: string | null = null;
  let vendorApprovalStatus: string | null = null;
  let agentId: number | null = null;

  const ownedVendors = await db
    .select()
    .from(vendors)
    .where(eq(vendors.ownerUserId, userRow.id))
    .limit(1);

  if (ownedVendors.length > 0) {
    vendorId = ownedVendors[0].id;
    vendorExternalKey = ownedVendors[0].externalKey || `v-${ownedVendors[0].id}`;
    vendorApprovalStatus = ownedVendors[0].approvalStatus;
  } else {
    const sellerProf = await db
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userRow.id))
      .limit(1);
    if (sellerProf.length > 0) {
      vendorId = sellerProf[0].vendorId;
      vendorApprovalStatus = sellerProf[0].approvalStatus;
      const vRow = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      if (vRow.length > 0) {
        vendorExternalKey = vRow[0].externalKey || `v-${vRow[0].id}`;
        vendorApprovalStatus = vRow[0].approvalStatus;
      }
    }
  }

  const agentRows = await db
    .select()
    .from(deliveryAgents)
    .where(eq(deliveryAgents.userId, userRow.id))
    .limit(1);
  if (agentRows.length > 0) {
    agentId = agentRows[0].id;
  }

  return {
    id: userRow.id,
    uid: userRow.uid,
    email: userRow.email,
    username: userRow.username,
    fullName: userRow.fullName,
    phone: userRow.phone,
    role: (userRow.role as UserRole) || 'customer',
    isActive: userRow.isActive,
    isVerified: userRow.isVerified,
    vendorId,
    vendorExternalKey,
    vendorApprovalStatus,
    agentId,
  };
}

async function resolveUserFromToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;

  // 1. Check DB-backed HMAC session token (op_sess_...)
  if (token.startsWith('op_sess_')) {
    const tokenHash = hashToken(token);
    const now = new Date();
    const rows = await db
      .select({ user: users })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, now)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    if (!rows[0].user.isActive) return null;
    return hydrateUserContext(rows[0].user);
  }

  // 2. Verify real Firebase ID Token via Firebase Admin SDK
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || `${uid}@oyopasal.np`;
    const fullName = decoded.name || email.split('@')[0];

    let existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length === 0) {
      const inserted = await db
        .insert(users)
        .values({
          uid,
          email,
          fullName,
          role: 'customer',
          isVerified: Boolean(decoded.email_verified),
          isActive: true,
        })
        .returning();
      existing = inserted;
    }
    if (!existing[0].isActive) return null;
    return hydrateUserContext(existing[0]);
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req);
    if (token) {
      const authUser = await resolveUserFromToken(token);
      if (authUser) {
        req.authUser = authUser;
        req.authToken = token;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new ApiError(401, 'Authentication required. Please sign in to continue.', 'UNAUTHORIZED');
    }
    const authUser = await resolveUserFromToken(token);
    if (!authUser) {
      throw new ApiError(401, 'Session expired or invalid token. Please sign in again.', 'INVALID_TOKEN');
    }
    if (!authUser.isActive) {
      throw new ApiError(403, 'Your account has been suspended.', 'ACCOUNT_SUSPENDED');
    }
    req.authUser = authUser;
    req.authToken = token;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiError(401, 'Authentication required.', 'UNAUTHORIZED'));
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
          'FORBIDDEN_ROLE'
        )
      );
    }
    next();
  };
};

export const requireApprovedSeller = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.authUser) {
    return next(new ApiError(401, 'Authentication required.', 'UNAUTHORIZED'));
  }
  if (req.authUser.role === 'admin') {
    return next();
  }
  if (req.authUser.role !== 'seller' || !req.authUser.vendorId) {
    return next(new ApiError(403, 'Seller store account required.', 'FORBIDDEN_SELLER'));
  }
  if (req.authUser.vendorApprovalStatus !== 'approved') {
    return next(
      new ApiError(
        403,
        `Your store approval status is "${req.authUser.vendorApprovalStatus}". Admin approval is required before managing live inventory.`,
        'SELLER_NOT_APPROVED'
      )
    );
  }
  next();
};

export function getEffectiveSessionKey(req: AuthRequest): string {
  if (req.authUser) {
    return `user-${req.authUser.id}`;
  }
  const headerKey = req.headers['x-session-key']?.toString().trim();
  if (headerKey && /^[a-zA-Z0-9_-]{6,80}$/.test(headerKey)) {
    return headerKey;
  }
  return 'guest-browser-default';
}
