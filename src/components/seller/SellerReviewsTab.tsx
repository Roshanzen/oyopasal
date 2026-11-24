import React from 'react';
import { Package, RefreshCw, Star } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { Language, SellerReviewItem } from '../../types';

interface SellerReviewsTabProps {
  sellerReviews: SellerReviewItem[];
  reviewsAvg: number;
  reviewsLoading: boolean;
  reviewsError: string | null;
  language: Language;
  t: TranslatorFn;
  onRefresh: () => void;
}

export default function SellerReviewsTab({
  sellerReviews,
  reviewsAvg,
  reviewsLoading,
  reviewsError,
  language,
  t,
  onRefresh,
}: SellerReviewsTabProps) {
  return (
    <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span>{language === 'ne' ? 'ग्राहक समीक्षा र मूल्याङ्कन' : 'Customer Reviews & Ratings'}</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Average Store Product Rating: <strong className="text-amber-500 dark:text-amber-400">{reviewsAvg || 0} ★</strong> ({sellerReviews.length} reviews)
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer self-start shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reviewsLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Reviews</span>
        </button>
      </div>

      {reviewsError ? (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between text-sm">
          <span>{reviewsError}</span>
          <button onClick={onRefresh} className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer">
            Retry
          </button>
        </div>
      ) : reviewsLoading ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
      ) : sellerReviews.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
          {language === 'ne' ? 'अझै कुनै ग्राहक समीक्षा प्राप्त भएको छैन।' : 'No customer product reviews received yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {sellerReviews.map((rev) => (
            <div key={rev.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {rev.product_image ? (
                  <img src={rev.product_image} alt={rev.product_name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{rev.product_name}</h4>
                  <span className="text-xs text-slate-500 font-mono">{new Date(rev.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    ★ {rev.rating}/5
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{rev.author_name}</span>
                  {rev.is_verified_purchase && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">· Verified Buyer</span>}
                </div>
                {rev.title && <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1.5">{rev.title}</p>}
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{rev.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
