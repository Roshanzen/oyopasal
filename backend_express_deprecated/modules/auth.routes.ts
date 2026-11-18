import { Router } from 'express';
import crypto from 'crypto';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  addresses,
  deliveryAgents,
  sellerProfiles,
  userSessions,
  users,
  vendors,
} from '../../src/db/schema.ts';
import { adminAuth } from '../../src/lib/firebase-admin.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { serializeVendor } from '../services/catalogService.ts';
import { recordAuditLog } from '../utils/audit.ts';
import {
  generateSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../utils/crypto.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();
const authLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'auth' });

async function createDbSession(userId: number, deviceInfo?: string): Promise<string> {
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    deviceInfo: deviceInfo || 'Web Browser',
    expiresAt,
  });

  return rawToken;
}

function serializeUserResponse(u: typeof users.$inferSelect, token?: string) {
  return {
    id: `usr-${u.id}`,
    db_id: u.id,
    uid: u.uid,
    username: u.username || u.email.split('@')[0],
    email: u.email,
    full_name: u.fullName || 'OyoPasal User',
    phone: u.phone || '',
    role: u.role,
    is_verified: u.isVerified,
    token: token || '',
    default_address_id: u.defaultAddressId ? `addr-${u.defaultAddressId}` : '',
  };
}

// POST /api/v1/auth/register/
router.post(
  '/auth/register/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { full_name, phone_or_email, email, phone, password } = req.body as {
      full_name?: string;
      phone_or_email?: string;
      email?: string;
      phone?: string;
      password?: string;
    };

    const identifier = (phone_or_email || email || phone || '').trim();
    if (!identifier) {
      throw new ApiError(400, 'Phone number or email is required.', 'MISSING_IDENTIFIER');
    }
    if (!password || password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long.', 'WEAK_PASSWORD');
    }

    const isEmail = identifier.includes('@');
    const resolvedEmail = isEmail
      ? identifier.toLowerCase()
      : `${identifier.replace(/[^\d]/g, '') || crypto.randomUUID().slice(0, 6)}@customer.oyopasal.np`;
    const resolvedPhone = !isEmail ? identifier : (phone || '').trim();

    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.email, resolvedEmail), resolvedPhone ? eq(users.phone, resolvedPhone) : eq(users.email, resolvedEmail)))
      .limit(1);

    if (existing.length > 0) {
      throw new ApiError(409, 'An account with this email or phone already exists.', 'ACCOUNT_EXISTS');
    }

    const [created] = await db
      .insert(users)
      .values({
        uid: `usr-${crypto.randomUUID()}`,
        email: resolvedEmail,
        username: resolvedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'),
        passwordHash: hashPassword(password),
        fullName: (full_name || '').trim() || 'OyoPasal Customer',
        phone: resolvedPhone || '+977 9800000000',
        role: 'customer',
        isActive: true,
        isVerified: true,
      })
      .returning();

    const token = await createDbSession(created.id, req.headers['user-agent']);
    await recordAuditLog({
      actorUserId: created.id,
      actorRole: created.role,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: created.id,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      token,
      user: serializeUserResponse(created, token),
    });
  })
);

