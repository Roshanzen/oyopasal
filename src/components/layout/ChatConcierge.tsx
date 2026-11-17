import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  ChevronDown,
  ExternalLink,
  MapPin,
  Navigation,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useChatConcierge } from '../../hooks/useChatConcierge';
import ChatOfferCard from '../chat/ChatOfferCard';
import ChatDirectOrderCard from '../chat/ChatDirectOrderCard';
import ChatPlacedOrderCard from '../chat/ChatPlacedOrderCard';

const DEFAULT_SUGGESTIONS_BY_LANG = {
  en: [
    '🛒 Buy cheapest fresh milk & avocados delivered to my location',
    '🥦 Find best-rated seller for organic vegetables near me',
    '🍞 Order artisan sourdough bread from the nearest bakery',
    '🏷️ Show best-priced pantry deals & active promo codes',
  ],
  ne: [
    '🛒 मेरो ठेगानामा सस्तो ताजा दूध र एभोकाडो पठाउनुहोस्',
    '🥦 मेरो नजिक अर्गानिक तरकारीको उत्कृष्ट पसल खोज्नुहोस्',
    '🍞 नजिकको बेकरीबाट ताजा सावरडो रोटी अर्डर गर्नुहोस्',
    '🏷️ आजको उत्कृष्ट मूल्य र सक्रिय कुपन कोड देखाउनुहोस्',
  ],
};

class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('ChatConcierge render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <button
          type="button"
          onClick={() => this.setState({ hasError: false })}
          className="fixed bottom-20 sm:bottom-6 right-5 z-40 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-xl text-sm font-bold cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Reload OyoPasal AI</span>
        </button>
      );
    }
    return this.props.children;
  }
}

