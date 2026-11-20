import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryService, productService, vendorService } from '../services';
import { Advertisement, Category, Product, Vendor } from '../types';

export function useHomeData() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadHomeData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const [prodResult, vendorResult, catResult, adResult] = await Promise.allSettled([
        productService.getProducts({ page_size: 50 }, { signal: controller.signal }),
        vendorService.getVendors({ signal: controller.signal }),
        categoryService.getCategories({ signal: controller.signal }),
        vendorService.getAdvertisements(undefined, { signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      const failures: string[] = [];

      if (prodResult.status === 'fulfilled') {
        setProducts(prodResult.value.results || []);
      } else if (prodResult.reason?.name !== 'AbortError') {
        failures.push(prodResult.reason?.message || 'Products failed to load');
      }

      if (vendorResult.status === 'fulfilled') {
        setVendors(vendorResult.value.results || []);
      } else if (vendorResult.reason?.name !== 'AbortError') {
        failures.push(vendorResult.reason?.message || 'Vendors failed to load');
      }

      if (catResult.status === 'fulfilled') {
        setCategories(catResult.value.results || []);
      } else if (catResult.reason?.name !== 'AbortError') {
        failures.push(catResult.reason?.message || 'Categories failed to load');
      }

      if (adResult.status === 'fulfilled') {
        setAdvertisements(adResult.value.results || []);
      }

      if (failures.length >= 3) {
        setError(failures[0] || 'Unable to load storefront catalog from server.');
      } else if (prodResult.status === 'rejected' && prodResult.reason?.name !== 'AbortError') {
        setError(prodResult.reason?.message || 'Unable to load products.');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unable to load storefront data.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadHomeData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadHomeData]);

  const sections = useMemo(() => {
    return {
      bestSellers: products.filter((p) => Array.isArray(p.sections) && p.sections.includes('best_sellers')),
      trending: products.filter((p) => Array.isArray(p.sections) && p.sections.includes('trending')),
      freshArrivals: products.filter((p) => Array.isArray(p.sections) && p.sections.includes('fresh_arrivals')),
      recommended: products.filter((p) => Array.isArray(p.sections) && p.sections.includes('recommended')),
      dailyEssentials: products.filter((p) => Array.isArray(p.sections) && p.sections.includes('daily_essentials')),
      topDeals: products.filter(
        (p) => (Array.isArray(p.sections) && p.sections.includes('top_deals')) || (p.discount_percentage || 0) >= 20
      ),
    };
  }, [products]);

  const topAds = useMemo(
    () => advertisements.filter((a) => a.placement === 'homepage_top'),
    [advertisements]
  );
  const midAds = useMemo(
    () => advertisements.filter((a) => a.placement === 'homepage_mid'),
    [advertisements]
  );
  const bottomAds = useMemo(
    () => advertisements.filter((a) => a.placement === 'homepage_bottom'),
    [advertisements]
  );

  const trackAdClick = useCallback((adId: number) => {
    vendorService.trackAdvertisementClick(adId).catch(() => {});
  }, []);

  return {
    products,
    vendors,
    categories,
    advertisements,
    sections,
    topAds,
    midAds,
    bottomAds,
    loading,
    error,
    reload: loadHomeData,
    trackAdClick,
  };
}