// POST /api/v1/auth/login/
router.post(
  '/auth/login/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone_or_email, email, password, full_name, demo_quick_login } = req.body as {
      phone_or_email?: string;
      email?: string;
      password?: string;
      full_name?: string;
      demo_quick_login?: boolean;
    };

    const identifier = (phone_or_email || email || '').trim();
    if (!identifier) {
      throw new ApiError(400, 'Please enter your phone number or email.', 'MISSING_IDENTIFIER');
    }

    const found = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, identifier.toLowerCase()),
          eq(users.phone, identifier),
          eq(users.username, identifier)
        )
      )
      .limit(1);

    if (found.length === 0) {
      // Allow explicit registration flow via /auth/register/ or demo helper only for seeded demo account
      throw new ApiError(401, 'Invalid credentials. Check your email/phone and password.', 'INVALID_CREDENTIALS');
    }

    const userRow = found[0];
    if (!userRow.isActive) {
      throw new ApiError(403, 'Account is deactivated or suspended.', 'ACCOUNT_DISABLED');
    }

    // Seeded preview demo quick login only works for explicit preview demo accounts
    const allowedDemoUids = new Set([
      'demo-customer-roshan',
      'admin-oyopasal-root',
      'rider-ramesh-pandey',
    ]);
    if (demo_quick_login && allowedDemoUids.has(userRow.uid)) {
      const token = await createDbSession(userRow.id, req.headers['user-agent']);
      return res.json({
        success: true,
        token,
        user: serializeUserResponse(userRow, token),
      });
    }

    if (!password) {
      throw new ApiError(400, 'Password is required.', 'PASSWORD_REQUIRED');
    }

    if (!verifyPassword(password, userRow.passwordHash)) {
      throw new ApiError(401, 'Incorrect password. Please try again.', 'INVALID_CREDENTIALS');
    }

    if (full_name && full_name.trim() && full_name.trim() !== userRow.fullName) {
      await db
        .update(users)
        .set({ fullName: full_name.trim(), updatedAt: new Date() })
        .where(eq(users.id, userRow.id));
      userRow.fullName = full_name.trim();
    }

    const token = await createDbSession(userRow.id, req.headers['user-agent']);
    await recordAuditLog({
      actorUserId: userRow.id,
      actorRole: userRow.role,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: userRow.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: serializeUserResponse(userRow, token),
    });
  })
);

// POST /api/v1/auth/firebase-login/
router.post(
  '/auth/firebase-login/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { id_token, full_name, phone } = req.body as {
      id_token?: string;
      full_name?: string;
      phone?: string;
    };
    if (!id_token) {
      throw new ApiError(400, 'Firebase id_token is required.', 'MISSING_ID_TOKEN');
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(id_token);
    } catch {
      throw new ApiError(401, 'Invalid or expired Firebase ID token.', 'INVALID_FIREBASE_TOKEN');
    }

    const uid = decoded.uid;
    const email = (decoded.email || `${uid}@oyopasal.np`).toLowerCase();
    const resolvedName = (full_name || decoded.name || email.split('@')[0]).trim();

    let rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (rows.length === 0) {
      rows = await db
        .insert(users)
        .values({
          uid,
          email,
          username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'),
          fullName: resolvedName,
          phone: phone || decoded.phone_number || '',
          role: 'customer',
          isActive: true,
          isVerified: Boolean(decoded.email_verified),
        })
        .returning();
    } else if (phone && !rows[0].phone) {
      rows = await db
        .update(users)
        .set({ phone, updatedAt: new Date() })
        .where(eq(users.id, rows[0].id))
        .returning();
    }

    const userRow = rows[0];
    if (!userRow.isActive) {
      throw new ApiError(403, 'Your account has been suspended.', 'ACCOUNT_SUSPENDED');
    }

    const sessionToken = await createDbSession(userRow.id, 'Firebase OAuth');
    res.json({
      success: true,
      token: sessionToken,
      user: serializeUserResponse(userRow, sessionToken),
    });
  })
);

