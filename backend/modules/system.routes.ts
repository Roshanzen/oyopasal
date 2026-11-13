import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { asyncHandler } from '../utils/errors.ts';

const router = Router();

// GET /api/v1/health/
router.get(
  '/health/',
  asyncHandler(async (_req, res) => {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: 'ok',
      service: 'oyopasal-api',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  })
);

// GET /api/v1/db/status/
router.get(
  '/db/status/',
  asyncHandler(async (_req, res) => {
    const countsRes = await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM vendors) AS vendors,
        (SELECT COUNT(*)::int FROM products) AS products,
        (SELECT COUNT(*)::int FROM orders) AS orders,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM categories) AS categories,
        (SELECT COUNT(*)::int FROM delivery_agents) AS riders,
        (SELECT COUNT(*)::int FROM delivery_zones) AS zones
    `);
    const counts = countsRes.rows[0] || {};
    res.json({
      status: 'connected',
      database: process.env.SQL_DB_NAME || 'cloudsql',
      engine: 'PostgreSQL (Cloud SQL)',
      counts,
    });
  })
);

export default router;
