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

export interface SellerLoginPayload {
  identifier?: string;
  password?: string;
  vendor_id?: string;
  demo_quick_login?: boolean;
}
