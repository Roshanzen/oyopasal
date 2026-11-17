import React from 'react';
import { Loader2 } from 'lucide-react';

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-[40vh] w-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
      <Loader2 className="w-7 h-7 animate-spin text-emerald-600 dark:text-emerald-400" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
