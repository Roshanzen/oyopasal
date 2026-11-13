/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './shared/context/AppContext';
import Header from './customer/components/Header';
import CategoryBar from './customer/components/CategoryBar';
import CartDrawer from './customer/components/CartDrawer';
import LocationModal from './customer/components/LocationModal';
import BecomeSellerModal from './vendor/components/BecomeSellerModal';
import SellerLoginModal from './vendor/components/SellerLoginModal';
import SellerDashboardModal from './vendor/components/SellerDashboardModal';
import LoginModal from './customer/components/LoginModal';
import MobileBottomNav from './customer/components/MobileBottomNav';
import ToastContainer from './shared/components/Toast';
import { ChatConcierge } from './customer/components/ChatConcierge';

import HomePage from './customer/pages/HomePage';
import ProductDetailPage from './customer/pages/ProductDetailPage';
import CategoryPage from './customer/pages/CategoryPage';
import SearchPage from './customer/pages/SearchPage';
import CheckoutPage from './customer/pages/CheckoutPage';
import OrderTrackingPage from './customer/pages/OrderTrackingPage';
import AccountPage from './customer/pages/AccountPage';
import SellerPortalPage from './vendor/pages/SellerPortalPage';
import AdminPortalPage from './admin/pages/AdminPortalPage';
import RiderPortalPage from './admin/pages/RiderPortalPage';

function AppShell() {
  const location = useLocation();
  const isPortalRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/rider') ||
    location.pathname.startsWith('/seller');

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header />
      {!isPortalRoute && <CategoryBar />}

      <main className="flex-1 w-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/categories" element={<CategoryPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/seller" element={<SellerPortalPage />} />
          <Route path="/admin" element={<AdminPortalPage />} />
          <Route path="/rider" element={<RiderPortalPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>

      <CartDrawer />
      <LocationModal />
      <BecomeSellerModal />
      <SellerLoginModal />
      <SellerDashboardModal />
      <LoginModal />
      {!isPortalRoute && <MobileBottomNav />}
      <ChatConcierge />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppProvider>
  );
}
