import { useCallback, useEffect, useRef, useState } from 'react';
import { categoryService, productService, ProductQueryParams, vendorService } from '../services';
import { Category, Product, ReviewItem, Vendor } from '../types';

export function useProductDetail(id?: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadProductAndReviews = useCallback(async () => {
    if (!id) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      setReviewsError(null);

      const [prodRes, simRes, revRes] = await Promise.allSettled([
        productService.getProductById(id, { signal: controller.signal }),
        productService.getSimilarProducts(id, { signal: controller.signal }),
        productService.getProductReviews(id, { signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      if (prodRes.status === 'fulfilled') {
        const prod = prodRes.value;
        setProduct(prod);

        if (simRes.status === 'fulfilled') {
          setSimilarProducts(simRes.value.results || []);
        }

        if (revRes.status === 'fulfilled') {
          setReviews(revRes.value.results || []);
          setAvgRating(revRes.value.average_rating || prod.rating || 5);
        } else {
          setReviewsError('Unable to load customer reviews right now.');
          setAvgRating(prod.rating || 5);
        }
      } else {
        if (prodRes.reason?.name !== 'AbortError') {
          setError(prodRes.reason instanceof Error ? prodRes.reason.message : 'Failed to load product details.');
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load product details.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadProductAndReviews();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadProductAndReviews]);

  const submitReview = useCallback(
    async (payload: { rating: number; title?: string; comment: string }) => {
      if (!id) throw new Error('Product ID missing');
      const res = await productService.submitProductReview(id, payload);
      await loadProductAndReviews();
      return res;
    },
    [id, loadProductAndReviews]
  );

  return {
    product,
    similarProducts,
    reviews,
    avgRating,
    loading,
    error,
    reviewsError,
    reload: loadProductAndReviews,
    submitReview,
  };
}

export function useCategoryCatalog(slug?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const catRes = await categoryService.getCategories();
      setCategories(catRes.results || []);

      if (slug) {
        const found = catRes.results.find((c) => c.slug === slug);
        setCurrentCategory(found || null);
        const prodRes = await productService.getProducts({ category: slug, page_size: 40 });
        setProducts(prodRes.results || []);
      } else {
        setCurrentCategory(null);
        setProducts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category data');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    categories,
    currentCategory,
    products,
    loading,
    error,
    reload: loadData,
  };
}

export function useProductSearch(params: ProductQueryParams) {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [hasPrevious, setHasPrevious] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([categoryService.getCategories(), vendorService.getVendors()])
      .then(([catRes, vendorRes]) => {
        setCategories(catRes.results || []);
        setVendors(vendorRes.results || []);
      })
      .catch((err) => console.error('Meta load error', err));
  }, []);

  const search = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await productService.getProducts(params);
      setProducts(res.results || []);
      setTotalCount(res.count || 0);
      setHasNext(Boolean(res.next));
      setHasPrevious(Boolean(res.previous));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matching products');
    } finally {
      setLoading(false);
    }
  }, [
    params.search,
    params.category,
    params.vendor,
    params.section,
    params.ordering,
    params.in_stock,
    params.min_price,
    params.max_price,
    params.page,
    params.page_size,
  ]);

  useEffect(() => {
    search();
  }, [search]);

  return {
    products,
    totalCount,
    hasNext,
    hasPrevious,
    categories,
    vendors,
    loading,
    error,
    reload: search,
  };
}
