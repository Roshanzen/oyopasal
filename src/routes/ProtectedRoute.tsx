import React from 'react';
import { Lock, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { user, setLoginModalOpen } = useAuth();

  if (requireAuth && !user) {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Sign In Required</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Please sign in to your OyoPasal account to access this page.
          </p>
          <button
            type="button"
            onClick={() => setLoginModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role || 'customer')) {
    return (
      <div className="min-h-[60vh] w-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center shadow-lg space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your account does not have permission to view this portal.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
