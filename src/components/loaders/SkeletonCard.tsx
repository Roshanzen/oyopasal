import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 animate-pulse">
      <div className="aspect-square rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="flex items-center justify-between pt-2">
        <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-16 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
