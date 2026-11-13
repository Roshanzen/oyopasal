import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { translateCategoryName, translateOrderStatus } from '../../shared/i18n/translations';
import { api } from '../../shared/services/api';
import {
  Category,
  InventoryMovementItem,
  Product,
  SellerFulfillmentItem,
  SellerReviewItem,
  Vendor
} from '../../shared/types';
import {
  Store,
  PlusCircle,
  Package,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Trash2,
  ToggleRight,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Search,
  RefreshCw,
  LogOut,
  ChevronRight,
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  History,
  Settings,
  Wallet,
  Upload,
  Image as ImageIcon,
  Star,
  X,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';
import SellerVisualSummary from '../components/SellerVisualSummary';

const PRESET_UNITS = ['250g', '500g', '1 kg', '2 kg', '1L', '500ml', 'Pack of 1', 'Pack of 2', '12 Pcs'];

type SellerTab = 'analytics' | 'add' | 'products' | 'orders' | 'reviews' | 'ledger' | 'settings';

export default function SellerPortalPage() {
  const navigate = useNavigate();
  const {
    currentSeller,
    loginAsSeller,
    logoutSeller,
    vendors,
    refreshVendors,
    showToast,
    setBecomeSellerModalOpen,
    t,
    formatPrice,
    language
  } = useApp();

  const [activeTab, setActiveTab] = useState<SellerTab>('analytics');
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);
  const [sellerOrders, setSellerOrders] = useState<SellerFulfillmentItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovementItem[]>([]);
  const [sellerReviews, setSellerReviews] = useState<SellerReviewItem[]>([]);
  const [reviewsAvg, setReviewsAvg] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [storeProfile, setStoreProfile] = useState<Vendor | null>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'packed' | 'dispatched'>('all');
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);

  // Store settings form state
  const [storeOnline, setStoreOnline] = useState(true);
  const [openTime, setOpenTime] = useState('06:30');
  const [closeTime, setCloseTime] = useState('22:00');
  const [storeEta, setStoreEta] = useState('10-15 mins');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');
  const [storeCoverUrl, setStoreCoverUrl] = useState('');
  const [uploadingStoreLogo, setUploadingStoreLogo] = useState(false);
  const [uploadingStoreCover, setUploadingStoreCover] = useState(false);
  const [savingStore, setSavingStore] = useState(false);

  // Login form state
  const [customStoreId, setCustomStoreId] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [vendorsRefreshing, setVendorsRefreshing] = useState(false);

  // New Product Form State
  const [productName, setProductName] = useState('');
  const [categorySlug, setCategorySlug] = useState('fruits-vegetables');
  const [unit, setUnit] = useState('500g');
  const [originalPrice, setOriginalPrice] = useState<number | ''>(120);
  const [discountedPrice, setDiscountedPrice] = useState<number | ''>(95);
  const [stockCount, setStockCount] = useState<number | ''>(30);
  const [isOrganic, setIsOrganic] = useState(true);
  const [description, setDescription] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadingPrimaryImg, setUploadingPrimaryImg] = useState(false);
  const [previewImgError, setPreviewImgError] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [uploadingGalleryImg, setUploadingGalleryImg] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(['fresh_arrivals', 'best_sellers']);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockingAll, setRestockingAll] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low' | 'healthy'>('all');
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  // Product Gallery Modal State (for existing catalog items)
  const [galleryModalProduct, setGalleryModalProduct] = useState<Product | null>(null);
  const [modalImgUrl, setModalImgUrl] = useState('');
  const [modalUploading, setModalUploading] = useState(false);

  useEffect(() => {
    setPreviewImgError(false);
  }, [customImageUrl]);

  useEffect(() => {
    let active = true;
    setLoadingCategories(true);
    api
      .getCategories()
      .then((res) => {
        if (!active) return;
        const list = res.results || [];
        setCategories(list);
        if (list.length > 0 && !list.some((c) => c.slug === categorySlug)) {
          setCategorySlug(list[0].slug);
        }
      })
      .catch((err) => {
        console.error('Failed to load categories:', err);
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadSellerDashboard = useCallback(async () => {
    if (!currentSeller?.id) return;
    setLoadingProducts(true);
    setDashboardError(null);
    try {
      const dash = await api.getSellerDashboard(currentSeller.id);
      setDashboardStats(dash.stats || null);
      if (Array.isArray(dash.products)) {
        setSellerProducts(dash.products);
      } else {
        const res = await api.getSellerProducts(currentSeller.id);
        setSellerProducts(res.results || []);
      }
      if (dash.vendor) {
        setStoreProfile(dash.vendor);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load seller dashboard';
      setDashboardError(msg);
      console.error('Failed to load seller dashboard', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [currentSeller?.id]);

  const loadSellerOrders = useCallback(async (silent = false) => {
    if (!currentSeller?.id) return;
    if (!silent) setLoadingOrders(true);
    setOrdersError(null);
    try {
      const res = await api.getSellerOrders(currentSeller.id);
      setSellerOrders(res.results || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load store orders';
      setOrdersError(msg);
      console.error('Failed to load seller orders', err);
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  }, [currentSeller?.id]);

  const loadMovementsAndStore = useCallback(async () => {
    if (!currentSeller?.id) return;
    try {
      const [movRes, storeRes] = await Promise.all([
        api.getSellerInventoryMovements(currentSeller.id),
        api.getSellerStore(currentSeller.id)
      ]);
      setMovements(movRes.results || []);
      if (storeRes.vendor) {
        setStoreProfile(storeRes.vendor);
        setStoreOnline(storeRes.vendor.is_online !== false);
        setOpenTime(storeRes.vendor.open_time || '06:30');
        setCloseTime(storeRes.vendor.close_time || '22:00');
        setStoreEta(storeRes.vendor.delivery_time_mins || '10-15 mins');
        setStoreDesc(storeRes.vendor.description || '');
        setStoreLogoUrl(storeRes.vendor.logo_url || '');
        setStoreCoverUrl(storeRes.vendor.cover_image_url || storeRes.vendor.image || '');
      }
      setSettlements(storeRes.settlements || []);
    } catch (err) {
      console.error('Failed to load movements/store', err);
    }
  }, [currentSeller?.id]);

  const loadSellerReviews = useCallback(async () => {
    if (!currentSeller?.id) return;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const res = await api.getSellerReviews(currentSeller.id);
      setSellerReviews(res.results || []);
      setReviewsAvg(res.average_rating || 0);
    } catch (err) {
      setReviewsError(err instanceof Error ? err.message : 'Failed to load customer reviews');
    } finally {
      setReviewsLoading(false);
    }
  }, [currentSeller?.id]);

  useEffect(() => {
    if (currentSeller?.id) {
      loadSellerDashboard();
      loadSellerOrders();
      loadMovementsAndStore();
      loadSellerReviews();
    }
  }, [currentSeller?.id, loadSellerDashboard, loadSellerOrders, loadMovementsAndStore, loadSellerReviews]);

  useEffect(() => {
    if (!currentSeller?.id) return;
    if (activeTab === 'orders') {
      loadSellerOrders();
    }
  }, [activeTab, currentSeller?.id, loadSellerOrders]);

  useEffect(() => {
    if (!currentSeller?.id) return;
    const syncOrdersNow = () => {
      if (document.visibilityState === 'visible') {
        loadSellerOrders(true);
        loadSellerDashboard();
      }
    };
    window.addEventListener('focus', syncOrdersNow);
    document.addEventListener('visibilitychange', syncOrdersNow);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadSellerOrders(true);
      }
    }, 12000);
    return () => {
      window.removeEventListener('focus', syncOrdersNow);
      document.removeEventListener('visibilitychange', syncOrdersNow);
      window.clearInterval(interval);
    };
  }, [currentSeller?.id, loadSellerOrders, loadSellerDashboard]);

  const handleQuickLogin = async (vendorId: string) => {
    setLoginLoading(true);
    try {
      await loginAsSeller({ vendor_id: vendorId, demo_quick_login: true });
    } catch {
      // handled in context
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStoreId.trim()) {
      showToast(language === 'ne' ? 'कृपया आफ्नो मर्चेन्ट इमेल वा फोन नम्बर राख्नुहोस्' : 'Please enter your Merchant email or phone number', 'error');
      return;
    }
    if (!customPassword) {
      showToast(language === 'ne' ? 'कृपया पासवर्ड राख्नुहोस्' : 'Please enter your seller password', 'error');
      return;
    }
    setLoginLoading(true);
    try {
      await loginAsSeller({ identifier: customStoreId.trim(), password: customPassword });
    } catch {
      // handled in context
    } finally {
      setLoginLoading(false);
    }
  };

  const orig = typeof originalPrice === 'number' ? originalPrice : 0;
  const disc = typeof discountedPrice === 'number' ? discountedPrice : 0;
  const discountPercent = orig > disc && orig > 0 ? Math.round(((orig - disc) / orig) * 100) : 0;

  const toggleSection = (section: string) => {
    setSelectedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const handlePrimaryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrimaryImg(true);
    try {
      const asset = await api.uploadMediaFile(file, 'product', undefined, true);
      setCustomImageUrl(asset.url);
      showToast('Product image uploaded', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed', 'error');
    } finally {
      setUploadingPrimaryImg(false);
      e.target.value = '';
    }
  };

  const handleGalleryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGalleryImg(true);
    try {
      const asset = await api.uploadMediaFile(file, 'product_gallery', undefined, true);
      setGalleryUrls(prev => (prev.includes(asset.url) ? prev : [...prev, asset.url]));
      showToast('Gallery image added', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gallery upload failed', 'error');
    } finally {
      setUploadingGalleryImg(false);
      e.target.value = '';
    }
  };

  const handleAddGalleryUrl = () => {
    const trimmed = galleryUrlInput.trim();
    if (!trimmed) return;
    if (!galleryUrls.includes(trimmed)) {
      setGalleryUrls(prev => [...prev, trimmed]);
    }
    setGalleryUrlInput('');
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      showToast(language === 'ne' ? 'कृपया सामानको नाम राख्नुहोस्' : 'Please enter a product name', 'error');
      return;
    }
    if (!discountedPrice || Number(discountedPrice) <= 0) {
      showToast(language === 'ne' ? 'कृपया मान्य बिक्री मूल्य राख्नुहोस्' : 'Please specify a valid selling price', 'error');
      return;
    }
    if (!unit.trim()) {
      showToast(language === 'ne' ? 'कृपया सामानको परिमाण राख्नुहोस्' : 'Please specify the product unit', 'error');
      return;
    }
    const finalImage = customImageUrl.trim();
    if (!finalImage) {
      showToast(
        language === 'ne'
          ? 'कृपया सामानको फोटो अपलोड वा URL राख्नुहोस्'
          : 'Please upload a product image or provide an image URL',
        'error'
      );
      return;
    }

    setSubmittingProduct(true);
    try {
      const res = await api.createSellerProduct({
        vendor_id: currentSeller?.id,
        name: productName.trim(),
        category_slug: categorySlug,
        unit: unit.trim(),
        original_price: Number(originalPrice) || Number(discountedPrice),
        discounted_price: Number(discountedPrice),
        stock: Number(stockCount) || 25,
        is_organic: isOrganic,
        description: description.trim() || `${productName.trim()} sourced fresh by ${currentSeller?.name || 'Local Merchant'}.`,
        image_url: finalImage,
        gallery_urls: galleryUrls.length > 0 ? galleryUrls : undefined,
        sections: selectedSections.length > 0 ? selectedSections : ['fresh_arrivals', 'best_sellers']
      });

      if (res.success && res.product) {
        showToast(
          language === 'ne'
            ? `"${res.product.name}" प्रकाशित भयो! अब यो ग्राहक पसलमा लाइभ छ।`
            : `"${res.product.name}" published! It is now live on customer pages.`,
          'success'
        );
        setLastAddedProduct(res.product);
        await loadSellerDashboard();
        await loadMovementsAndStore();
        setProductName('');
        setDescription('');
        setCustomImageUrl('');
        setGalleryUrls([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (language === 'ne' ? 'सामान प्रकाशित गर्न सकिएन' : 'Failed to publish product');
      showToast(msg, 'error');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleToggleStock = async (productId: string) => {
    try {
      const res = await api.toggleProductStock(productId);
      if (res.success) {
        showToast(
          language === 'ne'
            ? `स्टक स्थिति अपडेट भयो: ${res.in_stock ? 'स्टकमा छ' : 'स्टक सकिएको चिन्ह लगाइयो'}`
            : `Stock status updated: ${res.in_stock ? 'In Stock' : 'Marked Out of Stock'}`,
          'info'
        );
        await loadSellerDashboard();
        await loadMovementsAndStore();
      }
    } catch (err: any) {
      showToast(err?.message || (language === 'ne' ? 'स्टक अपडेट गर्न सकिएन' : 'Could not update product stock'), 'error');
    }
  };

  const handleDeleteProduct = async (productId: string, name: string) => {
    const confirmMsg = language === 'ne'
      ? `के तपाईं "${name}" लाई आफ्नो सूचीबाट हटाउन चाहनुहुन्छ?`
      : `Are you sure you want to remove "${name}" from your catalog?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await api.deleteProduct(productId);
      if (res.success) {
        showToast(language === 'ne' ? `"${name}" सूचीबाट हटाइयो` : `"${name}" removed from catalog`, 'info');
        setSellerProducts(prev => prev.filter(p => p.id !== productId));
        if (lastAddedProduct?.id === productId) setLastAddedProduct(null);
      }
    } catch (err: any) {
      showToast(err?.message || (language === 'ne' ? 'सामान हटाउन सकिएन' : 'Could not delete product'), 'error');
    }
  };

  const handleRestock = async (productId: string, addQuantity = 25) => {
    setRestockingId(productId);
    try {
      const res = await api.restockProduct(productId, addQuantity);
      if (res.success) {
        showToast(
          language === 'ne'
            ? `"${res.product.name}" रिस्टक भयो! हालको स्टक: ${res.stock} थान।`
            : `Restocked "${res.product.name}"! Current stock: ${res.stock} units.`,
          'success'
        );
        setSellerProducts(prev =>
          prev.map(p => (p.id === productId ? { ...p, stock: res.stock, in_stock: res.in_stock } : p))
        );
        await loadMovementsAndStore();
      }
    } catch (err: any) {
      showToast(err?.message || (language === 'ne' ? 'रिस्टक गर्न सकिएन' : 'Could not restock product'), 'error');
    } finally {
      setRestockingId(null);
    }
  };

  const handleRestockAllLow = async () => {
    const lowItems = sellerProducts.filter(p => p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock);
    if (lowItems.length === 0) return;
    setRestockingAll(true);
    try {
      for (const item of lowItems) {
        await api.restockProduct(item.id, 25);
      }
      showToast(
        language === 'ne'
          ? `सबै ${lowItems.length} कम स्टक सामानहरू सफलतापूर्वक रिस्टक गरिए (+२५ थान)!`
          : `Successfully restocked all ${lowItems.length} low inventory products (+25 units each)!`,
        'success'
      );
      await loadSellerDashboard();
      await loadMovementsAndStore();
    } catch {
      showToast(language === 'ne' ? 'केही सामान रिस्टक गर्न सकिएन' : 'Failed to restock some items', 'error');
    } finally {
      setRestockingAll(false);
    }
  };

  const handleFulfillmentUpdate = async (
    fulfillmentId: number,
    nextStatus: 'CONFIRMED_BY_VENDOR' | 'PACKED_BY_VENDOR' | 'READY_FOR_RIDER_PICKUP' | 'REJECTED'
  ) => {
    setUpdatingOrderId(fulfillmentId);
    try {
      await api.updateSellerFulfillmentStatus(fulfillmentId, nextStatus, currentSeller?.id);
      showToast(
        language === 'ne' ? `अर्डर स्थिति ${nextStatus} मा अपडेट भयो` : `Order fulfillment updated to ${nextStatus.replace(/_/g, ' ')}`,
        'success'
      );
      await Promise.all([loadSellerOrders(), loadSellerDashboard()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update fulfillment status', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStoreLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStoreLogo(true);
    try {
      const asset = await api.uploadMediaFile(file, 'vendor_logo', currentSeller?.id, true);
      setStoreLogoUrl(asset.url);
      showToast('Store logo uploaded', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Logo upload failed', 'error');
    } finally {
      setUploadingStoreLogo(false);
      e.target.value = '';
    }
  };

  const handleStoreCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStoreCover(true);
    try {
      const asset = await api.uploadMediaFile(file, 'vendor_cover', currentSeller?.id, true);
      setStoreCoverUrl(asset.url);
      showToast('Cover image uploaded', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Cover upload failed', 'error');
    } finally {
      setUploadingStoreCover(false);
      e.target.value = '';
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    try {
      const res = await api.updateSellerStore(
        {
          is_online: storeOnline,
          open_time: openTime,
          close_time: closeTime,
          eta: storeEta,
          description: storeDesc,
          ...(storeLogoUrl.trim() ? { logo_url: storeLogoUrl.trim() } : {}),
          ...(storeCoverUrl.trim() ? { cover_image_url: storeCoverUrl.trim() } : {})
        },
        currentSeller?.id
      );
      if (res.vendor) setStoreProfile(res.vendor);
      await refreshVendors();
      showToast(language === 'ne' ? 'पसल सेटिङ सुरक्षित गरियो' : 'Store settings saved', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save store settings', 'error');
    } finally {
      setSavingStore(false);
    }
  };

  const handleModalGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !galleryModalProduct) return;
    setModalUploading(true);
    try {
      const asset = await api.uploadMediaFile(file, 'product_gallery', galleryModalProduct.id, true);
      const res = await api.addSellerProductImage(galleryModalProduct.id, asset.url, false);
      setGalleryModalProduct(res.product);
      setSellerProducts(prev => prev.map(p => (p.id === res.product.id ? res.product : p)));
      showToast('Gallery photo added', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload gallery photo', 'error');
    } finally {
      setModalUploading(false);
      e.target.value = '';
    }
  };

  const handleModalAddUrl = async (isPrimary: boolean) => {
    if (!galleryModalProduct || !modalImgUrl.trim()) return;
    setModalUploading(true);
    try {
      const res = await api.addSellerProductImage(galleryModalProduct.id, modalImgUrl.trim(), isPrimary);
      setGalleryModalProduct(res.product);
      setSellerProducts(prev => prev.map(p => (p.id === res.product.id ? res.product : p)));
      setModalImgUrl('');
      showToast(isPrimary ? 'Primary product image updated' : 'Gallery image added', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add image', 'error');
    } finally {
      setModalUploading(false);
    }
  };

  const handleModalDeleteImage = async (imageId: number) => {
    if (!galleryModalProduct) return;
    setModalUploading(true);
    try {
      const res = await api.deleteSellerProductImage(galleryModalProduct.id, imageId);
      setGalleryModalProduct(res.product);
      setSellerProducts(prev => prev.map(p => (p.id === res.product.id ? res.product : p)));
      showToast('Gallery image removed', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete image', 'error');
    } finally {
      setModalUploading(false);
    }
  };

  // ----------------------------------------------------
  // VIEW: NOT LOGGED IN AS SELLER
  // ----------------------------------------------------
  if (!currentSeller) {
    return (
      <div className="min-h-screen w-full bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-base text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('seller.backCustomer')}</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60">
              <ShieldCheck className="w-4 h-4" />
              <span>{t('slogin.hub')}</span>
            </div>
          </div>

          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-900/30">
              <Store className="w-8 h-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t('seller.portalTitle')}
            </h1>
            <p className="mt-2 text-slate-400 max-w-lg mx-auto text-base">
              {t('seller.portalSub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="bg-slate-800/90 rounded-2xl p-6 border border-slate-700 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>{t('seller.quickLogin')}</span>
                </h2>
                <button
                  type="button"
                  onClick={async () => {
                    setVendorsRefreshing(true);
                    await refreshVendors().finally(() => setVendorsRefreshing(false));
                  }}
                  className="text-xs font-bold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${vendorsRefreshing ? 'animate-spin' : ''}`} />
                  <span>{t('seller.demoAccounts')}</span>
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-4">{t('seller.quickLoginSub')}</p>

              {vendors.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl">
                  {vendorsRefreshing ? 'Loading stores from PostgreSQL...' : 'No verified vendor stores returned yet.'}
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {vendors.map(v => (
                    <button
                      key={v.id}
                      onClick={() => handleQuickLogin(v.id)}
                      disabled={loginLoading}
                      className="w-full text-left p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-emerald-500/60 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors truncate">
                            {v.name}
                          </span>
                          <span className="text-xs bg-emerald-900/60 text-emerald-300 font-mono px-1.5 py-0.5 rounded shrink-0">
                            ★ {v.rating}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5 truncate">
                          {v.tags && v.tags.length > 0 ? v.tags.join(', ') : v.description || 'Verified Store'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {v.area || v.location || v.city || 'Kathmandu Valley'}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-800/90 rounded-2xl p-6 border border-slate-700 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">{t('seller.accountLogin')}</h2>
              <p className="text-sm text-slate-400 mb-5">{t('seller.accountLoginSub')}</p>

              <form onSubmit={handleCustomLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                    {t('seller.storeIdLabel')}
                  </label>
                  <input
                    type="text"
                    value={customStoreId}
                    onChange={e => setCustomStoreId(e.target.value)}
                    placeholder={language === 'ne' ? 'जस्तै: seller.himalayan@oyopasal.np वा +977 9801112201' : 'e.g. seller.himalayan@oyopasal.np or +977 9801112201'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                    {t('seller.passwordLabel')}
                  </label>
                  <input
                    type="password"
                    value={customPassword}
                    onChange={e => setCustomPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-md shadow-emerald-950/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{t('seller.enterDashboard')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-700/80 text-center">
                <p className="text-sm text-slate-400 mb-2">{t('seller.wantToSell')}</p>
                <button
                  type="button"
                  onClick={() => setBecomeSellerModalOpen(true)}
                  className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  {t('seller.applyPartner')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const effectiveVendor = storeProfile || currentSeller;
  const approvalStatus = effectiveVendor.approval_status || (effectiveVendor.verified ? 'approved' : 'pending');
  const isApproved = approvalStatus === 'approved';
  const lowStockItems = sellerProducts.filter(p => p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock);
  const healthyItems = sellerProducts.filter(p => p.stock > (p.low_stock_threshold ?? 5) && p.in_stock);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="w-full">
        {/* Error + Retry Banner */}
        {dashboardError && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{dashboardError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                loadSellerDashboard();
                loadSellerOrders();
                loadMovementsAndStore();
                loadSellerReviews();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Pending Approval Warning Banner */}
        {!isApproved && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-950/70 border border-amber-700/80 text-amber-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-amber-200">
                {language === 'ne'
                  ? `पसल स्थिति: ${approvalStatus.toUpperCase()} — एडमिन स्वीकृति बाँकी छ`
                  : `Store Status: ${approvalStatus.toUpperCase()} — Admin Approval Required`}
              </h3>
              <p className="text-xs text-amber-300/90 mt-1">
                {language === 'ne'
                  ? 'ग्राहक पसलमा नयाँ सामान प्रकाशित गर्न र अर्डर व्यवस्थापन गर्न सुपर एडमिन कन्सोल (/admin) बाट स्वीकृति आवश्यक छ।'
                  : 'Publishing new products and updating live fulfillments require approval from the Admin Console (/admin).'}
              </p>
            </div>
          </div>
        )}

        {/* Top Control Header */}
        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-md overflow-hidden">
                {effectiveVendor.logo_url ? (
                  <img src={effectiveVendor.logo_url} alt={effectiveVendor.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {effectiveVendor.name}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      isApproved
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                        : 'bg-amber-950 text-amber-300 border-amber-800/80'
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`} />
                    {isApproved ? t('seller.verifiedVendor') : approvalStatus.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">
                    ID: {effectiveVendor.id}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {effectiveVendor.location || effectiveVendor.area || (language === 'ne' ? 'काठमाडौं उपत्यका' : 'Kathmandu Valley')} ·{' '}
                  {storeOnline ? (language === 'ne' ? 'पसल अनलाइन छ' : 'Store Online') : (language === 'ne' ? 'पसल रोकिएको' : 'Store Paused')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  loadSellerDashboard();
                  loadSellerOrders();
                  loadMovementsAndStore();
                  loadSellerReviews();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} />
                <span>{language === 'ne' ? 'रिफ्रेस' : 'Sync'}</span>
              </button>

              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span>{t('seller.viewCustomerStore')}</span>
              </Link>

              <button
                onClick={() => {
                  logoutSeller();
                  navigate('/seller');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>{language === 'ne' ? 'पसल बदल्नुहोस्' : 'Switch Store'}</span>
              </button>

              <button
                onClick={() => {
                  logoutSeller();
                  navigate('/seller');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-sm font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('header.signOut')}</span>
              </button>
            </div>
          </div>

          {/* Authoritative PostgreSQL Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">{t('seller.liveCatalog')}</span>
              <span className="text-xl font-bold text-white font-mono tabular-nums">
                {dashboardStats?.total_products ?? sellerProducts.length} {language === 'ne' ? 'सामान' : 'Products'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('products');
                setInventoryFilter('low');
              }}
              className={`rounded-xl p-3 border transition-all text-left cursor-pointer ${
                lowStockItems.length > 0
                  ? 'bg-red-950/50 border-red-700/80 hover:bg-red-950/80 ring-1 ring-red-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                  {t('seller.lowStock')}
                </span>
                {lowStockItems.length > 0 && (
                  <span className="text-xs bg-red-600 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                    {t('seller.alert')}
                  </span>
                )}
              </div>
              <span className={`text-xl font-bold font-mono tabular-nums ${
                lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {lowStockItems.length} {lowStockItems.length === 1 ? t('common.item') : t('common.items')}
              </span>
            </button>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                {language === 'ne' ? 'कुल बिक्री (DB)' : 'Gross Sales (DB)'}
              </span>
              <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                {formatPrice(dashboardStats?.total_revenue ?? 0)}
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                {language === 'ne' ? 'खुद आम्दानी' : 'Net Earnings'}
              </span>
              <span className="text-xl font-bold text-sky-400 font-mono tabular-nums">
                {formatPrice(dashboardStats?.net_earnings ?? 0)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`rounded-xl p-3 border transition-all text-left cursor-pointer ${
                (dashboardStats?.pending_orders ?? sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)).length) > 0
                  ? 'bg-amber-950/40 border-amber-700/80 hover:bg-amber-950/70 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                  {language === 'ne' ? 'बाँकी / कुल अर्डर' : 'Pending / Total Orders'}
                </span>
                {sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(o.status)).length > 0 && (
                  <span className="text-[11px] bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.5 rounded uppercase">
                    NEW
                  </span>
                )}
              </div>
              <span className="text-xl font-bold text-amber-400 font-mono tabular-nums">
                {dashboardStats?.pending_orders ?? sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)).length} / {dashboardStats?.total_orders ?? sellerOrders.length}
              </span>
            </button>
          </div>
        </div>

        {/* Live Action Alert when New Customer Orders Arrive */}
        {activeTab !== 'orders' &&
          sellerOrders.some((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)) && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    {language === 'ne'
                      ? `${sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)).length} नयाँ ग्राहक अर्डर प्राप्त भयो`
                      : `${sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)).length} Active Customer Order(s) Ready for Action`}
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5">
                    {(() => {
                      const newest = sellerOrders.find((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status));
                      return newest
                        ? `Latest: ${newest.order_number} · ${newest.customer_name} (${newest.customer_area}) · ${newest.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}`
                        : '';
                    })()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>{language === 'ne' ? 'अर्डर हेर्नुहोस्' : 'View & Pack Orders'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t('seller.tabAnalytics')}</span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'add' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('seller.tabAdd')}</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'products' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t('seller.tabProducts', { count: sellerProducts.length })}</span>
            {lowStockItems.length > 0 && (
              <span className="text-xs bg-red-600 text-white font-mono px-2 py-0.5 rounded-full font-bold ml-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{t('seller.lowCount', { count: lowStockItems.length })}</span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'orders' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{t('seller.tabOrders')} ({sellerOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'reviews' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{language === 'ne' ? 'ग्राहक समीक्षा' : 'Reviews'} ({sellerReviews.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ledger' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{language === 'ne' ? 'स्टक खाता' : 'Inventory Ledger'}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settings' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{language === 'ne' ? 'पसल सेटिङ र भुक्तानी' : 'Store & Payouts'}</span>
          </button>
        </div>

        {/* TAB 0: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <SellerVisualSummary vendorId={effectiveVendor.id} vendorName={effectiveVendor.name} />

            <div className="bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-white">{t('seller.readyExpand')}</h4>
                <p className="text-sm text-slate-400">{t('seller.readyExpandSub')}</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('seller.addNow')}</span>
                </button>
                <Link
                  to="/"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm border border-slate-700 transition-colors"
                >
                  {t('seller.viewCustomerStore')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: ADD PRODUCT */}
        {activeTab === 'add' && (
          <div>
            {lastAddedProduct && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {language === 'ne' ? 'सामान ग्राहक पसलमा प्रकाशित भयो!' : 'Product Published to Customer Store!'}
                    </h3>
                    <p className="text-sm text-emerald-300">
                      "{lastAddedProduct.name}" ({formatPrice(lastAddedProduct.discounted_price)})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/product/${lastAddedProduct.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                  >
                    <span>{language === 'ne' ? 'सामान पृष्ठ हेर्नुहोस्' : 'View Product Page'}</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-white">{t('seller.createTitle')}</h2>
                    <p className="text-sm text-slate-400">{t('seller.createSub')}</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                    {t('seller.directSync')}
                  </span>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">
                      {t('seller.productName')} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      placeholder={language === 'ne' ? 'जस्तै: अर्गानिक फुजी स्याउ' : 'e.g. Organic Red Fuji Apples, Fresh Paneer 500g'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        {t('seller.category')} <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={categorySlug}
                        onChange={e => setCategorySlug(e.target.value)}
                        disabled={loadingCategories && categories.length === 0}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {categories.length === 0 ? (
                          <option value={categorySlug}>
                            {loadingCategories ? 'Loading categories...' : 'Fruits & Vegetables'}
                          </option>
                        ) : (
                          categories.map((cat) => (
                            <option key={cat.id} value={cat.slug}>
                              {translateCategoryName(cat.slug, cat.name, language)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        {t('seller.unitSize')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {PRESET_UNITS.map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setUnit(u)}
                            className={`text-xs px-2.5 py-0.5 rounded cursor-pointer ${
                              unit === u ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        {t('seller.sellingPrice')} <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={discountedPrice}
                        onChange={e => setDiscountedPrice(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        {t('seller.mrpPrice')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={originalPrice}
                        onChange={e => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        {t('seller.stockInventory')}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={stockCount}
                        onChange={e => setStockCount(e.target.value ? Number(e.target.value) : '')}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={isOrganic}
                      onChange={e => setIsOrganic(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700"
                    />
                    <span>{t('seller.certifiedOrganic')}</span>
                  </label>

                  {/* Primary Product Image Upload + URL */}
                  <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    <label className="block text-sm font-bold text-slate-300">
                      {t('seller.productImage')} <span className="text-red-400">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer shrink-0">
                        {uploadingPrimaryImg ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{uploadingPrimaryImg ? 'Uploading...' : 'Upload Image File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePrimaryImageUpload}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={customImageUrl}
                        onChange={e => setCustomImageUrl(e.target.value)}
                        placeholder={language === 'ne' ? 'वा फोटोको URL राख्नुहोस् (https://...)' : 'Or paste image URL (https://... or /uploads/...)'}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Additional Gallery Images */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <span className="text-xs font-bold text-slate-400 block">
                        Additional Gallery Images (Optional)
                      </span>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer shrink-0 border border-slate-700">
                          {uploadingGalleryImg ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5" />
                          )}
                          <span>{uploadingGalleryImg ? 'Uploading...' : 'Add Gallery File'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleGalleryImageUpload}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="text"
                          value={galleryUrlInput}
                          onChange={e => setGalleryUrlInput(e.target.value)}
                          placeholder="Additional gallery image URL..."
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={handleAddGalleryUrl}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold cursor-pointer border border-slate-700"
                        >
                          Add URL
                        </button>
                      </div>
                      {galleryUrls.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {galleryUrls.map((url, idx) => (
                            <div
                              key={`${url}-${idx}`}
                              className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group"
                            >
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setGalleryUrls(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] cursor-pointer"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">
                      {t('seller.placementSections')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'fresh_arrivals', label: t('home.freshArrivalsTitle') },
                        { id: 'best_sellers', label: t('home.bestSellersTitle') },
                        { id: 'top_deals', label: language === 'ne' ? 'विशेष छुट' : 'Top Deals' },
                        { id: 'trending', label: t('home.trendingTitle') },
                        { id: 'recommended', label: t('home.recommendedTitle') }
                      ].map(sec => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => toggleSection(sec.id)}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold text-left border cursor-pointer flex items-center justify-between ${
                            selectedSections.includes(sec.id)
                              ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>{sec.label}</span>
                          {selectedSections.includes(sec.id) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">
                      {t('seller.productDesc')}
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingProduct}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {submittingProduct ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t('seller.publishing')}</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>{t('seller.publishBtn')}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-5 sticky top-36">
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      {t('seller.livePreview')}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">{t('seller.realtime')}</span>
                  </div>

                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md max-w-sm mx-auto">
                    <div className="relative aspect-4/3 w-full bg-slate-800 overflow-hidden flex items-center justify-center">
                      {customImageUrl.trim() && !previewImgError ? (
                        <img
                          src={customImageUrl.trim()}
                          alt="Product Preview"
                          onError={() => setPreviewImgError(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <ImageIcon className="w-9 h-9 opacity-60" />
                          <span className="text-xs">Upload or enter image URL to preview</span>
                        </div>
                      )}
                      {discountPercent > 0 && (
                        <div className="absolute top-2 left-2 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                          {t('pdp.offBadge', { pct: discountPercent })}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
                        <span className="font-semibold truncate max-w-[160px]">{effectiveVendor.name}</span>
                        <span className="font-mono">⚡ {effectiveVendor.delivery_time_mins || '10-12 mins'}</span>
                      </div>
                      <h4 className="font-bold text-white text-base line-clamp-1">
                        {productName.trim() || (language === 'ne' ? 'तपाईंको सामानको नाम' : 'Your Product Title')}
                      </h4>
                      <p className="text-sm text-slate-400 mt-0.5">{unit || '500g'}</p>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-extrabold text-white font-mono tabular-nums">{formatPrice(disc || 95)}</span>
                          {orig > disc && (
                            <span className="text-sm text-slate-500 line-through font-mono tabular-nums">{formatPrice(orig)}</span>
                          )}
                        </div>
                        <span className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">{t('common.add')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY */}
        {activeTab === 'products' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
            {lowStockItems.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-rose-950/90 border border-red-700/80 text-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base sm:text-lg">{t('seller.lowAlertTitle')}</h3>
                    <p className="text-sm text-red-200 mt-1">
                      {lowStockItems.length} {language === 'ne' ? 'सामान कम स्टक वा स्टक सकिएको अवस्थामा छ।' : 'products are at critical stock or out of stock.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={handleRestockAllLow}
                    disabled={restockingAll}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-red-950 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {restockingAll ? <RefreshCw className="w-4 h-4 animate-spin text-red-700" /> : <PlusCircle className="w-4 h-4 text-red-700" />}
                    <span>{t('seller.restockAllLow')}</span>
                  </button>
                  <button
                    onClick={() => setInventoryFilter(inventoryFilter === 'low' ? 'all' : 'low')}
                    className="px-3.5 py-2.5 rounded-xl bg-red-900/80 hover:bg-red-800 text-white font-semibold text-sm border border-red-700/80 cursor-pointer"
                  >
                    {inventoryFilter === 'low' ? t('seller.showAllProducts') : t('seller.filterLowOnly')}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span>{t('seller.inventoryTitle')}</span>
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">{t('seller.inventorySub')}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchCatalogQuery}
                    onChange={e => setSearchCatalogQuery(e.target.value)}
                    placeholder={t('seller.searchCatalogPlaceholder')}
                    className="pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-52 sm:w-64"
                  />
                </div>
                <button
                  onClick={loadSellerDashboard}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setInventoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold cursor-pointer ${
                  inventoryFilter === 'all' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 bg-slate-950/60'
                }`}
              >
                {t('seller.filterAll', { count: sellerProducts.length })}
              </button>
              <button
                onClick={() => setInventoryFilter('low')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer ${
                  inventoryFilter === 'low' ? 'bg-red-600 text-white' : 'bg-red-950/60 text-red-300 border border-red-800/80'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t('seller.filterLow', { count: lowStockItems.length })}</span>
              </button>
              <button
                onClick={() => setInventoryFilter('healthy')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold cursor-pointer ${
                  inventoryFilter === 'healthy' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 bg-slate-950/60'
                }`}
              >
                {t('seller.filterHealthy', { count: healthyItems.length })}
              </button>
            </div>

            {(() => {
              let filtered = sellerProducts.filter(p =>
                p.name.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
                p.category.name.toLowerCase().includes(searchCatalogQuery.toLowerCase())
              );
              if (inventoryFilter === 'low') {
                filtered = filtered.filter(p => p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock);
              } else if (inventoryFilter === 'healthy') {
                filtered = filtered.filter(p => p.stock > (p.low_stock_threshold ?? 5) && p.in_stock);
              }

              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400">
                    {language === 'ne' ? 'कुनै सामान भेटिएन' : 'No matching catalog products found.'}
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-xs">
                        <th className="pb-3 font-semibold">{t('seller.colProduct')}</th>
                        <th className="pb-3 font-semibold">{t('seller.colCategory')}</th>
                        <th className="pb-3 font-semibold">{t('seller.colPrice')}</th>
                        <th className="pb-3 font-semibold">{t('seller.colLevel')}</th>
                        <th className="pb-3 font-semibold">{t('seller.colRestock')}</th>
                        <th className="pb-3 font-semibold text-right">{t('seller.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filtered.map(prod => {
                        const isLowStock = prod.stock <= (prod.low_stock_threshold ?? 5) || !prod.in_stock;
                        const isOut = prod.stock === 0 || !prod.in_stock;
                        const thumbBroken = brokenThumbs[prod.id] || !prod.image_url;
                        return (
                          <tr
                            key={prod.id}
                            className={isLowStock ? 'bg-red-950/30 ring-1 ring-inset ring-red-500/40' : 'hover:bg-slate-800/40'}
                          >
                            <td className="py-3.5 pr-4 pl-3">
                              <div className="flex items-center gap-3">
                                {thumbBroken ? (
                                  <div className="w-11 h-11 rounded-lg bg-slate-800 shrink-0 flex items-center justify-center text-slate-500">
                                    <Sparkles className="w-5 h-5" />
                                  </div>
                                ) : (
                                  <img
                                    src={prod.image_url}
                                    alt={prod.name}
                                    onError={() => setBrokenThumbs(prev => ({ ...prev, [prod.id]: true }))}
                                    className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0"
                                  />
                                )}
                                <div>
                                  <span className={`font-bold text-base block ${isLowStock ? 'text-red-100' : 'text-white'}`}>{prod.name}</span>
                                  <span className="text-xs text-slate-400">
                                    {prod.unit} · {prod.gallery?.length || 1} photo{(prod.gallery?.length || 1) > 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 pr-4 text-slate-300">
                              {translateCategoryName(prod.category.slug || prod.category.name, prod.category.name, language)}
                            </td>
                            <td className="py-3.5 pr-4 font-mono tabular-nums font-bold text-white">
                              {formatPrice(prod.discounted_price)}
                            </td>
                            <td className="py-3.5 pr-4">
                              {isOut ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700">
                                  <AlertCircle className="w-3.5 h-3.5" /> {t('common.outOfStock')} (0)
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/90 text-red-300 border border-red-600">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {t('seller.lowStockOnlyLeft', { count: prod.stock })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.inStock')} ({prod.stock})
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleRestock(prod.id, 25)}
                                  disabled={restockingId === prod.id}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer ${
                                    isLowStock ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700'
                                  }`}
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>{t('seller.quickRestockBtn')}</span>
                                </button>
                                <button
                                  onClick={() => handleRestock(prod.id, 50)}
                                  disabled={restockingId === prod.id}
                                  className="px-2 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
                                >
                                  +50
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setGalleryModalProduct(prod)}
                                  title="Manage Product Gallery"
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>Photos</span>
                                </button>
                                <button
                                  onClick={() => handleToggleStock(prod.id)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
                                >
                                  <ToggleRight className={`w-4 h-4 ${prod.in_stock ? 'text-emerald-400' : 'text-slate-500'}`} />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                  className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 3: LIVE ORDERS (REAL DATABASE FULFILLMENTS) */}
        {activeTab === 'orders' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{t('seller.liveDispatchTitle')}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                    {effectiveVendor.name}
                  </span>
                </h2>
                <p className="text-sm text-slate-400">{t('seller.liveDispatchSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => loadSellerOrders()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                <span>{language === 'ne' ? 'अर्डर रिफ्रेस' : 'Refresh Queue'}</span>
              </button>
            </div>

            {ordersError && (
              <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{ordersError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadSellerOrders()}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logoutSeller();
                      navigate('/seller');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Switch Store
                  </button>
                </div>
              </div>
            )}

            {/* Quick Order Status Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'all', label: language === 'ne' ? `सबै (${sellerOrders.length})` : `All Orders (${sellerOrders.length})` },
                {
                  id: 'pending',
                  label:
                    language === 'ne'
                      ? `नयाँ / बाँकी (${sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(o.status)).length})`
                      : `New / Pending (${sellerOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(o.status)).length})`,
                },
                {
                  id: 'packed',
                  label:
                    language === 'ne'
                      ? `प्याक तयार (${sellerOrders.filter((o) => ['PACKED_BY_VENDOR', 'READY_FOR_RIDER_PICKUP'].includes(o.status)).length})`
                      : `Packed & Ready (${sellerOrders.filter((o) => ['PACKED_BY_VENDOR', 'READY_FOR_RIDER_PICKUP'].includes(o.status)).length})`,
                },
                {
                  id: 'dispatched',
                  label:
                    language === 'ne'
                      ? `पठाइएको / सम्पन्न (${sellerOrders.filter((o) => ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)).length})`
                      : `Dispatched / Done (${sellerOrders.filter((o) => ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(o.status)).length})`,
                },
              ].map((flt) => (
                <button
                  key={flt.id}
                  type="button"
                  onClick={() => setOrderStatusFilter(flt.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    orderStatusFilter === flt.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {flt.label}
                </button>
              ))}
            </div>

            {(() => {
              const filteredOrders = sellerOrders.filter((ord) => {
                if (orderStatusFilter === 'pending') {
                  return ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(ord.status);
                }
                if (orderStatusFilter === 'packed') {
                  return ['PACKED_BY_VENDOR', 'READY_FOR_RIDER_PICKUP'].includes(ord.status);
                }
                if (orderStatusFilter === 'dispatched') {
                  return ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(ord.status);
                }
                return true;
              });

              if (loadingOrders && sellerOrders.length === 0) {
                return <div className="py-12 text-center text-slate-400">{t('common.loading')}</div>;
              }

              if (filteredOrders.length === 0) {
                return (
                  <div className="py-12 px-4 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl space-y-2">
                    <p className="text-base font-semibold text-slate-300">
                      {language === 'ne'
                        ? `"${effectiveVendor.name}" को लागि हाल कुनै अर्डर भेटिएन।`
                        : `No matching customer orders found for "${effectiveVendor.name}".`}
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {language === 'ne'
                        ? 'अर्डरहरू ग्राहकले जुन पसलको सामान किनेका छन् त्यही पसलमा मात्र देखिन्छन्। यदि तपाईं अर्को पसलको अर्डर हेर्न चाहनुहुन्छ भने माथि "पसल बदल्नुहोस्" थिच्नुहोस्।'
                        : 'Each customer order is routed to the store whose products were purchased. If you ordered from another store (e.g. Himalayan Fresh Farms vs Patan Artisan Bakery), click "Switch Store" above.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {filteredOrders.map(ord => (
                    <div
                      key={ord.fulfillment_id}
                      className="p-4 sm:p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-base">{ord.order_number}</span>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(ord.created_at).toLocaleString()}
                          </span>
                          <span className="text-xs bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-semibold">
                            {translateOrderStatus(ord.status, language)}
                          </span>
                          <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            {ord.payment_method.replace(/_/g, ' ')} · {ord.payment_status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-100 font-semibold">
                          {ord.items.length > 0
                            ? ord.items.map(i => `${i.quantity}x ${i.product_name} (${i.unit})`).join(', ')
                            : 'Order items attached'}
                        </p>
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-200 font-semibold">{ord.customer_name}</span>
                          {ord.customer_phone ? ` (${ord.customer_phone})` : ''} ·{' '}
                          {ord.delivery_address ? `${ord.delivery_address}, ` : ''}{ord.customer_area}
                          {ord.delivery_city ? `, ${ord.delivery_city}` : ''}
                        </p>
                        {ord.notes && (
                          <p className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900/50 rounded-lg px-2.5 py-1 inline-block">
                            Note: {ord.notes}
                          </p>
                        )}
                        <p className="text-xs text-slate-400">
                          <strong className="text-emerald-400">Net Payout: {formatPrice(ord.net_payout)}</strong> (Subtotal {formatPrice(ord.subtotal)})
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {ord.status === 'ORDER_PLACED' && (
                          <>
                            <button
                              disabled={updatingOrderId === ord.fulfillment_id}
                              onClick={() => handleFulfillmentUpdate(ord.fulfillment_id, 'CONFIRMED_BY_VENDOR')}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                            >
                              {language === 'ne' ? 'पुष्टि गर्नुहोस्' : 'Confirm Order'}
                            </button>
                            <button
                              disabled={updatingOrderId === ord.fulfillment_id}
                              onClick={() => handleFulfillmentUpdate(ord.fulfillment_id, 'REJECTED')}
                              className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold cursor-pointer"
                            >
                              {language === 'ne' ? 'अस्वीकार' : 'Reject'}
                            </button>
                          </>
                        )}
                        {['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(ord.status) && (
                          <button
                            disabled={updatingOrderId === ord.fulfillment_id}
                            onClick={() => handleFulfillmentUpdate(ord.fulfillment_id, 'PACKED_BY_VENDOR')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                          >
                            {language === 'ne' ? 'प्याक तयार' : 'Mark Packed'}
                          </button>
                        )}
                        {ord.status === 'PACKED_BY_VENDOR' && (
                          <button
                            disabled={updatingOrderId === ord.fulfillment_id}
                            onClick={() => handleFulfillmentUpdate(ord.fulfillment_id, 'READY_FOR_RIDER_PICKUP')}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                          >
                            {language === 'ne' ? 'राइडर पिकअपको लागि तयार' : 'Ready for Rider Pickup'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 4: CUSTOMER REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <span>{language === 'ne' ? 'ग्राहक समीक्षा र मूल्याङ्कन' : 'Customer Reviews & Ratings'}</span>
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Average Store Product Rating: <strong className="text-amber-400">{reviewsAvg || 0} ★</strong> ({sellerReviews.length} reviews)
                </p>
              </div>
              <button
                type="button"
                onClick={loadSellerReviews}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-1.5 cursor-pointer self-start"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reviewsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Reviews</span>
              </button>
            </div>

            {reviewsError ? (
              <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 flex items-center justify-between text-sm">
                <span>{reviewsError}</span>
                <button onClick={loadSellerReviews} className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer">
                  Retry
                </button>
              </div>
            ) : reviewsLoading ? (
              <div className="py-12 text-center text-slate-400">{t('common.loading')}</div>
            ) : sellerReviews.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
                {language === 'ne' ? 'अझै कुनै ग्राहक समीक्षा प्राप्त भएको छैन।' : 'No customer product reviews received yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {sellerReviews.map(rev => (
                  <div key={rev.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {rev.product_image ? (
                        <img src={rev.product_image} alt={rev.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-sm">{rev.product_name}</h4>
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          ★ {rev.rating}/5
                        </span>
                        <span className="text-xs text-slate-300 font-semibold">{rev.author_name}</span>
                        {rev.is_verified_purchase && (
                          <span className="text-xs text-emerald-400 font-semibold">· Verified Buyer</span>
                        )}
                      </div>
                      {rev.title && <p className="text-sm font-bold text-slate-200 mt-1.5">{rev.title}</p>}
                      <p className="text-sm text-slate-400 mt-0.5">{rev.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: INVENTORY LEDGER */}
        {activeTab === 'ledger' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {language === 'ne' ? 'स्टक भित्र/बाहिर खाता (Audit Ledger)' : 'Stock Movement Audit Ledger'}
                </h2>
                <p className="text-sm text-slate-400">
                  {language === 'ne' ? 'अर्डर कट्टी र रिस्टकको वास्तविक PostgreSQL अभिलेख' : 'Immutable PostgreSQL record of order deductions and restocks'}
                </p>
              </div>
              <button
                onClick={loadMovementsAndStore}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 cursor-pointer"
              >
                {language === 'ne' ? 'रिफ्रेस' : 'Refresh'}
              </button>
            </div>

            {movements.length === 0 ? (
              <p className="py-10 text-center text-slate-400">
                {language === 'ne' ? 'कुनै स्टक गतिविधि रेकर्ड छैन।' : 'No inventory movements recorded yet.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Reason</th>
                      <th className="pb-2">Delta</th>
                      <th className="pb-2">Stock Change</th>
                      <th className="pb-2">Note</th>
                      <th className="pb-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {movements.map(m => (
                      <tr key={m.id}>
                        <td className="py-2.5 font-semibold text-white">{m.product_name}</td>
                        <td className="py-2.5 text-xs uppercase text-slate-300">{m.reason}</td>
                        <td className={`py-2.5 font-mono font-bold ${m.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {m.delta >= 0 ? `+${m.delta}` : m.delta}
                        </td>
                        <td className="py-2.5 font-mono text-slate-300">{m.previous_stock} → {m.new_stock}</td>
                        <td className="py-2.5 text-xs text-slate-400">{m.note || m.reference_id || '-'}</td>
                        <td className="py-2.5 text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: STORE SETTINGS & SETTLEMENTS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <span>{language === 'ne' ? 'पसल सञ्चालन सेटिङ' : 'Store Operating Settings'}</span>
              </h2>
              <form onSubmit={handleSaveStoreSettings} className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div>
                    <span className="font-bold text-white block">{language === 'ne' ? 'पसल अनलाइन स्थिति' : 'Accepting Live Orders'}</span>
                    <span className="text-xs text-slate-400">{storeOnline ? 'Online & visible to buyers' : 'Paused temporarily'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStoreOnline(v => !v)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      storeOnline ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {storeOnline ? 'ONLINE' : 'PAUSED'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Open Time</label>
                    <input
                      type="text"
                      value={openTime}
                      onChange={e => setOpenTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Close Time</label>
                    <input
                      type="text"
                      value={closeTime}
                      onChange={e => setCloseTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Dispatch ETA</label>
                    <input
                      type="text"
                      value={storeEta}
                      onChange={e => setStoreEta(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                    />
                  </div>
                </div>

                {/* Store Logo & Cover Uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 block">Store Logo</label>
                    <div className="flex items-center gap-2">
                      {storeLogoUrl && (
                        <img src={storeLogoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
                      )}
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer">
                        {uploadingStoreLogo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>{uploadingStoreLogo ? 'Uploading...' : 'Upload Logo'}</span>
                        <input type="file" accept="image/*" onChange={handleStoreLogoUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 block">Store Cover Banner</label>
                    <div className="flex items-center gap-2">
                      {storeCoverUrl && (
                        <img src={storeCoverUrl} alt="Cover" className="w-14 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
                      )}
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer">
                        {uploadingStoreCover ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>{uploadingStoreCover ? 'Uploading...' : 'Upload Cover'}</span>
                        <input type="file" accept="image/*" onChange={handleStoreCoverUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Store Description</label>
                  <textarea
                    rows={3}
                    value={storeDesc}
                    onChange={e => setStoreDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingStore}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
                >
                  {savingStore ? 'Saving...' : 'Save Store Profile'}
                </button>
              </form>
            </div>

            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span>{language === 'ne' ? 'भुक्तानी र सेटलमेन्ट इतिहास' : 'Settlements & Commission Ledger'}</span>
              </h2>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm flex items-center justify-between">
                <span className="text-slate-400">Platform Commission Rate</span>
                <span className="font-mono font-bold text-amber-400">
                  {dashboardStats?.commission_rate ?? effectiveVendor.commission_rate ?? 10}%
                </span>
              </div>

              {settlements.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  {language === 'ne' ? 'अझै कुनै सेटलमेन्ट भुक्तानी जारी भएको छैन।' : 'No payout settlements issued yet. Completed deliveries accrue in your ledger balance.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {settlements.map((s: any) => (
                    <div key={s.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-bold text-white block">Net Payout: {formatPrice(s.netPayout ?? s.net_payout)}</span>
                        <span className="text-xs text-slate-400">
                          Gross {formatPrice(s.grossSales ?? s.gross_sales)} · Fee {formatPrice(s.commissionTotal ?? s.commission_total)}
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        s.status === 'paid' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Product Gallery Management Modal */}
      {galleryModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Product Gallery</h3>
                <p className="text-xs text-slate-400">{galleryModalProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryModalProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {(galleryModalProduct.gallery_items && galleryModalProduct.gallery_items.length > 0
                ? galleryModalProduct.gallery_items
                : galleryModalProduct.gallery.map((url, idx) => ({ id: -(idx + 1), image_url: url, is_primary: idx === 0 }))
              ).map((item) => (
                <div key={item.id} className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-square">
                  <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                  {item.is_primary && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                      PRIMARY
                    </span>
                  )}
                  {item.id > 0 && (
                    <button
                      type="button"
                      disabled={modalUploading}
                      onClick={() => handleModalDeleteImage(item.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-800">
              <label className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                {modalUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{modalUploading ? 'Uploading...' : 'Upload & Attach New Photo'}</span>
                <input type="file" accept="image/*" onChange={handleModalGalleryFile} className="hidden" />
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={modalImgUrl}
                  onChange={e => setModalImgUrl(e.target.value)}
                  placeholder="Or paste image URL..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
                <button
                  type="button"
                  disabled={modalUploading || !modalImgUrl.trim()}
                  onClick={() => handleModalAddUrl(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  disabled={modalUploading || !modalImgUrl.trim()}
                  onClick={() => handleModalAddUrl(true)}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
                >
                  Set Primary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
