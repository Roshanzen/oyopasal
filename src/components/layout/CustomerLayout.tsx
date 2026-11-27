import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import CategoryBar from '../common/CategoryBar';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import { ChatConcierge } from './ChatConcierge';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface CustomerLayoutProps {
  children?: React.ReactNode;
  showCategoryBar?: boolean;
}

/**
 * Shared customer-side layout for OyoPasal.
 * Houses the top navigation Header, dynamic CategoryBar, flexible full-width content container,
 * sticky bottom customer Footer, mobile navigation pill, and customer ChatConcierge.
 * Ensures the footer sits cleanly at the bottom on short pages and follows content on longer pages.
 */
export default function CustomerLayout({ children, showCategoryBar = true }: CustomerLayoutProps) {
  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header />
      {showCategoryBar && (
        <ErrorBoundary fallbackTitle="Category navigation unavailable">
          <CategoryBar />
        </ErrorBoundary>
      )}

      <main className="flex-1 w-full">
        {children || <Outlet />}
      </main>

      <ErrorBoundary fallbackTitle="Footer unavailable">
        <Footer />
      </ErrorBoundary>
      <MobileBottomNav />
      <ChatConcierge />
    </div>
  );
}
