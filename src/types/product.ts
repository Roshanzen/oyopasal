export interface Category {
  id: string;
  db_id?: number;
  name: string;
  name_ne?: string;
  slug: string;
  parent_id?: number | null;
  icon: string;
  image_url?: string | null;
  item_count: number;
  accent: string;
  description: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  unit: string;
  price: number;
  original_price: number;
  stock: number;
}

export interface Product {
  id: string;
  db_id?: number;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string };
  vendor: { id: string; name: string; rating: number; delivery_time_mins: string };
  original_price: number;
  discounted_price: number;
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
  sections: string[];
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
