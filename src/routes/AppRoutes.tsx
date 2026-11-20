import React from 'react';
import { Route, Routes } from 'react-router-dom';
import HomePage from '../pages/home/HomePage';
import ProductDetailPage from '../pages/products/ProductDetailPage';
import SearchPage from '../pages/products/SearchPage';
import CategoryPage from '../pages/categories/CategoryPage';
import CheckoutPage from '../pages/checkout/CheckoutPage';
import OrderTrackingPage from '../pages/orders/OrderTrackingPage';
import AccountPage from '../pages/profile/AccountPage';
import SellerPortalPage from '../pages/seller/SellerPortalPage';
import StoreDetailPage from '../pages/stores/StoreDetailPage';
import AdminPortalPage from '../pages/admin/AdminPortalPage';
import RiderPortalPage from '../pages/admin/RiderPortalPage';
import { SellerRoute } from './SellerRoute';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/stores/:slug" element={<StoreDetailPage />} />
      <Route path="/outlets/:slug" element={<StoreDetailPage />} />
      <Route path="/categories" element={<CategoryPage />} />
      <Route path="/category/:slug" element={<CategoryPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders/:id" element={<OrderTrackingPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route
        path="/seller"
        element={
          <SellerRoute>
            <SellerPortalPage />
          </SellerRoute>
        }
      />
      <Route path="/admin" element={<AdminPortalPage />} />
      <Route path="/rider" element={<RiderPortalPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
