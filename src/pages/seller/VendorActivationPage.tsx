import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Store,
  Sparkles,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { sellerOnboardingService, VerifyTokenResponse } from '../../services/sellerOnboardingService';
import { useApp } from '../../context';
import { APP_CONFIG } from '../../config';
import { safeStorage } from '../../utils';

export default function VendorActivationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, refreshSellerSession, updateCurrentSeller } = useApp();

  const urlToken = searchParams.get('token') || '';
  const [token, setToken] = useState(urlToken);
  const [verifying, setVerifying] = useState(Boolean(urlToken));
  const [tokenInfo, setTokenInfo] = useState<VerifyTokenResponse | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  useEffect(() => {
    if (urlToken) {
      handleVerify(urlToken);
    }
  }, [urlToken]);

  const handleVerify = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) return;
    setVerifying(true);
    setTokenError(null);
    try {
      const res = await sellerOnboardingService.verifyActivationToken(tokenToVerify.trim());
      setTokenInfo(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired activation token.';
      setTokenError(msg);
      setTokenInfo(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!token.trim()) {
      setSubmitError('Activation token is required.');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await sellerOnboardingService.activateVendor({
        token: token.trim(),
        password,
        confirm_password: confirmPassword,
      });

      // Store vendor auth tokens
      if (res.access) {
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH, res.access);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN, res.access);
      }
      if (res.vendor) {
        safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, res.vendor);
        updateCurrentSeller?.(res.vendor);
      }

      setActivatedSuccess(true);
      showToast('Vendor account activated successfully! Welcome to OyoPasal.', 'success');
      refreshSellerSession?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate vendor account.';
      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (activatedSuccess) {
    return (
      <div className="min-h-[85vh] w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-[#0F172A] rounded-3xl p-8 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
              Account Activated
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
              Welcome to Your Store!
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Your merchant password has been securely configured. Your store is now active and ready for business.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/seller"
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors"
            >
              <Store className="w-4 h-4" />
              <span>Enter Vendor Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <Link
            to="/seller"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Vendor Login</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Single-Use Activation</span>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Activate Vendor Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Set your secure merchant password to complete your onboarding and activate your store.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          {/* Token verification input if not present or failed */}
          {!tokenInfo && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Invitation Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={token ?? ''}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Paste activation token from email"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerify(token)}
                    disabled={verifying || !token.trim()}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {verifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>

              {tokenError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{tokenError}</p>
                </div>
              )}
            </div>
          )}

          {/* Verified Token Details & Password Form */}
          {tokenInfo && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Store Name</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {tokenInfo.business_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Merchant Email</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{tokenInfo.email}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-100 dark:border-emerald-900/50">
                  <span>Application Reference</span>
                  <span className="font-mono">{tokenInfo.application_number}</span>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <p className="font-medium">{submitError}</p>
                </div>
              )}

              <form onSubmit={handleActivate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Create Merchant Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password ?? ''}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={confirmPassword ?? ''}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Activate Store & Access Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
