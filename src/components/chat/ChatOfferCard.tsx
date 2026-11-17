import React from 'react';
import { ShoppingCart, Star, Zap } from 'lucide-react';
import { ChatProductOffer, Language } from '../../types';

interface ChatOfferCardProps {
  offer: ChatProductOffer;
  language: Language;
  formatPrice: (amount: number) => string;
  onAddToCart: (productId: string, quantity: number) => void;
  onBuyNow: (offer: ChatProductOffer) => void;
}

export default function ChatOfferCard({
  offer,
  language,
  formatPrice,
  onAddToCart,
  onBuyNow,
}: ChatOfferCardProps) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
      <img
        src={offer.image_url}
        alt={offer.name}
        className="w-12 h-12 rounded-lg object-cover bg-slate-200 dark:bg-slate-800 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            {offer.recommended_badge}
          </span>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold inline-flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            {offer.vendor_rating}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {offer.distance_km} km · ~{offer.eta_mins}m
          </span>
        </div>
        <div className="font-bold text-slate-900 dark:text-white text-xs truncate mt-0.5">
          {offer.name} ({offer.unit})
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{offer.vendor_name}</div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
              {formatPrice(offer.price)}
            </span>
            {offer.original_price > offer.price && (
              <span className="text-[11px] line-through text-slate-400">{formatPrice(offer.original_price)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAddToCart(offer.product_id, offer.suggested_quantity || 1)}
              className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <ShoppingCart className="w-3 h-3" />
              <span>{language === 'ne' ? 'थप्नुहोस्' : '+ Cart'}</span>
            </button>
            <button
              type="button"
              onClick={() => onBuyNow(offer)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>{language === 'ne' ? 'किन्नुहोस्' : 'Buy Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
