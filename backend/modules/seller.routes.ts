import { Router } from 'express';
import {
  AuthRequest,
  requireApprovedSeller,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import {
  addSellerProductImage,
  archiveSellerProduct,
  createSellerProduct,
  deleteSellerProductImage,
  getSellerAnalytics,
  getSellerDashboard,
  getSellerInventoryMovements,
  getSellerOrders,
  getSellerReviews,
  getSellerStoreProfile,
  listSellerProducts,
  restockSellerProduct,
  toggleSellerProductStock,
  updateSellerFulfillmentStatus,
  updateSellerProduct,
  updateSellerStoreProfile,
} from '../services/sellerService.ts';
import { asyncHandler } from '../utils/errors.ts';

const router = Router();

router.get(
  '/seller/dashboard/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await getSellerDashboard(req));
  })
);

router.get(
  '/seller/analytics/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await getSellerAnalytics(req));
  })
);

router.get(
  '/seller/products/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await listSellerProducts(req));
  })
);

router.post(
  '/seller/products/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.status(201).json(await createSellerProduct(req));
  })
);

router.put(
  '/seller/products/:id/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateSellerProduct(req));
  })
);

router.patch(
  '/seller/products/:id/toggle-stock/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await toggleSellerProductStock(req));
  })
);

router.patch(
  '/seller/products/:id/restock/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await restockSellerProduct(req));
  })
);

router.delete(
  '/seller/products/:id/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await archiveSellerProduct(req));
  })
);

router.post(
  '/seller/products/:id/images/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.status(201).json(await addSellerProductImage(req));
  })
);

router.delete(
  '/seller/products/:id/images/:imageId/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await deleteSellerProductImage(req));
  })
);

router.get(
  '/seller/reviews/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await getSellerReviews(req));
  })
);

router.get(
  '/seller/inventory/movements/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await getSellerInventoryMovements(req));
  })
);

router.get(
  '/seller/orders/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await getSellerOrders(req));
  })
);

router.patch(
  '/seller/orders/:fulfillmentId/status/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateSellerFulfillmentStatus(req));
  })
);

router.get(
  '/seller/store/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await getSellerStoreProfile(req));
  })
);

router.put(
  '/seller/store/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateSellerStoreProfile(req));
  })
);

export default router;