const ChatConciergeInner: React.FC = () => {
  const navigate = useNavigate();
  const {
    language,
    t,
    formatPrice,
    user,
    setLocationModalOpen,
    addToCart,
    messages,
    input,
    setInput,
    loading,
    placingMessageId,
    verifyingMessageId,
    catalogBannerCount,
    assignedLocationLabel,
    handleSendMessage,
    handleClearHistory,
    handlePrepareOfferDirectBuy,
    updateOrderPreview,
    handleConfirmDirectPurchase,
    handleVerifyInlinePayment,
  } = useChatConcierge();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, loading]);

  const suggestions = DEFAULT_SUGGESTIONS_BY_LANG[language] || DEFAULT_SUGGESTIONS_BY_LANG.en;

  return (
    <>
      <AnimatePresence initial={false}>
        {!isOpen && (
          <motion.button
            key="chat-concierge-trigger"
            type="button"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={() => {
              setIsMinimized(false);
              setIsOpen(true);
            }}
            className="fixed bottom-20 sm:bottom-6 right-5 z-40 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-3 rounded-full shadow-xl shadow-emerald-900/25 group focus:outline-none focus:ring-4 focus:ring-emerald-400/40 select-none cursor-pointer"
            title="Open OyoPasal AI Direct Shopper"
          >
            <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold leading-tight flex items-center gap-1.5">
                <span>{t('chat.aiBadge')}</span>
                <span className="bg-amber-300 text-slate-950 text-[11px] font-black uppercase px-1.5 py-0.5 rounded-full">
                  Direct Buy
                </span>
              </div>
              <div className="text-xs text-emerald-100 font-medium">{t('chat.subBadge')}</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="chat-concierge-drawer"
            role="dialog"
            aria-label={t('chat.title')}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed z-[45] ${
              isMinimized
                ? 'bottom-20 sm:bottom-6 right-4 sm:right-5 w-80'
                : 'bottom-4 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[460px] max-w-[480px] h-[640px] max-h-[88vh]'
            } bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden`}
          >
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-3.5 flex items-center justify-between select-none shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-base leading-tight text-white">{t('chat.title')}</h3>
                    <span className="text-[11px] bg-white/20 text-white font-semibold px-1.5 py-0.5 rounded">
                      Gemini 4
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                    <span>
                      {catalogBannerCount
                        ? `${catalogBannerCount} Live Items • ${t('chat.grounded')}`
                        : t('chat.grounded')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="Restart chat"
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMinimized(!isMinimized)}
                  title={isMinimized ? 'Expand' : 'Minimize'}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(false);
                  }}
                  title="Close chat"
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                <div className="px-3.5 py-2 bg-emerald-50/90 dark:bg-emerald-950/40 border-b border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 shrink-0">
                      {language === 'ne' ? 'डेलिभरी स्थान:' : 'Delivering to:'}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">{assignedLocationLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationModalOpen(true)}
                    className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    {language === 'ne' ? 'परिवर्तन' : 'Change'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-slate-50/70 dark:bg-[#090D16] text-slate-800 dark:text-slate-100 text-sm">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200 dark:border-emerald-800">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[90%] space-y-2.5 ${
                          msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-none shadow-sm p-3'
                            : 'bg-white dark:bg-[#111726] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-800 shadow-sm p-3'
                        }`}
                      >
                        <div className="whitespace-pre-line text-sm leading-relaxed">{msg.content}</div>

                        {msg.recommendedOffers && msg.recommendedOffers.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <Store className="w-3.5 h-3.5" />
                              <span>
                                {language === 'ne'
                                  ? 'उत्कृष्ट पसल र सस्तो मूल्य विकल्प'
                                  : 'Best Seller & Best Price Matches'}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {msg.recommendedOffers.slice(0, 4).map((offer) => (
                                <ChatOfferCard
                                  key={offer.product_id}
                                  offer={offer}
                                  language={language}
                                  formatPrice={formatPrice}
                                  onAddToCart={addToCart}
                                  onBuyNow={(selected) => handlePrepareOfferDirectBuy(msg.id, selected)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {msg.orderPreview && !msg.placedOrder && (
                          <ChatDirectOrderCard
                            preview={msg.orderPreview}
                            language={language}
                            assignedLocationLabel={assignedLocationLabel}
                            isAuthenticated={Boolean(user)}
                            isPlacing={placingMessageId === msg.id}
                            formatPrice={formatPrice}
                            onUpdatePreview={(updater) => updateOrderPreview(msg.id, updater)}
                            onConfirmPurchase={() => handleConfirmDirectPurchase(msg.id, msg.orderPreview!)}
                          />
                        )}

                        {msg.placedOrder && (
                          <ChatPlacedOrderCard
                            order={msg.placedOrder}
                            language={language}
                            assignedLocationLabel={assignedLocationLabel}
                            pendingPayment={msg.pendingPayment}
                            paymentVerified={msg.paymentVerified}
                            isVerifying={verifyingMessageId === msg.id}
                            formatPrice={formatPrice}
                            onVerifyPayment={() =>
                              msg.pendingPayment && handleVerifyInlinePayment(msg.id, msg.pendingPayment)
                            }
                            onTrackOrder={() => {
                              setIsOpen(false);
                              navigate(`/orders/${msg.placedOrder!.id}`);
                            }}
                          />
                        )}

                        {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                            {msg.groundingChunks.map((chunk, idx) =>
                              chunk.maps ? (
                                <a
                                  key={idx}
                                  href={
                                    chunk.maps.uri ||
                                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                      chunk.maps.title || 'Kathmandu'
                                    )}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 font-medium"
                                >
                                  <MapPin className="w-3 h-3 text-red-500" />
                                  <span>{chunk.maps.title || 'View Map'}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : null
                            )}
                          </div>
                        )}

                        <div
                          className={`text-[11px] text-right ${
                            msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>

                      {msg.role === 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-white dark:bg-[#111726] rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex items-center gap-2">
                        <div className="flex space-x-1.5">
                          <div
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {t('chat.checking')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {messages.length <= 2 && (
                  <div className="p-2.5 bg-slate-100/70 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 px-1 flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('chat.quickQuestions')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="text-xs bg-white dark:bg-[#111726] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left cursor-pointer"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-white dark:bg-[#111726] border-t border-slate-200 dark:border-slate-800">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={t('chat.placeholder')}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || loading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-1.5 px-1">
                    <span>{t('chat.poweredBy')}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      {t('chat.valleyGrounded')}
                    </span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const ChatConcierge: React.FC = () => (
  <ChatErrorBoundary>
    <ChatConciergeInner />
  </ChatErrorBoundary>
);
