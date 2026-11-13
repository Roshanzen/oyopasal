import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { mediaAssets } from '../../src/db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// POST /api/v1/media/upload/
router.post(
  '/media/upload/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      data_url,
      base64,
      filename = 'upload.png',
      mime_type,
      entity_type = 'general',
      entity_id,
    } = req.body as {
      data_url?: string;
      base64?: string;
      filename?: string;
      mime_type?: string;
      entity_type?: string;
      entity_id?: string;
    };

    let resolvedMime = (mime_type || '').toLowerCase().trim();
    let rawBase64 = (base64 || '').trim();

    if (data_url && data_url.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/s.exec(data_url.trim());
      if (!match) {
        throw new ApiError(400, 'Invalid data_url image encoding.', 'INVALID_IMAGE_DATA');
      }
      resolvedMime = match[1].toLowerCase().trim();
      rawBase64 = match[2];
    }

    if (!rawBase64) {
      throw new ApiError(400, 'Image payload (data_url or base64) is required.', 'MISSING_IMAGE_DATA');
    }

    const ext = MIME_TO_EXT[resolvedMime];
    if (!ext) {
      throw new ApiError(
        400,
        'Unsupported image MIME type. Allowed: JPEG, PNG, WebP, GIF, SVG.',
        'UNSUPPORTED_MIME_TYPE'
      );
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (buffer.length === 0) {
      throw new ApiError(400, 'Uploaded image is empty.', 'EMPTY_IMAGE');
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, 'Image exceeds maximum 5 MB size limit.', 'FILE_TOO_LARGE');
    }

    ensureUploadsDir();
    const safeStem = path
      .basename(filename, path.extname(filename))
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .slice(0, 32) || 'asset';
    const storedName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeStem}.${ext}`;
    const fullDiskPath = path.join(UPLOADS_DIR, storedName);

    await fs.promises.writeFile(fullDiskPath, buffer);
    const publicUrl = `/uploads/${storedName}`;

    const [created] = await db
      .insert(mediaAssets)
      .values({
        ownerUserId: req.authUser!.id,
        entityType: entity_type.trim() || 'general',
        entityId: entity_id ? String(entity_id) : null,
        filename: path.basename(filename),
        mimeType: resolvedMime,
        sizeBytes: buffer.length,
        url: publicUrl,
        storagePath: fullDiskPath,
      })
      .returning();

    res.status(201).json({
      success: true,
      asset: {
        id: created.id,
        url: created.url,
        filename: created.filename,
        mime_type: created.mimeType,
        size_bytes: created.sizeBytes,
        entity_type: created.entityType,
        created_at: created.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  })
);

// GET /api/v1/media/
router.get(
  '/media/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const rows =
      req.authUser!.role === 'admin'
        ? await db.select().from(mediaAssets).orderBy(desc(mediaAssets.id)).limit(100)
        : await db
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.ownerUserId, req.authUser!.id))
            .orderBy(desc(mediaAssets.id))
            .limit(50);

    res.json({
      count: rows.length,
      results: rows.map((r) => ({
        id: r.id,
        url: r.url,
        filename: r.filename,
        mime_type: r.mimeType,
        size_bytes: r.sizeBytes,
        entity_type: r.entityType,
        entity_id: r.entityId,
        created_at: r.createdAt?.toISOString() || null,
      })),
    });
  })
);

// DELETE /api/v1/media/:id/
router.delete(
  '/media/:id/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) {
      throw new ApiError(400, 'Invalid media asset id.', 'INVALID_ID');
    }
    const existing = await db.select().from(mediaAssets).where(eq(mediaAssets.id, idNum)).limit(1);
    if (!existing[0]) {
      throw new ApiError(404, 'Media asset not found.', 'NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && existing[0].ownerUserId !== req.authUser!.id) {
      throw new ApiError(403, 'You can only delete your own media assets.', 'FORBIDDEN');
    }

    if (existing[0].storagePath && fs.existsSync(existing[0].storagePath)) {
      await fs.promises.unlink(existing[0].storagePath).catch(() => {});
    }
    await db.delete(mediaAssets).where(eq(mediaAssets.id, idNum));
    res.json({ success: true });
  })
);

export default router;
