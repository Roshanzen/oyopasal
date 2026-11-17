export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  id: string;
  title: string;
  recipient_name: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  landmark: string;
  is_default: boolean;
  lat?: number;
  lng?: number;
}

export interface DeliveryZoneItem {
  id: number;
  name: string;
  slug: string;
  city: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  base_delivery_fee: number;
  free_delivery_threshold: number;
  estimated_mins: number;
}
