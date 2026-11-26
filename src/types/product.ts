export interface Category {
  id: string;
  db_id?: number;
  name: string;
  name_ne?: string;
  slug: string;
  parent_id?: string | number | null;
  icon: string;
  icon_url?: string;
  image_url?: string | null;
  ordering?: number;
  item_count: number;
  product_count?: number;
  accent: string;
  description: string;
  subcategories?: Category[];
}

export interface ProductColorOption {
  name: string;
  color_code?: string;
  image_url?: string | null;
  in_stock?: boolean;
}

export interface ProductVariant {
  id: string;
  sku?: string;
  name: string;
  unit?: string;
  price: number;
  original_price: number;
  selling_price?: number;
  regular_price?: number;
  discounted_price?: number;
  stock: number;
  stock_quantity?: number;
  in_stock?: boolean;
  is_available?: boolean;
  is_default?: boolean;
  color?: string;
  color_name?: string;
  color_code?: string;
  size?: string;
  image_url?: string | null;
  attributes?: Record<string, any>;
}

export interface Product {
  id: string;
  db_id?: number;
  name: string;
  slug: string;
  base_sku?: string;
  category: { id: string; name: string; slug: string };
  category_slug?: string;
  vendor: { id: string; name: string; slug?: string; phone?: string; rating: number; delivery_time_mins: string };
  original_price: number;
  discounted_price: number;
  price?: number;
  selling_price?: number;
  regular_price?: number;
  discount_percentage: number;
  unit: string;
  stock: number;
  low_stock_threshold?: number;
  in_stock: boolean;
  is_organic: boolean;
  rating: number;
  reviews_count: number;
  image_url: string;
  gallery: string[];
  gallery_items?: { id: number; image_url: string; alt_text?: string; sort_order: number; is_primary: boolean }[];
  description: string;
  origin: string;
  variants: ProductVariant[];
  has_variants?: boolean;
  available_colors?: ProductColorOption[];
  available_sizes?: string[];
  sections: string[];
  created_at?: string;
}

export interface Promotion {
  id: string;
  db_id?: number;
  title: string;
  title_ne?: string;
  subtitle: string;
  subtitle_ne?: string;
  badge: string;
  badge_ne?: string;
  cta_text: string;
  cta_text_ne?: string;
  cta_category: string;
  destination_url?: string | null;
  image: string;
  code?: string;
  color_theme?: string;
  placement?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface Advertisement {
  id: string;
  db_id: number;
  title: string;
  title_ne?: string;
  subtitle: string;
  subtitle_ne?: string;
  brand_name?: string;
  brand_logo?: string;
  offer_text?: string;
  offer_text_ne?: string;
  badge?: string;
  badge_ne?: string;
  cta_text?: string;
  cta_text_ne?: string;
  image_url: string;
  destination_url: string;
  placement: string;
  priority: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  clicks_count: number;
}

export interface ReviewItem {
  id: number;
  rating: number;
  title?: string | null;
  comment: string;
  author_name: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface HeroBanner {
  id: number;
  image: string;
  image_url: string;
  target_url: string;
  alt_text: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}
