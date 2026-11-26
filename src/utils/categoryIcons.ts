import {
  BookOpen,
  PenTool,
  Palette,
  Zap,
  Apple,
  Milk,
  Package,
  Cookie,
  Shirt,
  HeartPulse,
  Home,
  Headphones,
  Laptop,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Category } from '../types';

/**
 * Smart icon resolver matching category name, slug, or backend icon identifier.
 * Ensures Books, Stationary, Handicrafts & Art, Consumer Electronics, etc.
 * each display their own distinct category icon.
 */
export function getCategoryIcon(cat: Partial<Category>): LucideIcon {
  const slug = (cat.slug || '').toLowerCase();
  const name = (cat.name || '').toLowerCase();
  const iconStr = (cat.icon || '').toLowerCase();

  // Books
  if (slug.includes('book') || name.includes('book') || iconStr === 'bookopen' || iconStr === 'book') {
    return BookOpen;
  }
  // Stationary / Stationery / Pens / Paper
  if (
    slug.includes('station') ||
    name.includes('station') ||
    slug.includes('pen') ||
    name.includes('pen') ||
    iconStr === 'pentool'
  ) {
    return PenTool;
  }
  // Handicrafts & Art / Decor / Craft
  if (
    slug.includes('handicraft') ||
    name.includes('handicraft') ||
    slug.includes('craft') ||
    slug.includes('art') ||
    name.includes('art') ||
    iconStr === 'palette'
  ) {
    return Palette;
  }
  // Consumer Electronics / Tech / Power
  if (
    slug.includes('electronic') ||
    name.includes('electronic') ||
    slug.includes('tech') ||
    name.includes('tech') ||
    iconStr === 'zap'
  ) {
    return Zap;
  }
  // Fruits & Vegetables
  if (slug.includes('fruit') || name.includes('fruit') || slug.includes('veg') || name.includes('veg') || iconStr === 'apple') {
    return Apple;
  }
  // Dairy & Bakery
  if (
    slug.includes('dairy') ||
    name.includes('dairy') ||
    slug.includes('milk') ||
    name.includes('milk') ||
    slug.includes('bakery') ||
    name.includes('bakery') ||
    iconStr === 'milk'
  ) {
    return Milk;
  }
  // Snacks & Beverages
  if (slug.includes('snack') || name.includes('snack') || slug.includes('beverage') || name.includes('beverage') || iconStr === 'cookie') {
    return Cookie;
  }
  // Fashion & Apparel
  if (
    slug.includes('fashion') ||
    name.includes('fashion') ||
    slug.includes('cloth') ||
    name.includes('cloth') ||
    slug.includes('apparel') ||
    name.includes('apparel') ||
    iconStr === 'shirt'
  ) {
    return Shirt;
  }
  // Health & Wellness
  if (slug.includes('health') || name.includes('health') || slug.includes('well') || name.includes('well') || iconStr === 'heartpulse') {
    return HeartPulse;
  }
  // Home & Kitchen
  if (slug.includes('home') || name.includes('home') || slug.includes('kitchen') || name.includes('kitchen') || iconStr === 'home') {
    return Home;
  }
  // Audio & Headphones
  if (slug.includes('headphone') || name.includes('headphone') || slug.includes('audio') || iconStr === 'headphones') {
    return Headphones;
  }
  // Laptops & Computers
  if (slug.includes('laptop') || name.includes('laptop') || slug.includes('computer') || iconStr === 'laptop') {
    return Laptop;
  }
  // Grocery & Staples
  if (slug.includes('grocer') || name.includes('grocer') || iconStr === 'shoppingbag') {
    return ShoppingBag;
  }
  if (iconStr === 'sparkles') {
    return Sparkles;
  }

  return Package;
}
