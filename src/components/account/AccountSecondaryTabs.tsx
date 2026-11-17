import React from 'react';
import { AlertCircle, Heart, Plus, Send } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { Address, Language, NotificationItem, Order, Product, SupportTicket } from '../../types';
import ProductCard from '../common/ProductCard';

interface AddressesTabProps {
  addresses: Address[];
  t: TranslatorFn;
  onAddAddress: () => void;
}

export function AddressesTab({ addresses, t, onAddAddress }: AddressesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.savedAddressesTitle')}</h2>
        <button
          onClick={onAddAddress}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('account.addNewAddress')}</span>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div key={addr.id} className="p-4 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-base text-slate-900 dark:text-white">{addr.title}</span>
              {addr.is_default && (
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-md">
                  {t('account.defaultAddress')}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              {addr.recipient_name} · {addr.phone}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {addr.street}, {addr.area}, {addr.city}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WishlistTabProps {
  wishlistProducts: Product[];
  loadingWishlist: boolean;
  t: TranslatorFn;
}

export function WishlistTab({ wishlistProducts, loadingWishlist, t }: WishlistTabProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.savedWishlistTitle')}</h2>
      {loadingWishlist ? (
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
      ) : wishlistProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {wishlistProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <Heart className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('account.emptyWishlistTitle')}</h3>
          <p className="text-sm text-slate-400">{t('account.emptyWishlistSub')}</p>
        </div>
      )}
    </div>
  );
}

interface NotificationsTabProps {
  notifications: NotificationItem[];
  t: TranslatorFn;
  onMarkRead: (n: NotificationItem) => void;
}

export function NotificationsTab({ notifications, t, onMarkRead }: NotificationsTabProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.alertsTitle')}</h2>
      {notifications.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
          {t('header.allCaughtUp')}
        </div>
      ) : (
        notifications.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onMarkRead(n)}
            className={`w-full text-left p-4 rounded-3xl border shadow-2xs space-y-1 cursor-pointer transition-colors ${
              n.read
                ? 'bg-white dark:bg-[#111726] border-slate-200/90 dark:border-slate-800'
                : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h3>
              <span className="text-xs text-slate-400">{n.created_at}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
          </button>
        ))
      )}
    </div>
  );
}

interface SupportTabProps {
  tickets: SupportTicket[];
  ticketCategory: string;
  ticketSubject: string;
  ticketMessage: string;
  creatingTicket: boolean;
  replyDrafts: Record<number, string>;
  language: Language;
  setTicketCategory: (v: string) => void;
  setTicketSubject: (v: string) => void;
  setTicketMessage: (v: string) => void;
  onChangeReplyDraft: (ticketId: number, val: string) => void;
  onCreateTicket: (e: React.FormEvent) => void;
  onReplyTicket: (ticketId: number) => void;
}

export function SupportTab({
  tickets,
  ticketCategory,
  ticketSubject,
  ticketMessage,
  creatingTicket,
  replyDrafts,
  language,
  setTicketCategory,
  setTicketSubject,
  setTicketMessage,
  onChangeReplyDraft,
  onCreateTicket,
  onReplyTicket,
}: SupportTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
          {language === 'ne' ? 'नयाँ सहायता टिकट खोल्नुहोस्' : 'Open Support Ticket'}
        </h2>
        <form onSubmit={onCreateTicket} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={ticketCategory}
              onChange={(e) => setTicketCategory(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            >
              <option value="order_issue">Order & Delivery Issue</option>
              <option value="payment_refund">Payment & Refund</option>
              <option value="quality_feedback">Product Quality</option>
              <option value="general">General Help</option>
            </select>
            <input
              type="text"
              required
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Subject (e.g. Missing item in delivery)"
              className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <textarea
            rows={3}
            required
            value={ticketMessage}
            onChange={(e) => setTicketMessage(e.target.value)}
            placeholder="Describe how our Kathmandu support team can help..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={creatingTicket}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
          >
            {creatingTicket ? 'Creating...' : 'Submit Ticket'}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-mono text-emerald-600">{ticket.ticket_number}</span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">{ticket.subject}</h3>
              </div>
              <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {ticket.status}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ticket.messages.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 text-sm">
                  <span className="text-xs font-bold uppercase text-emerald-600 mr-2">{m.sender_role}:</span>
                  <span className="text-slate-700 dark:text-slate-200">{m.message}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={replyDrafts[ticket.id] || ''}
                onChange={(e) => onChangeReplyDraft(ticket.id, e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => onReplyTicket(ticket.id)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Reply
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RefundRequestModalProps {
  order: Order;
  reason: string;
  submitting: boolean;
  formatPrice: (n: number) => string;
  onChangeReason: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function RefundRequestModal({
  order,
  reason,
  submitting,
  formatPrice,
  onChangeReason,
  onClose,
  onSubmit,
}: RefundRequestModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" />
      <form
        onSubmit={onSubmit}
        className="relative bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full z-10 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-2.5 text-amber-600">
          <AlertCircle className="w-6 h-6" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Request Refund · {order.order_number}
          </h3>
        </div>
        <p className="text-sm text-slate-500">Order Total: {formatPrice(order.total_amount)}</p>
        <textarea
          rows={3}
          required
          value={reason}
          onChange={(e) => onChangeReason(e.target.value)}
          placeholder="Explain why you are requesting a refund..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold cursor-pointer"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </div>
  );
}
