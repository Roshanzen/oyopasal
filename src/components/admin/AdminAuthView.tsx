import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react';
import { Language, UserProfile } from '../../types';
import { isUserAdmin } from '../../utils';

interface AdminAuthViewProps {
  user: UserProfile | null;
  language: Language;
  identifier: string;
  password: string;
  authLoading: boolean;
  onChangeIdentifier: (v: string) => void;
  onChangePassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onQuickDemoAdmin: () => void;
  onLogout: () => void;
}

export default function AdminAuthView({
  user,
  language,
  identifier,
  password,
  authLoading,
  onChangeIdentifier,
  onChangePassword,
  onSubmit,
  onQuickDemoAdmin,
  onLogout,
}: AdminAuthViewProps) {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'ne' ? 'स्टोरमा फर्कनुहोस्' : 'Back to Storefront'}</span>
          </Link>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
            RBAC Admin Portal
          </span>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">OyoPasal Admin Console</h1>
            <p className="text-sm text-slate-400">
              {user
                ? `Signed in as ${user.email} (${user.role}). Administrator role required.`
                : 'Sign in with administrator credentials to manage vendors, dispatch, refunds, and payouts.'}
            </p>
          </div>

          {user && !isUserAdmin(user) && (
            <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs flex items-center justify-between">
              <span>Current session does not have admin privileges.</span>
              <button onClick={onLogout} className="font-bold underline cursor-pointer">
                Sign Out
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Admin Email</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => onChangeIdentifier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer"
            >
              {authLoading ? 'Signing in...' : 'Sign In as Administrator'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={authLoading}
              onClick={onQuickDemoAdmin}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Quick Seeded Admin Access (admin@oyopasal.np)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
