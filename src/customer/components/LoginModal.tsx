import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../../shared/lib/firebase';
import {
  X,
  LogIn,
  UserPlus,
  Phone,
  Lock,
  User,
  Sparkles,
  Store,
  ArrowRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LoginModal() {
  const navigate = useNavigate();
  const {
    loginModalOpen,
    setLoginModalOpen,
    loginCustomer,
    registerCustomer,
    setUserDirect,
    t,
    showToast
  } = useApp();

  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loginModalOpen) {
      setError('');
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLoginModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginModalOpen, setLoginModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'create' && !fullName.trim()) {
      setError(t('login.errorName'));
      return;
    }
    if (!identifier.trim()) {
      setError(t('login.errorMissing'));
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        await registerCustomer({
          full_name: fullName.trim(),
          phone_or_email: identifier.trim(),
          password,
        });
      } else {
        await loginCustomer({
          phone_or_email: identifier.trim(),
          password,
        });
      }
      setFullName('');
      setIdentifier('');
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Unable to authenticate. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginCustomer({
        phone_or_email: '+977 9841234567',
        full_name: 'Roshan Yadav',
        demo_quick_login: true,
      });
    } catch (err: any) {
      setError(err?.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      const data = await api.firebaseLogin({
        id_token: token,
        full_name: cred.user.displayName || undefined,
        phone: cred.user.phoneNumber || undefined,
      });
      if (data.success && data.user) {
        if (data.token) {
          api.setToken(data.token);
        }
        setUserDirect(data.user);
        setLoginModalOpen(false);
        const firstName = (data.user.full_name || cred.user.displayName || 'Customer').split(' ')[0];
        showToast(t('toast.welcomeCustomer', { name: firstName }), 'success');
      } else {
        throw new Error('Google authentication failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in was cancelled or unavailable.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {loginModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setLoginModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-login-title"
            className="w-full max-w-md bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-2xl overflow-hidden"
          >
            {/* Header Banner */}
            <div className="relative bg-gradient-to-br from-emerald-900 via-[#072f24] to-[#0b101b] p-6 text-white border-b border-emerald-800/40">
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                aria-label={t('common.cancel')}
                className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                <span>{t('login.badge')}</span>
              </span>

              <h2
                id="customer-login-title"
                className="text-2xl font-extrabold font-display tracking-tight"
              >
                {mode === 'signin' ? t('login.title') : t('login.registerTitle')}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1.5 leading-relaxed">
                {t('login.subtitle')}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Sign In / Create Account Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-white dark:bg-[#111726] text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>{t('login.tabSignIn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('create');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    mode === 'create'
                      ? 'bg-white dark:bg-[#111726] text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{t('login.tabCreate')}</span>
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'create' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t('login.fullNameLabel')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('login.fullNamePlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('login.identifierLabel')}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t('login.identifierPlaceholder')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('login.passwordLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('login.passwordPlaceholder')}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-emerald-950/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('login.submitting')}</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>{mode === 'signin' ? t('login.submitSignIn') : t('login.submitCreate')}</span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative py-1 flex items-center justify-center">
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                <span className="px-3 bg-white dark:bg-[#111726] text-xs font-semibold text-slate-400 whitespace-nowrap">
                  {t('login.orQuickDemo')}
                </span>
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              </div>

              {/* 1-Click Demo & Google Sign-in */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-colors flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="truncate">{t('login.demoBtn')}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{googleLoading ? t('account.signingIn') : t('login.googleBtn')}</span>
                </button>
              </div>

              {/* Seller Link */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {t('login.sellerPrompt')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginModalOpen(false);
                    navigate('/seller');
                  }}
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{t('login.goSellerPortal')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
