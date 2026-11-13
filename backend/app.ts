import express from 'express';
import fs from 'fs';
import path from 'path';
import docsRouter from './docs/openapi.ts';
import { createRateLimiter } from './middleware/rateLimit.ts';
import accountRoutes from './modules/account.routes.ts';
import adminRoutes from './modules/admin.routes.ts';
import authRoutes from './modules/auth.routes.ts';
import cartRoutes from './modules/cart.routes.ts';
import catalogRoutes from './modules/catalog.routes.ts';
import chatRoutes from './modules/chat.routes.ts';
import deliveryRoutes from './modules/delivery.routes.ts';
import mediaRoutes from './modules/media.routes.ts';
import ordersRoutes from './modules/orders.routes.ts';
import paymentsRoutes from './modules/payments.routes.ts';
import sellerRoutes from './modules/seller.routes.ts';
import systemRoutes from './modules/system.routes.ts';
import { errorHandlerMiddleware, requestLoggerMiddleware } from './utils/errors.ts';

export function createBackendApp() {
  const app = express();

  app.use(requestLoggerMiddleware);
  app.use(express.json({ limit: '10mb' }));

  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  const apiLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 300,
    keyPrefix: 'api',
  });
  app.use('/api/v1', apiLimiter);

  // OpenAPI Docs
  app.use('/api/docs', docsRouter);

  // Modular API v1 Routes
  app.use('/api/v1', systemRoutes);
  app.use('/api/v1', chatRoutes);
  app.use('/api/v1', authRoutes);
  app.use('/api/v1', catalogRoutes);
  app.use('/api/v1', cartRoutes);
  app.use('/api/v1', ordersRoutes);
  app.use('/api/v1', paymentsRoutes);
  app.use('/api/v1', accountRoutes);
  app.use('/api/v1', sellerRoutes);
  app.use('/api/v1', deliveryRoutes);
  app.use('/api/v1', adminRoutes);
  app.use('/api/v1', mediaRoutes);

  // Centralized error handler
  app.use('/api', errorHandlerMiddleware);

  return app;
}
