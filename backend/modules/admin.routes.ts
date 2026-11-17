import { Router } from 'express';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import {
  assignAdminOrderRider,
  createAdminAdvertisement,
  createAdminCategory,
  createAdminCoupon,
  createAdminPromotion,
  createAdminZone,
  deactivateAdminCategory,
  deleteAdminAdvertisement,
  deleteAdminPromotion,
  generateAdminSettlement,
  getAdminOverview,
  getAdminSettlements,
  listAdminAdvertisements,
  listAdminAuditLogs,
  listAdminCoupons,
  listAdminOrders,
  listAdminPayments,
  listAdminProducts,
  listAdminPromotions,
  listAdminRefunds,
  listAdminRiders,
  listAdminSellers,
  listAdminSettings,
  listAdminTickets,
  listAdminUsers,
  listAdminZones,
  moderateAdminProduct,
  payAdminSettlement,
  updateAdminAdvertisement,
  updateAdminCategory,
  updateAdminCoupon,
  updateAdminPromotion,
  updateAdminRefund,
  updateAdminRider,
  updateAdminSellerApproval,
  updateAdminTicket,
  updateAdminUser,
  upsertAdminSetting,
} from '../services/adminService.ts';
import { asyncHandler } from '../utils/errors.ts';

const router = Router();

// Protect all /admin/* endpoints
router.use('/admin', requireAuth, requireRole('admin'));

// Analytics & KPI Overview
router.get(
  '/admin/overview/',
  asyncHandler(async (req, res) => {
    res.json(await getAdminOverview(req.query.from, req.query.to));
  })
);

// Users
router.get(
  '/admin/users/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminUsers());
  })
);

router.patch(
  '/admin/users/:id/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateAdminUser(req));
  })
);

// Sellers
router.get(
  '/admin/sellers/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminSellers());
  })
);

router.patch(
  '/admin/sellers/:id/approval/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateAdminSellerApproval(req));
  })
);

// Products Moderation
router.get(
  '/admin/products/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminProducts());
  })
);

router.patch(
  '/admin/products/:id/moderation/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await moderateAdminProduct(req));
  })
);

// Categories CMS
router.post(
  '/admin/categories/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAdminCategory(req.body));
  })
);

router.patch(
  '/admin/categories/:id/',
  asyncHandler(async (req, res) => {
    res.json(await updateAdminCategory(req.params.id, req.body));
  })
);

router.delete(
  '/admin/categories/:id/',
  asyncHandler(async (req, res) => {
    res.json(await deactivateAdminCategory(req.params.id));
  })
);

// Banners / Promotions CMS
router.get(
  '/admin/promotions/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminPromotions());
  })
);

router.post(
  '/admin/promotions/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAdminPromotion(req.body));
  })
);

router.patch(
  '/admin/promotions/:id/',
  asyncHandler(async (req, res) => {
    res.json(await updateAdminPromotion(req.params.id, req.body));
  })
);

router.delete(
  '/admin/promotions/:id/',
  asyncHandler(async (req, res) => {
    res.json(await deleteAdminPromotion(req.params.id));
  })
);

// Advertisements CMS
router.get(
  '/admin/advertisements/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminAdvertisements());
  })
);

router.post(
  '/admin/advertisements/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAdminAdvertisement(req.body));
  })
);

router.patch(
  '/admin/advertisements/:id/',
  asyncHandler(async (req, res) => {
    res.json(await updateAdminAdvertisement(req.params.id, req.body));
  })
);

router.delete(
  '/admin/advertisements/:id/',
  asyncHandler(async (req, res) => {
    res.json(await deleteAdminAdvertisement(req.params.id));
  })
);

// Payments Ledger
router.get(
  '/admin/payments/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminPayments());
  })
);

// Orders + Rider Dispatch
router.get(
  '/admin/orders/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminOrders());
  })
);

router.post(
  '/admin/orders/:id/assign-rider/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await assignAdminOrderRider(req));
  })
);

// Refunds
router.get(
  '/admin/refunds/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminRefunds());
  })
);

router.patch(
  '/admin/refunds/:id/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateAdminRefund(req));
  })
);

// Delivery Zones
router.get(
  '/admin/zones/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminZones());
  })
);

router.post(
  '/admin/zones/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAdminZone(req.body));
  })
);

// Riders Fleet Management
router.get(
  '/admin/riders/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminRiders());
  })
);

router.patch(
  '/admin/riders/:id/',
  asyncHandler(async (req, res) => {
    res.json(await updateAdminRider(req.params.id, req.body));
  })
);

// Coupons
router.get(
  '/admin/coupons/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminCoupons());
  })
);

router.post(
  '/admin/coupons/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createAdminCoupon(req.body));
  })
);

router.patch(
  '/admin/coupons/:id/',
  asyncHandler(async (req, res) => {
    res.json(await updateAdminCoupon(req.params.id, Boolean(req.body?.is_active)));
  })
);

// Settlements & Payouts
router.get(
  '/admin/settlements/',
  asyncHandler(async (_req, res) => {
    res.json(await getAdminSettlements());
  })
);

router.post(
  '/admin/settlements/generate/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.status(201).json(await generateAdminSettlement(req));
  })
);

router.patch(
  '/admin/settlements/:id/pay/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await payAdminSettlement(req));
  })
);

// Support Tickets
router.get(
  '/admin/tickets/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminTickets());
  })
);

router.patch(
  '/admin/tickets/:id/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await updateAdminTicket(req));
  })
);

// Audit Logs & Settings
router.get(
  '/admin/audit-logs/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminAuditLogs());
  })
);

router.get(
  '/admin/settings/',
  asyncHandler(async (_req, res) => {
    res.json(await listAdminSettings());
  })
);

router.put(
  '/admin/settings/',
  asyncHandler(async (req: AuthRequest, res) => {
    res.json(await upsertAdminSetting(req));
  })
);

export default router;
