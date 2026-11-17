import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogIn, Store } from 'lucide-react';
import { TranslatorFn } from '../../../i18n';
import { Vendor } from '../../../types';

interface AnnouncementBarProps {
  currentSeller: Vendor | null;
  onOpenBecomeSeller: () => void;
  t: TranslatorFn;
}

export default function AnnouncementBar({
  currentSeller,
  onOpenBecomeSeller,
  t,
}: AnnouncementBarProps) {
  return (
    <div className="hidden md:flex items-center min-h-[42px] bg-[#052e23] dark:bg-[#06231b] text-emerald-50 border-b border-emerald-800/50 px-4 sm:px-6 lg:px-10 py-1.5">
      <div className="w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/seller"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[12px] uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span>{t('header.sellerHub')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <p className="hidden xl:block text-[13px] font-medium text-emerald-100/90 truncate">
            {t('header.announcementLong')}
          </p>
          <p className="xl:hidden text-[13px] font-medium text-emerald-100/90 truncate">
            {t('header.announcementShort')}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/seller"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-200 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md px-1.5 py-0.5"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {currentSeller
                ? t('header.sellerHubSuffix', { name: currentSeller.name })
                : t('header.loginAsSeller')}
            </span>
          </Link>
          <span className="h-3.5 w-px bg-emerald-800/80" aria-hidden="true" />
          <button
            type="button"
            onClick={onOpenBecomeSeller}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 hover:text-amber-200 font-bold text-[12px] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Store className="w-3.5 h-3.5 text-amber-300" />
            <span>{t('header.becomeSeller')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
