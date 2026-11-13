/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import CategoryBar from './components/CategoryBar';
import CartDrawer from './components/CartDrawer';
import LocationModal from './components/LocationModal';
import BecomeSellerModal from './components/BecomeSellerModal';
import SellerLoginModal from './components/SellerLoginModal';
import SellerDashboardModal from './components/SellerDashboardModal';
import MobileBottomNav from './components/MobileBottomNav';
import ToastContainer from './components/Toast';
import { ChatConcierge } from './components/ChatConcierge';

import HomePage from './pages/HomePage';
import ProductDetailPage from './pages/ProductDetailPage';
import CategoryPage from './pages/CategoryPage';
import SearchPage from './pages/SearchPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import AccountPage from './pages/AccountPage';
import SellerPortalPage from './pages/SellerPortalPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="w-full min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
          {/* Header */}
          <Header />

          {/* Subheader category bar */}
          <CategoryBar />

          {/* Main Routed Content */}
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
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>

          {/* Slide-out Cart Drawer */}
          <CartDrawer />

          {/* Location / Address Selection Modal */}
          <LocationModal />

          {/* Become a Seller Onboarding Modal */}
          <BecomeSellerModal />

          {/* Seller Login & Dashboard Modals */}
          <SellerLoginModal />
          <SellerDashboardModal />

          {/* Mobile Bottom Navigation Bar with floating cart pill */}
          <MobileBottomNav />

          {/* Gemini AI Quick-Commerce Chatbot Concierge */}
          <ChatConcierge />

          {/* Toast Notification Container */}
          <ToastContainer />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
