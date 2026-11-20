import { useCallback, useEffect, useRef, useState } from 'react';
import { vendorService } from '../services';
import { HeroBanner, Promotion } from '../types';

export interface UseHeroBannersOptions {
  enabled?: boolean;
}

export interface UseHeroBannersResult {
  heroBanners: HeroBanner[];
  banners: Promotion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHeroBanners(options: UseHeroBannersOptions = {}): UseHeroBannersResult {
  const { enabled = true } = options;
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([]);
  const [legacyBanners, setLegacyBanners] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const fetchBanners = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    try {
      setLoading(true);
      setError(null);

      // Primary: Fetch live active HeroBanner records from /api/hero-banners/
      const heroRes = await vendorService.getHeroBanners();
      if (seq !== requestSeqRef.current) return;

      const heroList: HeroBanner[] = Array.isArray(heroRes)
        ? heroRes
        : ((heroRes as unknown as { results: HeroBanner[] }).results || []);

      const activeHero = heroList.filter((b) => b.is_active !== false);
      setHeroBanners(activeHero);

      // Convert HeroBanner[] to Promotion[] shape for backward compatibility
      const mappedPromotions: Promotion[] = activeHero.map((b) => ({
        id: `hero-${b.id}`,
        db_id: b.id,
        title: b.alt_text || 'OyoPasal Banner',
        subtitle: '',
        badge: '',
        cta_text: 'Shop Now',
        cta_category: '',
        destination_url: b.target_url || '/',
        image: b.image_url || b.image,
        is_active: b.is_active,
        sort_order: b.display_order,
      }));

      setLegacyBanners(mappedPromotions);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      // Secondary fallback to legacy promotions endpoint if error
      try {
        const fallbackRes = await vendorService.getPromotions('hero');
        if (seq !== requestSeqRef.current) return;
        setLegacyBanners(fallbackRes.results || []);
      } catch {
        setError(err instanceof Error ? err.message : 'Failed to load hero banners');
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchBanners();
    return () => {
      requestSeqRef.current += 1;
    };
  }, [enabled, fetchBanners]);

  return {
    heroBanners,
    banners: legacyBanners,
    loading,
    error,
    refetch: fetchBanners,
  };
}

// Backward-compatible alias
export const useBanners = useHeroBanners;
