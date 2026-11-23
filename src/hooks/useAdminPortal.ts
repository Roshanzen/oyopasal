import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context';
import { adminService, categoryService, supportService } from '../services';
import {
  AdminAuditLogItem,
  AdminCouponItem,
  AdminOverviewResponse,
  AdminPaymentItem,
  AdminProductItem,
  AdminRefundItem,
  AdminRiderItem,
  AdminSellerItem,
  AdminSettlementItem,
  AdminTicketItem,
  AdminUserItem,
  AdminVendorBalance,
  AdminZoneItem,
  Advertisement,
  Category,
  Order,
  Promotion,
} from '../types';

export type AdminTab =
  | 'overview'
  | 'hero-banners'
  | 'sellers'
  | 'orders'
  | 'products'
  | 'cms'
  | 'ads'
  | 'payments'
  | 'refunds'
  | 'fleet'
  | 'settlements'
  | 'settings'
  | 'tickets'
  | 'audit';

export function useAdminPortal() {
  const { user, loginCustomer, logoutCustomer, refreshVendors, showToast, formatPrice, language } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [identifier, setIdentifier] = useState('admin@oyopasal.np');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [sellers, setSellers] = useState<AdminSellerItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<AdminProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [paymentsList, setPaymentsList] = useState<AdminPaymentItem[]>([]);
  const [refunds, setRefunds] = useState<AdminRefundItem[]>([]);
  const [zones, setZones] = useState<AdminZoneItem[]>([]);
  const [riders, setRiders] = useState<AdminRiderItem[]>([]);
  const [coupons, setCoupons] = useState<AdminCouponItem[]>([]);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [settlementData, setSettlementData] = useState<{
    vendor_balances: AdminVendorBalance[];
    settlements: AdminSettlementItem[];
  }>({ vendor_balances: [], settlements: [] });
  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [selectedRiderByOrder, setSelectedRiderByOrder] = useState<Record<string, number>>({});

  // CMS: Categories
  const [catName, setCatName] = useState('');
  const [catNameNe, setCatNameNe] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImageUrl, setCatImageUrl] = useState('');
  const [uploadingCatImg, setUploadingCatImg] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatImg, setEditCatImg] = useState('');

  // CMS: Promotions
  const [promoTitle, setPromoTitle] = useState('');
  const [promoSub, setPromoSub] = useState('');
  const [promoImageUrl, setPromoImageUrl] = useState('');
  const [promoDestUrl, setPromoDestUrl] = useState('');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoEndsAt, setPromoEndsAt] = useState('');
  const [uploadingPromoImg, setUploadingPromoImg] = useState(false);

  // CMS: Coupons & Zones
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponVal, setCouponVal] = useState(15);
  const [zoneName, setZoneName] = useState('');
  const [zoneSlug, setZoneSlug] = useState('');
  const [ticketReplyDraft, setTicketReplyDraft] = useState<Record<number, string>>({});

  // Advertisements CRUD state
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adDestUrl, setAdDestUrl] = useState('/search');
  const [adPlacement, setAdPlacement] = useState('homepage_mid');
  const [adPriority, setAdPriority] = useState(1);
  const [uploadingAdImg, setUploadingAdImg] = useState(false);

  // Platform Settings state
  const [deliveryFeesCfg, setDeliveryFeesCfg] = useState({
    baseDeliveryFee: 40,
    freeDeliveryThreshold: 500,
    handlingFee: 10,
    defaultEtaMins: 12,
  });
  const [commissionCfg, setCommissionCfg] = useState({
    defaultCommissionRate: 10,
    newSellerZeroCommissionDays: 30,
  });
  const [supportCfg, setSupportCfg] = useState({
    brandName: 'OyoPasal',
    tagline: '10–15 MIN DELIVERY',
    email: 'care@oyopasal.np',
    phone: '+977-01-4991234',
    address: 'New Baneshwor, Kathmandu',
    hours: '6:00 AM – 11:00 PM Daily',
  });
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadTabData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      if (activeTab === 'overview') {
        const res = await adminService.getAdminOverview(dateFrom || undefined, dateTo || undefined);
        setOverview(res);
      } else if (activeTab === 'sellers') {
        const res = await adminService.getAdminSellers();
        setSellers(res.results || []);
      } else if (activeTab === 'orders') {
        const [ordRes, riderRes] = await Promise.all([adminService.getAdminOrders(), adminService.getAdminRiders()]);
        setOrders(ordRes.results || []);
        setRiders(riderRes.results || []);
      } else if (activeTab === 'products') {
        const res = await adminService.getAdminProducts();
        setProducts(res.results || []);
      } else if (activeTab === 'cms') {
        const [catRes, promoRes, couponRes] = await Promise.all([
          categoryService.getCategories(),
          adminService.getAdminPromotions(),
          adminService.getAdminCoupons(),
        ]);
        setCategories(catRes.results || []);
        setPromotions(promoRes.results || []);
        setCoupons(couponRes.results || []);
      } else if (activeTab === 'ads') {
        const res = await adminService.getAdminAdvertisements();
        setAds(res.results || []);
      } else if (activeTab === 'payments') {
        const res = await adminService.getAdminPayments();
        setPaymentsList(res.results || []);
      } else if (activeTab === 'refunds') {
        const res = await adminService.getAdminRefunds();
        setRefunds(res.results || []);
      } else if (activeTab === 'fleet') {
        const [zRes, rRes, uRes] = await Promise.all([
          adminService.getAdminZones(),
          adminService.getAdminRiders(),
          adminService.getAdminUsers(),
        ]);
        setZones(zRes.results || []);
        setRiders(rRes.results || []);
        setUsersList(uRes.results || []);
      } else if (activeTab === 'settlements') {
        const res = await adminService.getAdminSettlements();
        setSettlementData(res);
      } else if (activeTab === 'settings') {
        const res = await adminService.getAdminSettings();
        const rows = res.results || [];
        for (const row of rows) {
          if (row.key === 'delivery_fees' && row.value) {
            setDeliveryFeesCfg((prev) => ({ ...prev, ...(row.value as typeof prev) }));
          } else if (row.key === 'commission_policy' && row.value) {
            setCommissionCfg((prev) => ({ ...prev, ...(row.value as typeof prev) }));
          } else if (row.key === 'store_support' && row.value) {
            setSupportCfg((prev) => ({ ...prev, ...(row.value as typeof prev) }));
          }
        }
      } else if (activeTab === 'tickets') {
        const res = await adminService.getAdminTickets();
        setTickets(res.results || []);
      } else if (activeTab === 'audit') {
        const res = await adminService.getAdminAuditLogs();
        setAuditLogs(res.results || []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load admin telemetry';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, activeTab, dateFrom, dateTo, showToast]);

  useEffect(() => {
    loadTabData();

    const handleCategoriesUpdated = () => {
      categoryService.getCategories({ bypassCache: true }).then((res) => {
        setCategories(res.results || []);
      }).catch(() => {});
    };
    window.addEventListener('categories:updated', handleCategoriesUpdated);
    return () => window.removeEventListener('categories:updated', handleCategoriesUpdated);
  }, [loadTabData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await loginCustomer({ phone_or_email: identifier.trim(), password });
    } catch {
      // toast handled in context
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickDemoAdmin = async () => {
    setAuthLoading(true);
    try {
      await loginCustomer({ phone_or_email: 'admin@oyopasal.np', demo_quick_login: true });
    } catch {
      // handled in context
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUploadAsset = async (
    file: File,
    entityType: string,
    setBusy: (b: boolean) => void,
    onDone: (url: string) => void
  ) => {
    setBusy(true);
    try {
      const asset = await adminService.uploadMediaFile(file, entityType, undefined, false);
      onDone(asset.url);
      showToast('Image uploaded successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExportSettlementsCsv = () => {
    const rows = [
      ['Settlement ID', 'Vendor', 'Gross Sales', 'Commission', 'Net Payout', 'Status', 'Reference'],
      ...settlementData.settlements.map((s) => [
        s.id,
        s.vendor_name,
        s.grossSales,
        s.commissionTotal,
        s.netPayout,
        s.status,
        s.payoutReference ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oyopasal-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleApproveSeller = async (vendorDbId: number, vendorName: string, approvalStatus: 'approved' | 'suspended') => {
    await adminService.updateSellerApproval(vendorDbId, { approval_status: approvalStatus });
    showToast(`${approvalStatus === 'approved' ? 'Approved' : 'Suspended'} ${vendorName}`, approvalStatus === 'approved' ? 'success' : 'info');
    await Promise.all([loadTabData(), refreshVendors()]);
  };

  const handleToggleCommissionRate = async (vendorDbId: number, currentRate: number) => {
    const nextRate = currentRate === 12 ? 10 : 12;
    await adminService.updateSellerApproval(vendorDbId, { commission_rate: nextRate });
    showToast(`Updated commission rate to ${nextRate}%`, 'success');
    loadTabData();
  };

  const handleAssignRider = async (orderId: string, orderNumber: string) => {
    const agId = selectedRiderByOrder[orderId] || riders[0]?.id;
    if (!agId) return;
    await adminService.assignRiderToOrder(orderId, agId);
    showToast(`Dispatched rider to ${orderNumber}`, 'success');
    loadTabData();
  };

  const handleToggleProductActive = async (productId: number, isActive: boolean) => {
    await adminService.moderateAdminProduct(productId, { is_active: !isActive });
    showToast('Product visibility updated', 'info');
    loadTabData();
  };

  const handleSaveSetting = async (key: string, value: Record<string, unknown>, description: string, label: string) => {
    setSavingSettingKey(key);
    try {
      await adminService.saveAdminSetting(key, value, description);
      await refreshVendors();
      showToast(label, 'success');
    } finally {
      setSavingSettingKey(null);
    }
  };

  const handleReplyTicket = async (ticketId: number) => {
    const txt = (ticketReplyDraft[ticketId] || '').trim();
    if (!txt) return;
    await supportService.replySupportTicket(ticketId, txt);
    setTicketReplyDraft((prev) => ({ ...prev, [ticketId]: '' }));
    loadTabData();
  };

  return {
    user,
    isAdmin,
    logoutCustomer,
    showToast,
    formatPrice,
    language,
    activeTab,
    setActiveTab,
    identifier,
    setIdentifier,
    password,
    setPassword,
    authLoading,
    loading,
    loadError,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    overview,
    sellers,
    orders,
    products,
    categories,
    promotions,
    ads,
    paymentsList,
    refunds,
    zones,
    riders,
    coupons,
    usersList,
    settlementData,
    tickets,
    auditLogs,
    selectedRiderByOrder,
    setSelectedRiderByOrder,
    catName,
    setCatName,
    catNameNe,
    setCatNameNe,
    catSlug,
    setCatSlug,
    catDesc,
    setCatDesc,
    catImageUrl,
    setCatImageUrl,
    uploadingCatImg,
    setUploadingCatImg,
    editingCatId,
    setEditingCatId,
    editCatName,
    setEditCatName,
    editCatImg,
    setEditCatImg,
    promoTitle,
    setPromoTitle,
    promoSub,
    setPromoSub,
    promoImageUrl,
    setPromoImageUrl,
    promoDestUrl,
    setPromoDestUrl,
    promoStartsAt,
    setPromoStartsAt,
    promoEndsAt,
    setPromoEndsAt,
    uploadingPromoImg,
    setUploadingPromoImg,
    couponCode,
    setCouponCode,
    couponDesc,
    setCouponDesc,
    couponVal,
    setCouponVal,
    zoneName,
    setZoneName,
    zoneSlug,
    setZoneSlug,
    ticketReplyDraft,
    setTicketReplyDraft,
    adTitle,
    setAdTitle,
    adSubtitle,
    setAdSubtitle,
    adImageUrl,
    setAdImageUrl,
    adDestUrl,
    setAdDestUrl,
    adPlacement,
    setAdPlacement,
    adPriority,
    setAdPriority,
    uploadingAdImg,
    setUploadingAdImg,
    deliveryFeesCfg,
    setDeliveryFeesCfg,
    commissionCfg,
    setCommissionCfg,
    supportCfg,
    setSupportCfg,
    savingSettingKey,
    loadTabData,
    handleAdminLogin,
    handleQuickDemoAdmin,
    handleUploadAsset,
    handleExportSettlementsCsv,
    handleApproveSeller,
    handleToggleCommissionRate,
    handleAssignRider,
    handleToggleProductActive,
    handleSaveSetting,
    handleReplyTicket,
  };
}
