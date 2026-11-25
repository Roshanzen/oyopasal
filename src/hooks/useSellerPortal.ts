import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../config';
import { useApp } from '../context';
import { adminService, categoryService, sellerService } from '../services';
import { ApiRequestError, isAbortError } from '../services/httpClient';
import { safeStorage } from '../utils';
import {
  Category,
  InventoryMovementItem,
  Product,
  SellerDashboardStats,
  SellerFulfillmentItem,
  SellerReviewItem,
  SellerSettlementItem,
  Vendor,
} from '../types';

export type SellerTab = 'analytics' | 'add' | 'products' | 'orders' | 'messages' | 'reviews' | 'ledger' | 'settings' | 'profile';

export function useSellerPortal() {
  const {
    currentSeller,
    loginAsSeller,
    logoutSeller,
    updateCurrentSeller,
    refreshSellerSession,
    vendors,
    refreshVendors,
    showToast,
    setBecomeSellerModalOpen,
    t,
    formatPrice,
    language,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SellerTab>('analytics');
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [dashboardStats, setDashboardStats] = useState<SellerDashboardStats | null>(null);
  const [sellerOrders, setSellerOrders] = useState<SellerFulfillmentItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovementItem[]>([]);
  const [sellerReviews, setSellerReviews] = useState<SellerReviewItem[]>([]);
  const [reviewsAvg, setReviewsAvg] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [storeProfile, setStoreProfile] = useState<Vendor | null>(null);
  const [settlements, setSettlements] = useState<SellerSettlementItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'packed' | 'dispatched'>('all');
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | number | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);

  // Store settings state
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
  const [customLoginError, setCustomLoginError] = useState<string | null>(null);
  const [customLoginErrorCode, setCustomLoginErrorCode] = useState<string | null>(null);
  const [vendorsRefreshing, setVendorsRefreshing] = useState(false);

  // New Product form state
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
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [uploadingGalleryImg, setUploadingGalleryImg] = useState(false);
  const [selectedSections, setSelectedSections] = useState<string[]>(['fresh_arrivals', 'best_sellers']);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantsList, setVariantsList] = useState<Array<{
    id?: string;
    color?: string;
    color_code?: string;
    size?: string;
    price?: number;
    original_price?: number;
    stock?: number;
    image_url?: string;
    is_active?: boolean;
  }>>([]);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockingAll, setRestockingAll] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low' | 'healthy'>('all');

  // Gallery Modal & Delete Confirmation State
  const [galleryModalProduct, setGalleryModalProduct] = useState<Product | null>(null);
  const [modalImgUrl, setModalImgUrl] = useState('');
  const [modalUploading, setModalUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const refreshCategories = useCallback(async (selectSlug?: string) => {
    try {
      setLoadingCategories(true);
      const res = await categoryService.getCategories({ bypassCache: false });
      const list = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setCategories(list);
      if (selectSlug) {
        setCategorySlug(selectSlug);
      } else {
        setCategorySlug((prev) => {
          if (!prev && list.length > 0) return list[0].slug;
          return prev;
        });
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.warn('Failed to load categories:', err);
      }
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    refreshCategories();

    const handleCategoriesUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<Category | undefined>;
      const createdSlug = customEvt.detail?.slug;
      refreshCategories(createdSlug);
    };

    window.addEventListener('categories:updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('categories:updated', handleCategoriesUpdated);
    };
  }, [refreshCategories]);

  const inFlightDashboardRef = useRef(false);
  const inFlightOrdersRef = useRef(false);
  const inFlightMovementsRef = useRef(false);
  const inFlightReviewsRef = useRef(false);
  const initialLoadedSellerIdRef = useRef<string | null>(null);
  const loadedTabsRef = useRef<Set<string>>(new Set());
  const throttledUntilRef = useRef<number>(0);
  const lastSyncTimestampRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleThrottleError = useCallback((err: ApiRequestError) => {
    let waitSeconds = 60;
    if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
      waitSeconds = err.retryAfterSeconds;
    } else {
      const match = String(err.message || '').match(/Expected available in (\d+) seconds/i);
      if (match && match[1]) {
        waitSeconds = parseInt(match[1], 10);
      }
    }
    throttledUntilRef.current = Date.now() + (waitSeconds + 1) * 1000;
    console.warn(`Seller API throttled. Backing off for ${waitSeconds} seconds.`);
  }, []);

  const loadSellerDashboard = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!currentSeller?.id || inFlightDashboardRef.current) return;
    if (Date.now() < throttledUntilRef.current) return;
    inFlightDashboardRef.current = true;
    setLoadingProducts(true);
    setDashboardError(null);
    try {
      const dash = await sellerService.getSellerDashboard(currentSeller.id, {
        bypassCache: true,
        headers: { 'Cache-Control': 'no-cache, no-store' },
        ...options,
      });
      if (options?.signal?.aborted) return;
      setDashboardStats(dash.stats || null);
      if (Array.isArray(dash.products)) {
        setSellerProducts(dash.products);
      } else {
        const res = await sellerService.getSellerProducts(currentSeller.id, options);
        if (options?.signal?.aborted) return;
        setSellerProducts(Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);
      }
      if (dash.vendor) {
        setStoreProfile(dash.vendor);
        safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, dash.vendor);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      if (err instanceof ApiRequestError && err.status === 429) {
        handleThrottleError(err);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to load seller dashboard';
      setDashboardError(msg);
      console.warn('Failed to load seller dashboard', err);
    } finally {
      inFlightDashboardRef.current = false;
      setLoadingProducts(false);
    }
  }, [currentSeller?.id, handleThrottleError]);

  const loadSellerOrders = useCallback(
    async (silent = false, options?: { signal?: AbortSignal }) => {
      if (!currentSeller?.id || inFlightOrdersRef.current) return;
      if (Date.now() < throttledUntilRef.current) return;
      inFlightOrdersRef.current = true;
      if (!silent) setLoadingOrders(true);
      setOrdersError(null);
      try {
        const res = await sellerService.getSellerOrders(currentSeller.id, options);
        if (options?.signal?.aborted) return;
        setSellerOrders(Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);
        lastSyncTimestampRef.current = Date.now();
      } catch (err: unknown) {
        if (isAbortError(err)) return;
        if (err instanceof ApiRequestError && err.status === 429) {
          handleThrottleError(err);
          return;
        }
        const msg = err instanceof Error ? err.message : 'Failed to load store orders';
        setOrdersError(msg);
        console.warn('Failed to load seller orders', err);
      } finally {
        inFlightOrdersRef.current = false;
        if (!silent) setLoadingOrders(false);
      }
    },
    [currentSeller?.id, handleThrottleError]
  );

  const loadMovementsAndStore = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!currentSeller?.id || inFlightMovementsRef.current) return;
    if (Date.now() < throttledUntilRef.current) return;
    inFlightMovementsRef.current = true;
    try {
      const [movRes, storeRes] = await Promise.all([
        sellerService.getSellerInventoryMovements(currentSeller.id, { bypassCache: true, ...options }),
        sellerService.getSellerStore(currentSeller.id, {
          bypassCache: true,
          headers: { 'Cache-Control': 'no-cache, no-store' },
          ...options,
        }),
      ]);
      if (options?.signal?.aborted) return;
      setMovements(Array.isArray(movRes?.results) ? movRes.results : Array.isArray(movRes) ? movRes : []);
      if (storeRes?.vendor) {
        setStoreProfile(storeRes.vendor);
        safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, storeRes.vendor);
        setStoreOnline(storeRes.vendor.is_online !== false);
        setOpenTime(storeRes.vendor.open_time || '06:30');
        setCloseTime(storeRes.vendor.close_time || '22:00');
        setStoreEta(storeRes.vendor.delivery_time_mins || '10-15 mins');
        setStoreDesc(storeRes.vendor.description || '');
        setStoreLogoUrl(storeRes.vendor.logo_url || '');
        setStoreCoverUrl(storeRes.vendor.cover_image_url || storeRes.vendor.image || '');
      }
      setSettlements(Array.isArray(storeRes?.settlements) ? storeRes.settlements : []);
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      if (err instanceof ApiRequestError && err.status === 429) {
        handleThrottleError(err);
        return;
      }
      console.warn('Failed to load movements/store', err);
    } finally {
      inFlightMovementsRef.current = false;
    }
  }, [currentSeller?.id, handleThrottleError]);

  const loadSellerReviews = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!currentSeller?.id || inFlightReviewsRef.current) return;
    if (Date.now() < throttledUntilRef.current) return;
    inFlightReviewsRef.current = true;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const res = await sellerService.getSellerReviews(currentSeller.id, options);
      if (options?.signal?.aborted) return;
      setSellerReviews(Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);
      setReviewsAvg(res.average_rating || 0);
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      if (err instanceof ApiRequestError && err.status === 429) {
        handleThrottleError(err);
        return;
      }
      setReviewsError(err instanceof Error ? err.message : 'Failed to load customer reviews');
    } finally {
      inFlightReviewsRef.current = false;
      setReviewsLoading(false);
    }
  }, [currentSeller?.id, handleThrottleError]);

  // Initial load when currentSeller ID changes
  useEffect(() => {
    const sellerId = currentSeller?.id;
    if (!sellerId) return;

    if (initialLoadedSellerIdRef.current === sellerId) return;
    initialLoadedSellerIdRef.current = sellerId;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    loadSellerDashboard({ signal: controller.signal });
    loadSellerOrders(false, { signal: controller.signal });
    loadMovementsAndStore({ signal: controller.signal });
    loadSellerReviews({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [currentSeller?.id, loadSellerDashboard, loadSellerOrders, loadMovementsAndStore, loadSellerReviews]);

  // On-demand tab refresh: avoid repeated re-fetches for already loaded tabs
  useEffect(() => {
    if (!currentSeller?.id) return;
    if (activeTab === 'orders') {
      const isStale = Date.now() - lastSyncTimestampRef.current > 15000;
      if (isStale) {
        loadSellerOrders(true);
      }
    } else if (activeTab === 'reviews' && !loadedTabsRef.current.has('reviews')) {
      loadedTabsRef.current.add('reviews');
      loadSellerReviews();
    } else if (activeTab === 'ledger' && !loadedTabsRef.current.has('ledger')) {
      loadedTabsRef.current.add('ledger');
      loadMovementsAndStore();
    } else if (activeTab === 'settings' && !loadedTabsRef.current.has('settings')) {
      loadedTabsRef.current.add('settings');
      loadMovementsAndStore();
    }
  }, [activeTab, currentSeller?.id, loadSellerOrders, loadSellerReviews, loadMovementsAndStore]);

  // Non-overlapping adaptive polling while currentSeller is active
  useEffect(() => {
    if (!currentSeller?.id) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const pollLoop = async () => {
      if (isCancelled) return;
      if (Date.now() < throttledUntilRef.current) {
        const remaining = Math.max(5000, throttledUntilRef.current - Date.now());
        if (!isCancelled) timerId = setTimeout(pollLoop, remaining);
        return;
      }
      if (document.visibilityState === 'visible') {
        await loadSellerOrders(true);
      }
      if (!isCancelled) {
        timerId = setTimeout(pollLoop, 20000);
      }
    };

    timerId = setTimeout(pollLoop, 20000);

    const syncOnFocus = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() < throttledUntilRef.current) return;
        const isStale = Date.now() - lastSyncTimestampRef.current > 15000;
        if (isStale) {
          loadSellerOrders(true);
          loadSellerDashboard();
        }
      }
    };

    window.addEventListener('focus', syncOnFocus);
    document.addEventListener('visibilitychange', syncOnFocus);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('focus', syncOnFocus);
      document.removeEventListener('visibilitychange', syncOnFocus);
    };
  }, [currentSeller?.id, loadSellerOrders, loadSellerDashboard]);

  const syncAllSellerData = useCallback(() => {
    loadSellerDashboard();
    loadSellerOrders();
    loadMovementsAndStore();
    loadSellerReviews();
  }, [loadSellerDashboard, loadSellerOrders, loadMovementsAndStore, loadSellerReviews]);

  const handleRefreshVendors = async () => {
    setVendorsRefreshing(true);
    await refreshVendors().finally(() => setVendorsRefreshing(false));
  };

  const handleQuickLogin = async (_vendorId: string) => {
    // Demo quick login permanently removed as part of strict authentication enforcement
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomLoginError(null);
    if (!customStoreId.trim()) {
      showToast(
        language === 'ne' ? 'कृपया आफ्नो मर्चेन्ट इमेल वा फोन नम्बर राख्नुहोस्' : 'Please enter your Merchant email or phone number',
        'error'
      );
      return;
    }
    if (!customPassword) {
      showToast(language === 'ne' ? 'कृपया पासवर्ड राख्नुहोस्' : 'Please enter your seller password', 'error');
      return;
    }
    setLoginLoading(true);
    setCustomLoginError(null);
    setCustomLoginErrorCode(null);
    try {
      await loginAsSeller({ identifier: customStoreId.trim(), password: customPassword });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setCustomLoginError(msg);
      const code = (err as any)?.code || (err as any)?.error?.code || null;
      setCustomLoginErrorCode(code);
    } finally {
      setLoginLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setSelectedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
  };

  const handlePrimaryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrimaryImg(true);
    try {
      const asset = await adminService.uploadMediaFile(file, 'product', undefined, true);
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
      const asset = await adminService.uploadMediaFile(file, 'product_gallery', undefined, true);
      setGalleryUrls((prev) => (prev.includes(asset.url) ? prev : [...prev, asset.url]));
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
    const isValid =
      ['http://', 'https://', '/uploads/', '/media/', 'data:image/', '/static/'].some((p) =>
        trimmed.startsWith(p)
      ) &&
      !trimmed.includes('\n') &&
      !trimmed.includes('\r') &&
      trimmed.length <= 500;

    if (!isValid) {
      showToast(
        language === 'ne' ? 'कृपया मान्य फोटो URL राख्नुहोस्' : 'Please enter a valid image URL or path',
        'error'
      );
      return;
    }
    if (!galleryUrls.includes(trimmed)) {
      setGalleryUrls((prev) => [...prev, trimmed]);
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
    const isValidImageUrl = (url: string) => {
      if (!url || typeof url !== 'string') return false;
      const t = url.trim();
      if (t.length > 500) return false;
      if (t.includes('\n') || t.includes('\r')) return false;
      const validPrefixes = ['http://', 'https://', '/uploads/', '/media/', 'data:image/', '/static/'];
      return validPrefixes.some((p) => t.startsWith(p));
    };

    const allImages = [customImageUrl.trim(), ...galleryUrls.map((u) => u.trim())]
      .filter(isValidImageUrl)
      .slice(0, 6);

    if (allImages.length === 0) {
      showToast(
        language === 'ne'
          ? 'कृपया कम्तिमा एउटा कभर फोटो राख्नुहोस्'
          : 'Please upload at least 1 cover image for the product',
        'error'
      );
      return;
    }

    const finalImage = allImages[0];
    const sanitizedGallery = allImages.slice(1);

    setSubmittingProduct(true);
    try {
      const res = await sellerService.createSellerProduct({
        vendor_id: currentSeller?.id,
        name: productName.trim(),
        category_slug: categorySlug,
        unit: unit.trim(),
        original_price: Number(originalPrice) || Number(discountedPrice),
        discounted_price: Number(discountedPrice),
        stock: Number(stockCount) || 25,
        is_organic: isOrganic,
        description:
          description.trim() || `${productName.trim()} sourced fresh by ${currentSeller?.name || 'Local Merchant'}.`,
        image_url: finalImage,
        gallery_urls: sanitizedGallery.length > 0 ? sanitizedGallery : undefined,
        images: allImages,
        sections: selectedSections.length > 0 ? selectedSections : ['fresh_arrivals', 'best_sellers'],
        variants: hasVariants && variantsList.length > 0 ? variantsList : undefined,
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
        setHasVariants(false);
        setVariantsList([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : language === 'ne' ? 'सामान प्रकाशित गर्न सकिएन' : 'Failed to publish product';
      showToast(msg, 'error');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleToggleStock = async (productId: string) => {
    try {
      const res = await sellerService.toggleProductStock(productId);
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
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : language === 'ne' ? 'स्टक अपडेट गर्न सकिएन' : 'Could not update product stock',
        'error'
      );
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeletingProduct(true);
    try {
      const res = await sellerService.deleteProduct(deleteTarget.id);
      if (res.success) {
        showToast(
          language === 'ne' ? `"${deleteTarget.name}" सूचीबाट हटाइयो` : `"${deleteTarget.name}" removed from catalog`,
          'info'
        );
        setSellerProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        if (lastAddedProduct?.id === deleteTarget.id) setLastAddedProduct(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : language === 'ne' ? 'सामान हटाउन सकिएन' : 'Could not delete product',
        'error'
      );
    } finally {
      setDeletingProduct(false);
    }
  };

  const updateLocalProduct = useCallback((updated: Product) => {
    setSellerProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  const handleRestock = async (productId: string, addQuantity = 25) => {
    setRestockingId(productId);
    try {
      const res = await sellerService.restockProduct(productId, addQuantity);
      if (res.success) {
        showToast(
          language === 'ne'
            ? `"${res.product.name}" रिस्टक भयो! हालको स्टक: ${res.stock} थान।`
            : `Restocked "${res.product.name}"! Current stock: ${res.stock} units.`,
          'success'
        );
        setSellerProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: res.stock, in_stock: res.in_stock } : p))
        );
        await loadMovementsAndStore();
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : language === 'ne' ? 'रिस्टक गर्न सकिएन' : 'Could not restock product',
        'error'
      );
    } finally {
      setRestockingId(null);
    }
  };

  const handleRestockAllLow = async () => {
    const lowItems = sellerProducts.filter((p) => p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock);
    if (lowItems.length === 0) return;
    setRestockingAll(true);
    try {
      for (const item of lowItems) {
        await sellerService.restockProduct(item.id, 25);
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
    fulfillmentId: string | number,
    nextStatus: 'CONFIRMED_BY_VENDOR' | 'PACKED_BY_VENDOR' | 'READY_FOR_RIDER_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED'
  ) => {
    setUpdatingOrderId(fulfillmentId);
    try {
      await sellerService.updateSellerFulfillmentStatus(fulfillmentId, nextStatus, currentSeller?.id);
      showToast(
        language === 'ne'
          ? `अर्डर स्थिति ${nextStatus} मा अपडेट भयो`
          : `Order fulfillment updated to ${nextStatus.replace(/_/g, ' ')}`,
        'success'
      );
      await Promise.all([loadSellerOrders(), loadSellerDashboard()]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update fulfillment status', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStoreLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStoreLogo(true);
    try {
      const asset = await adminService.uploadMediaFile(file, 'vendor_logo', currentSeller?.id, true);
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
      const asset = await adminService.uploadMediaFile(file, 'vendor_cover', currentSeller?.id, true);
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
      const res = await sellerService.updateSellerStore(
        {
          is_online: storeOnline,
          open_time: openTime,
          close_time: closeTime,
          eta: storeEta,
          description: storeDesc,
          ...(storeLogoUrl.trim() ? { logo_url: storeLogoUrl.trim() } : {}),
          ...(storeCoverUrl.trim() ? { cover_image_url: storeCoverUrl.trim() } : {}),
        },
        currentSeller?.id
      );
      if (res.vendor) setStoreProfile(res.vendor);
      await refreshVendors();
      showToast(language === 'ne' ? 'पसल सेटिङ सुरक्षित गरियो' : 'Store settings saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save store settings', 'error');
    } finally {
      setSavingStore(false);
    }
  };

  const handleModalGalleryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !galleryModalProduct) return;
    setModalUploading(true);
    try {
      const asset = await adminService.uploadMediaFile(file, 'product_gallery', galleryModalProduct.id, true);
      const res = await sellerService.addSellerProductImage(galleryModalProduct.id, asset.url, false);
      setGalleryModalProduct(res.product);
      setSellerProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
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
      const res = await sellerService.addSellerProductImage(galleryModalProduct.id, modalImgUrl.trim(), isPrimary);
      setGalleryModalProduct(res.product);
      setSellerProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
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
      const res = await sellerService.deleteSellerProductImage(galleryModalProduct.id, imageId);
      setGalleryModalProduct(res.product);
      setSellerProducts((prev) => prev.map((p) => (p.id === res.product.id ? res.product : p)));
      showToast('Gallery image removed', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete image', 'error');
    } finally {
      setModalUploading(false);
    }
  };

  return {
    currentSeller,
    logoutSeller,
    vendors,
    setBecomeSellerModalOpen,
    t,
    formatPrice,
    language,
    activeTab,
    setActiveTab,
    sellerProducts,
    dashboardStats,
    sellerOrders,
    movements,
    sellerReviews,
    reviewsAvg,
    reviewsLoading,
    reviewsError,
    storeProfile,
    settlements,
    categories,
    loadingCategories,
    refreshCategories,
    loadingProducts,
    loadingOrders,
    ordersError,
    orderStatusFilter,
    setOrderStatusFilter,
    dashboardError,
    updatingOrderId,
    submittingProduct,
    lastAddedProduct,
    storeOnline,
    setStoreOnline,
    openTime,
    setOpenTime,
    closeTime,
    setCloseTime,
    storeEta,
    setStoreEta,
    storeDesc,
    setStoreDesc,
    storeLogoUrl,
    storeCoverUrl,
    uploadingStoreLogo,
    uploadingStoreCover,
    savingStore,
    customStoreId,
    setCustomStoreId,
    customPassword,
    setCustomPassword,
    customLoginError,
    customLoginErrorCode,
    setCustomLoginError,
    loginLoading,
    vendorsRefreshing,
    productName,
    setProductName,
    categorySlug,
    setCategorySlug,
    unit,
    setUnit,
    originalPrice,
    setOriginalPrice,
    discountedPrice,
    setDiscountedPrice,
    stockCount,
    setStockCount,
    isOrganic,
    setIsOrganic,
    description,
    setDescription,
    customImageUrl,
    setCustomImageUrl,
    uploadingPrimaryImg,
    galleryUrls,
    setGalleryUrls,
    galleryUrlInput,
    setGalleryUrlInput,
    uploadingGalleryImg,
    selectedSections,
    toggleSection,
    searchCatalogQuery,
    setSearchCatalogQuery,
    restockingId,
    restockingAll,
    inventoryFilter,
    setInventoryFilter,
    galleryModalProduct,
    setGalleryModalProduct,
    modalImgUrl,
    setModalImgUrl,
    modalUploading,
    deleteTarget,
    setDeleteTarget,
    deletingProduct,
    syncAllSellerData,
    loadSellerDashboard,
    loadSellerOrders,
    loadMovementsAndStore,
    loadSellerReviews,
    handleRefreshVendors,
    handleQuickLogin,
    handleCustomLogin,
    handlePrimaryImageUpload,
    handleGalleryImageUpload,
    handleAddGalleryUrl,
    handleCreateProduct,
    hasVariants,
    setHasVariants,
    variantsList,
    setVariantsList,
    handleToggleStock,
    confirmDeleteProduct,
    handleRestock,
    handleRestockAllLow,
    handleFulfillmentUpdate,
    handleStoreLogoUpload,
    handleStoreCoverUpload,
    handleSaveStoreSettings,
    handleModalGalleryFile,
    handleModalAddUrl,
    handleModalDeleteImage,
    showToast,
    setSellerProducts,
    updateLocalProduct,
  };
}
