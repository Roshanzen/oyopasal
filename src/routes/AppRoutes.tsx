import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import HomePage from '../pages/home/HomePage';
import { SellerRoute } from './SellerRoute';

// Route-based code splitting for production bundle optimization
const ProductDetailPage = lazy(() => import('../pages/products/ProductDetailPage'));
const SearchPage = lazy(() => import('../pages/products/SearchPage'));
const CategoryPage = lazy(() => import('../pages/categories/CategoryPage'));
const CheckoutPage = lazy(() => import('../pages/checkout/CheckoutPage'));
const OrderTrackingPage = lazy(() => import('../pages/orders/OrderTrackingPage'));
const AccountPage = lazy(() => import('../pages/profile/AccountPage'));
const SellerPortalPage = lazy(() => import('../pages/seller/SellerPortalPage'));
const StoreDetailPage = lazy(() => import('../pages/stores/StoreDetailPage'));
const AdminPortalPage = lazy(() => import('../pages/admin/AdminPortalPage'));
const RiderPortalPage = lazy(() => import('../pages/admin/RiderPortalPage'));
const BecomeSellerPage = lazy(() => import('../pages/seller/BecomeSellerPage'));
const TrackApplicationPage = lazy(() => import('../pages/seller/TrackApplicationPage'));
const VendorActivationPage = lazy(() => import('../pages/seller/VendorActivationPage'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500">
      <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-400">Loading OyoPasal...</span>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/stores/:slug" element={<StoreDetailPage />} />
        <Route path="/outlets/:slug" element={<StoreDetailPage />} />
        <Route path="/categories" element={<CategoryPage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/departments/:slug" element={<CategoryPage />} />
        <Route path="/department/:slug" element={<CategoryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders/:id" element={<OrderTrackingPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/become-seller" element={<BecomeSellerPage />} />
        <Route path="/seller/track" element={<TrackApplicationPage />} />
        <Route path="/track-application" element={<TrackApplicationPage />} />
        <Route path="/vendor/activate" element={<VendorActivationPage />} />
        <Route path="/seller/activate" element={<VendorActivationPage />} />
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
    </Suspense>
  );
}
