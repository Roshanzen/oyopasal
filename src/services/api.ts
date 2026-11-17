import { httpClient } from './httpClient';
import { authService } from './authService';
import { cartService } from './cartService';
import { addressService } from './addressService';
import { sellerService } from './sellerService';
import { productService } from './productService';
import { categoryService } from './categoryService';
import { vendorService } from './vendorService';
import { orderService } from './orderService';
import { paymentService } from './paymentService';
import { wishlistService } from './wishlistService';
import { notificationService } from './notificationService';
import { supportService } from './supportService';
import { chatService } from './chatService';
import { adminService } from './adminService';

export const api = {
  setToken: (token: string) => httpClient.setToken(token),
  getToken: () => httpClient.getToken(),
  clearToken: () => httpClient.clearToken(),
  setSellerToken: (token: string) => httpClient.setSellerToken(token),
  getSellerToken: () => httpClient.getSellerToken(),
  clearSellerToken: () => httpClient.clearSellerToken(),
  onUnauthorized: (handler: (isSellerRequest: boolean) => void) => httpClient.onUnauthorized(handler),

  ...authService,
  ...cartService,
  ...addressService,
  ...sellerService,
  ...productService,
  ...categoryService,
  ...vendorService,
  ...orderService,
  ...paymentService,
  ...wishlistService,
  ...notificationService,
  ...supportService,
  ...chatService,
  ...adminService,
};
