import React from 'react';
import { Store } from 'lucide-react';
import { useAuth, useSeller } from '../hooks';

interface SellerRouteProps {
  children: React.ReactNode;
  strict?: boolean;
}

export function SellerRoute({ children, strict = false }: SellerRouteProps) {
  const { currentSeller, setSellerLoginModalOpen } = useSeller();
  const { user } = useAuth();

  if (strict && !currentSeller && user?.role !== 'admin' && user?.role !== 'seller') {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Seller Access Required</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in with your merchant store credentials to manage products and customer dispatches.
          </p>
          <button
            type="button"
            onClick={() => setSellerLoginModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>Login as Seller</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