// POST /api/v1/auth/seller/login/
router.post(
  '/auth/seller/login/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, password, vendor_id, demo_quick_login } = req.body as {
      identifier?: string;
      password?: string;
      vendor_id?: string;
      demo_quick_login?: boolean;
    };

    let vendorRow: typeof vendors.$inferSelect | undefined;
    let sellerUser: typeof users.$inferSelect | undefined;

    if (vendor_id && demo_quick_login) {
      const vRows = await db
        .select()
        .from(vendors)
        .where(or(eq(vendors.externalKey, vendor_id), eq(vendors.slug, vendor_id)))
        .limit(1);
      if (vRows.length === 0) {
        throw new ApiError(404, 'Selected vendor store not found.', 'VENDOR_NOT_FOUND');
      }
      vendorRow = vRows[0];
      if (!vendorRow.ownerUserId) {
        throw new ApiError(400, 'Vendor store has no linked owner account.', 'VENDOR_NO_OWNER');
      }
      const uRows = await db.select().from(users).where(eq(users.id, vendorRow.ownerUserId)).limit(1);
      sellerUser = uRows[0];
    } else {
      const cleanId = (identifier || '').trim();
      if (!cleanId) {
        throw new ApiError(400, 'Store email or phone number is required.', 'MISSING_IDENTIFIER');
      }
      if (!password) {
        throw new ApiError(400, 'Store password is required.', 'PASSWORD_REQUIRED');
      }

      const uRows = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.email, cleanId.toLowerCase()),
            eq(users.phone, cleanId),
            eq(users.username, cleanId)
          )
        )
        .limit(1);

      if (uRows.length === 0 || !verifyPassword(password, uRows[0].passwordHash)) {
        throw new ApiError(401, 'Invalid seller credentials.', 'INVALID_CREDENTIALS');
      }
      sellerUser = uRows[0];
      if (sellerUser.role !== 'seller' && sellerUser.role !== 'admin') {
        throw new ApiError(403, 'This account does not have Seller Portal access.', 'FORBIDDEN_ROLE');
      }

      const owned = await db
        .select()
        .from(vendors)
        .where(eq(vendors.ownerUserId, sellerUser.id))
        .limit(1);
      if (owned.length > 0) {
        vendorRow = owned[0];
      } else {
        const sp = await db
          .select()
          .from(sellerProfiles)
          .where(eq(sellerProfiles.userId, sellerUser.id))
          .limit(1);
        if (sp.length > 0) {
          const v = await db.select().from(vendors).where(eq(vendors.id, sp[0].vendorId)).limit(1);
          vendorRow = v[0];
        }
      }
    }

    if (!sellerUser || !vendorRow) {
      throw new ApiError(404, 'No seller store linked to this account.', 'VENDOR_NOT_FOUND');
    }

    const token = await createDbSession(sellerUser.id, 'Seller Portal');
    await recordAuditLog({
      actorUserId: sellerUser.id,
      actorRole: sellerUser.role,
      action: 'SELLER_LOGIN',
      entityType: 'vendor',
      entityId: vendorRow.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      token,
      user: serializeUserResponse(sellerUser, token),
      vendor: serializeVendor(vendorRow),
    });
  })
);

// POST /api/v1/auth/logout/
router.post(
  '/auth/logout/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    if (req.authToken && req.authToken.startsWith('op_sess_')) {
      const tokenHash = hashToken(req.authToken);
      await db
        .update(userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(userSessions.tokenHash, tokenHash));
    }
    res.json({ success: true, message: 'Signed out cleanly.' });
  })
);

// GET /api/v1/auth/user/
router.get(
  '/auth/user/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const userRow = (await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1))[0];
    if (!userRow) {
      throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
    }
    const defaultAddrs = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.userId, userRow.id), eq(addresses.isDefault, true)))
      .limit(1);

    let agentProfile: typeof deliveryAgents.$inferSelect | null = null;
    if (userRow.role === 'delivery_agent') {
      const agents = await db
        .select()
        .from(deliveryAgents)
        .where(eq(deliveryAgents.userId, userRow.id))
        .limit(1);
      agentProfile = agents[0] || null;
    }

    res.json({
      ...serializeUserResponse(userRow, req.authToken),
      default_address_id: defaultAddrs[0] ? `addr-${defaultAddrs[0].id}` : '',
      vendor_id: req.authUser?.vendorExternalKey || null,
      vendor_approval_status: req.authUser?.vendorApprovalStatus || null,
      delivery_agent: agentProfile
        ? {
            id: agentProfile.id,
            availability_status: agentProfile.availabilityStatus,
            verification_status: agentProfile.verificationStatus,
            vehicle_number: agentProfile.vehicleNumber,
          }
        : null,
    });
  })
);

// PUT /api/v1/auth/user/
router.put(
  '/auth/user/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { full_name, phone } = req.body as { full_name?: string; phone?: string };
    const [updated] = await db
      .update(users)
      .set({
        ...(full_name ? { fullName: full_name.trim() } : {}),
        ...(phone ? { phone: phone.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.authUser!.id))
      .returning();

    res.json(serializeUserResponse(updated, req.authToken));
  })
);

export default router;
