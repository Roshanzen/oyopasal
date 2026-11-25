import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Home,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { Address, DbStatusResponse, Language, ThemeMode, UserProfile } from '../../types';
import { authService } from '../../services/authService';

interface ProfileTabProps {
  user: UserProfile | null;
  fullName: string;
  email: string;
  phone: string;
  savingProfile: boolean;
  syncingGoogle?: boolean;
  addresses?: Address[];
  dbStatus?: DbStatusResponse | null;
  theme?: ThemeMode;
  language?: Language;
  t: TranslatorFn;
  onOpenLogin: () => void;
  onChangeFullName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  onGoogleSignIn?: () => void;
  onAddAddress?: () => void;
  onSignOut?: () => void;
  onToggleTheme?: () => void;
  onChangeLanguage?: (lang: Language) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ProfileTab({
  user,
  fullName,
  email,
  phone,
  savingProfile,
  syncingGoogle = false,
  addresses = [],
  language = 'en',
  t,
  onOpenLogin,
  onChangeFullName,
  onChangePhone,
  onSaveProfile,
  onGoogleSignIn,
  onAddAddress,
  onSignOut,
  showToast,
}: ProfileTabProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!oldPassword.trim()) {
      setPasswordError(language === 'ne' ? 'कृपया पुरानो पासवर्ड राख्नुहोस्' : 'Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(language === 'ne' ? 'नयाँ पासवर्ड कम्तिमा ६ अक्षरको हुनुपर्छ' : 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(language === 'ne' ? 'नयाँ पासवर्डहरू मिलेनन्' : 'New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await authService.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });
      setPasswordSuccess(language === 'ne' ? 'पासवर्ड सफलतापूर्वक परिवर्तन भयो!' : 'Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      if (showToast) {
        showToast(language === 'ne' ? 'पासवर्ड सफलतापूर्वक परिवर्तन भयो!' : 'Password updated successfully!', 'success');
      }
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.detail ||
        (language === 'ne' ? 'पासवर्ड परिवर्तन गर्न सकिएन। कृपया पुरानो पासवर्ड जाँच्नुहोस्।' : 'Failed to change password. Please check your current password.');
      setPasswordError(msg);
      if (showToast) {
        showToast(msg, 'error');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-2xs space-y-7">
      {!user && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">{t('account.guestBannerTitle')}</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">{t('account.guestBannerSub')}</p>
          </div>
          <button
            type="button"
            onClick={onOpenLogin}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            {t('header.signIn')}
          </button>
        </div>
      )}

      {/* 1. Profile Header */}
      <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl flex items-center justify-center font-display shrink-0">
          {(fullName || 'G').charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            {user ? fullName : t('header.guestUser')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {user?.role ? `Account: ${user.role.toUpperCase()}` : t('account.memberSince')}
          </p>
        </div>
      </div>

      {/* Profile Details Form */}
      <form onSubmit={onSaveProfile} className="space-y-4 max-w-2xl">
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.fullName')}</label>
          <input
            type="text"
            value={fullName ?? ''}
            onChange={(e) => onChangeFullName(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.emailAddress')}</label>
          <input
            type="email"
            value={email ?? ''}
            disabled
            className="w-full px-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.phoneNumber')}</label>
          <input
            type="text"
            value={phone ?? ''}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="+977 98XXXXXXXX"
            className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer shadow-xs transition-colors"
          >
            {savingProfile ? t('account.saving') : t('account.saveProfile')}
          </button>
          {onGoogleSignIn && (
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={syncingGoogle}
              className="px-5 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <span>{syncingGoogle ? t('account.signingIn') : t('account.googleSignIn')}</span>
            </button>
          )}
        </div>
      </form>

      {/* 2. Saved Delivery Addresses */}
      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
                <MapPin className="w-4 h-4" />
              </span>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                {t('account.savedAddressesTitle')}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'ne'
                ? '१-क्लिक चेकआउट र सटीक डेलिभरीका लागि सुरक्षित ठेगानाहरू'
                : 'Manage your home, office, and dispatch addresses for fast checkout'}
            </p>
          </div>
          {onAddAddress && (
            <button
              type="button"
              onClick={onAddAddress}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('account.addNewAddress')}</span>
            </button>
          )}
        </div>

        {Array.isArray(addresses) && addresses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {addr.title}
                    </span>
                  </div>
                  {addr.is_default && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('account.defaultAddress')}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {addr.recipient_name} · {addr.phone}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {addr.street}, {addr.area}, {addr.city}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
            <MapPin className="w-7 h-7 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {language === 'ne' ? 'कुनै ठेगाना सुरक्षित गरिएको छैन' : 'No delivery addresses saved yet'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {language === 'ne'
                ? 'छिटो अर्डर र सटीक GPS राइडर डेलिभरीका लागि आफ्नो घर वा कार्यालयको ठेगाना थप्नुहोस्।'
                : 'Add your home or office delivery location for instant 1-click checkout and accurate GPS rider tracking.'}
            </p>
            {onAddAddress && (
              <button
                type="button"
                onClick={onAddAddress}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('account.addNewAddress')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Account & Security Actions Row */}
      <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {language === 'ne' ? 'सुरक्षा र खाता कार्यहरू' : 'Security & Account Actions'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user && (
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordError(null);
                setPasswordSuccess(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{language === 'ne' ? 'पासवर्ड परिवर्तन' : 'Change Password'}</span>
            </button>
          )}

          {user && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('header.signOut')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'ne' ? 'पासवर्ड परिवर्तन गर्नुहोस्' : 'Change Account Password'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {language === 'ne' ? 'हालको पासवर्ड' : 'Current Password'}
                </label>
                <input
                  type="password"
                  value={oldPassword ?? ''}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {language === 'ne' ? 'नयाँ पासवर्ड (कम्तिमा ६ अक्षर)' : 'New Password (min 6 characters)'}
                </label>
                <input
                  type="password"
                  value={newPassword ?? ''}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {language === 'ne' ? 'नयाँ पासवर्ड पुन: प्रविष्ट गर्नुहोस्' : 'Confirm New Password'}
                </label>
                <input
                  type="password"
                  value={confirmNewPassword ?? ''}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {language === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {changingPassword
                    ? (language === 'ne' ? 'अपडेट हुँदैछ...' : 'Updating...')
                    : (language === 'ne' ? 'पासवर्ड अपडेट गर्नुहोस्' : 'Update Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
