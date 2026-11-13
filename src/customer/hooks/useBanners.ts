import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/services/api';
import { Promotion } from '../../shared/types';

export interface UseBannersOptions {
  placement?: string;
  enabled?: boolean;
}

export interface UseBannersResult {
  banners: Promotion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function isBannerCurrentlyActive(banner: Promotion, nowMs: number): boolean {
  if (banner.is_active === false) return false;
  if (banner.starts_at) {
    const startMs = Date.parse(banner.starts_at);
    if (!Number.isNaN(startMs) && startMs > nowMs) return false;
  }
  if (banner.ends_at) {
    const endMs = Date.parse(banner.ends_at);
    if (!Number.isNaN(endMs) && endMs < nowMs) return false;
  }
  return true;
}

function sortByDisplayPriority(a: Promotion, b: Promotion): number {
  const priorityA = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER;
  const priorityB = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER;
  if (priorityA !== priorityB) return priorityA - priorityB;
  return (a.db_id ?? 0) - (b.db_id ?? 0);
}

export function useBanners(options: UseBannersOptions = {}): UseBannersResult {
  const { placement, enabled = true } = options;
  const [banners, setBanners] = useState<Promotion[]>([]);
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
      const res = await api.getPromotions(placement);
      if (seq !== requestSeqRef.current) return;

      const nowMs = Date.now();
      const activeSorted = (res.results || [])
        .filter((banner) => isBannerCurrentlyActive(banner, nowMs))
        .sort(sortByDisplayPriority);

      setBanners(activeSorted);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load promotional banners');
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, placement]);

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
    banners,
    loading,
    error,
    refetch: fetchBanners,
  };
}
