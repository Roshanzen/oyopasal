import { UserProfile, Vendor } from '../types';

/**
 * Normalizes user role strings to uppercase trimmed format.
 */
export function normalizeRole(role?: string | null): string {
  return String(role || '').trim().toUpperCase();
}

/**
 * Checks if the given role or user is an administrator.
 */
export function isUserAdmin(target?: UserProfile | string | null): boolean {
  if (!target) return false;
  const roleStr = typeof target === 'string' ? target : target.role;
  const r = normalizeRole(roleStr);
  return ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'].includes(r);
}

/**
 * Checks if the given role or user is a delivery rider / agent.
 */
export function isUserRider(target?: UserProfile | string | null): boolean {
  if (!target) return false;
  const roleStr = typeof target === 'string' ? target : target.role;
  const r = normalizeRole(roleStr);
  return ['DELIVERY_RIDER', 'DELIVERY_AGENT', 'RIDER'].includes(r);
}

/**
 * Checks if the user has authorized vendor access.
 * If currentSeller exists with an ID (from active vendor auth), returns true.
 * If user has vendor claims (vendor profile, role VENDOR/VENDOR_OWNER/VENDOR_STAFF), returns true.
 * If user is an Admin, returns true.
 * Pure customer without active seller session returns false.
 */
export function isUserVendor(user?: UserProfile | null, currentSeller?: Vendor | null): boolean {
  if (user) {
    if (isUserAdmin(user)) return true;
    if (user.vendor && user.vendor.id) return true;
    if (user.has_vendor_access) return true;
    const r = normalizeRole(user.role);
    if (['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SELLER'].includes(r)) return true;
    // Pure customer: NEVER grant vendor access based on an unverified foreign currentSeller
    return false;
  }

  // If no user is logged in, only return true if an explicit seller session exists
  return Boolean(currentSeller && currentSeller.id);
}

/**
 * Checks if user is a pure vendor (not primarily a shopping customer).
 */
export function isPureVendor(user?: UserProfile | null): boolean {
  if (!user) return false;
  const r = normalizeRole(user.role);
  return ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SELLER'].includes(r);
}

/**
 * Checks if user is customer-only (no vendor, admin, or rider privileges).
 */
export function isCustomerOnly(user?: UserProfile | null): boolean {
  if (!user) return false;
  return !isUserVendor(user) && !isUserAdmin(user) && !isUserRider(user);
}

/**
 * Resolves post-login redirection path based on user role and context.
 * 
 * Rules:
 * 1. Admin login must open the Admin Dashboard (/admin).
 * 2. Rider login must open the Rider Portal (/rider).
 * 3. Pure Vendor login must open the Vendor Dashboard (/seller).
 * 4. Dual-role (Customer + Vendor) login opens customer shopping (/ or current route),
 *    never automatically forcing them into the Vendor Portal.
 * 5. Customer login opens customer shopping (/ or current route).
 *    If logging in while on a staff portal (/seller, /admin, /rider), redirect to customer home (/).
 */
export function getPostLoginRedirectPath(
  user: UserProfile,
  currentPath = window.location.pathname
): string {
  if (isUserAdmin(user)) {
    return '/admin';
  }

  if (isUserRider(user)) {
    return '/rider';
  }

  if (isPureVendor(user)) {
    return '/seller';
  }

  // Customer or Dual-role user:
  // If customer is currently on a staff/portal route, redirect to customer home /
  if (
    currentPath.startsWith('/seller') ||
    currentPath.startsWith('/admin') ||
    currentPath.startsWith('/rider')
  ) {
    return '/';
  }

  // Otherwise keep current customer shopping path
  return currentPath || '/';
}
