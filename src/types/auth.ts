export type UserRole = 'customer' | 'seller' | 'admin' | 'delivery_agent' | string;

export interface UserProfile {
  id: string;
  db_id?: number;
  uid?: string;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  role?: UserRole;
  is_verified?: boolean;
  token: string;
  default_address_id: string;
  vendor_id?: string | null;
  vendor_approval_status?: string | null;
  vendor?: {
    id: string;
    name?: string;
    business_name: string;
    status: string;
    approval_status?: string;
    is_approved?: boolean;
    is_verified?: boolean;
    slug: string;
    logo_url?: string;
  } | null;
  has_vendor_access?: boolean;
  is_vendor?: boolean;
}

export interface CustomerLoginPayload {
  phone_or_email: string;
  password?: string;
  full_name?: string;
  demo_quick_login?: boolean;
}

export interface CustomerRegisterPayload {
  full_name: string;
  phone_or_email: string;
  password: string;
}

export interface VendorRegisterPayload {
  owner_name: string;
  store_name: string;
  store_category?: string;
  store_address?: string;
  email_or_phone: string;
  password?: string;
  pan_vat_number?: string;
  city?: string;
  area?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

export interface SellerLoginPayload {
  identifier?: string;
  password?: string;
  vendor_id?: string;
  demo_quick_login?: boolean;
}
