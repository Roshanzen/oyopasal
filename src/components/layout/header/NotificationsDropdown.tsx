import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { TranslatorFn } from '../../../i18n';
import { NotificationItem } from '../../../types';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  t: TranslatorFn;
}

export default function NotificationsDropdown({
  isOpen,
  onToggle,
  onClose,
  notifications,
  unreadCount,
  loading,
  error,
  onRetry,
  onMarkRead,
  onMarkAllRead,
  t,
}: NotificationsDropdownProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.92 }}
        onClick={onToggle}
        aria-label={t('header.notifications')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={t('header.notifications')}
        className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 text-[12px] font-extrabold leading-none flex items-center justify-center border-2 border-white dark:border-[#0b101b] tabular-nums">
            {unreadCount}
          </span>
        )}
      </motion.button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {t('header.notifications')}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t('header.markAllRead')}</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {error ? (
              <div className="py-6 px-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            ) : loading && notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('header.allCaughtUp')}
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      onMarkRead(n.id);
                      onClose();
                      navigate(n.reference_url || '/account?tab=notifications');
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                      isUnread ? 'bg-emerald-50/50 dark:bg-emerald-950/25' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {n.title}
                      </span>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{n.message}</p>
                    <span className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 block">{n.created_at}</span>
                  </button>
                );
              })
            )}
          </div>

          <Link
            to="/account?tab=notifications"
            onClick={onClose}
            className="block w-full text-center py-2.5 bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400 border-t border-slate-100 dark:border-slate-800 transition-colors"
          >
            {t('header.viewAllNotifications')}
          </Link>
        </div>
      )}
    </div>
  );
}
