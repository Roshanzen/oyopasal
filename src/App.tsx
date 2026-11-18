/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppProvider } from './context';
import { AppRoutes } from './routes';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import Header from './components/layout/Header';
import CategoryBar from './components/common/CategoryBar';
import MobileBottomNav from './components/layout/MobileBottomNav';
import { ChatConcierge } from './components/layout/ChatConcierge';
import CartDrawer from './components/modals/CartDrawer';
import LocationModal from './components/modals/LocationModal';
import BecomeSellerModal from './components/modals/BecomeSellerModal';
import SellerLoginModal from './components/modals/SellerLoginModal';
import SellerDashboardModal from './components/modals/SellerDashboardModal';
import LoginModal from './components/modals/LoginModal';
import ToastContainer from './components/feedback/ToastContainer';

function AppShell() {
  const location = useLocation();
  const isPortalRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/rider') ||
    location.pathname.startsWith('/seller');

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header />
      {!isPortalRoute && (
        <ErrorBoundary fallbackTitle="Category navigation unavailable">
          <CategoryBar />
        </ErrorBoundary>
      )}

      <main className="flex-1 w-full">
        <ErrorBoundary fallbackTitle="Page failed to render">
          <AppRoutes />
        </ErrorBoundary>
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
