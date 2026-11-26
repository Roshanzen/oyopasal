import React from 'react';
import { Sparkles, Zap } from 'lucide-react';
import { TranslatorFn } from '../../../i18n';
import { Vendor } from '../../../types';

interface AnnouncementBarProps {
  currentSeller?: Vendor | null;
  onOpenBecomeSeller?: () => void;
  t: TranslatorFn;
}

export default function AnnouncementBar({ t }: AnnouncementBarProps) {
  return (
    <div className="hidden md:flex items-center justify-center min-h-[36px] bg-[#052e23] dark:bg-[#06231b] text-emerald-50 border-b border-emerald-800/50 px-4 sm:px-6 lg:px-10 py-1.5 select-none">
      <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-medium text-emerald-100/95 tracking-wide">
        <span className="inline-flex items-center gap-1 font-bold text-white uppercase tracking-wider text-[11px] bg-emerald-700/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
          <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
          <span>Fast Delivery</span>
        </span>
        <span className="hidden xl:inline">{t('header.announcementLong')}</span>
        <span className="xl:hidden">{t('header.announcementShort')}</span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-300 font-semibold ml-1">
          <Sparkles className="w-3 h-3" />
          <span>Kathmandu Valley Hyperlocal</span>
        </span>
      </div>
    </div>
  );
}
