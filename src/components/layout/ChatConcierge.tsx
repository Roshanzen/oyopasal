import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  AudioLines,
  Bot,
  ChevronDown,
  ExternalLink,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  PhoneOff,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import { useChatConcierge } from '../../hooks/useChatConcierge';
import ChatOfferCard from '../chat/ChatOfferCard';
import ChatDirectOrderCard from '../chat/ChatDirectOrderCard';
import ChatPlacedOrderCard from '../chat/ChatPlacedOrderCard';

const DEFAULT_SUGGESTIONS_BY_LANG = {
  en: [
    '⚡ Order cheap product for me to my location',
    '🛍️ Order a medium range product for me now',
    '🥛 Order cheapest fresh milk & avocados delivered now',
    '🥦 Show best-rated organic vegetables near me',
  ],
  ne: [
    '⚡ मेरो ठेगानामा सस्तो सामान स्वचालित रूपमा अर्डर गर्नुहोस्',
    '🛍️ मेरो लागि मध्यम मूल्यको सामान अर्डर गर्नुहोस्',
    '🥛 सस्तो ताजा दूध र एभोकाडो अहिले नै अर्डर गर्नुहोस्',
    '🥦 नजिकको अर्गानिक तरकारीका उत्कृष्ट पसल देखाउनुहोस्',
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
    liveVoice,
  } = useChatConcierge();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      try {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } catch {
        // ignore environments without smooth scrollIntoView
      }
    }
  }, [
    messages,
    isOpen,
    isMinimized,
    loading,
    liveVoice.liveUserTranscript,
    liveVoice.liveModelTranscript,
  ]);

  const suggestions = DEFAULT_SUGGESTIONS_BY_LANG[language] || DEFAULT_SUGGESTIONS_BY_LANG.en;
  const isVoiceActive =
    liveVoice.voiceStatus === 'connected' || liveVoice.voiceStatus === 'connecting';

  return (
    <>
      {!isOpen && (
        <div
          data-testid="chat-concierge-trigger"
          role="button"
          tabIndex={0}
          aria-expanded={false}
          aria-haspopup="dialog"
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsMinimized(false);
              setIsOpen(true);
            }
          }}
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #064E3B 100%)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
          }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full select-none cursor-pointer shadow-lg shadow-emerald-950/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          title="Open OyoPasal AI Shopper"
        >
          {/* Left Icon Badge: 36px x 36px circular translucent frosted container with gold sparkle icon */}
          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20 shadow-xs">
            <Sparkles className="w-4.5 h-4.5 text-[#FACC15] fill-[#FACC15]/20 animate-pulse" />
          </div>

          {/* Brand Title: Crisp bold white text */}
          <span className="font-extrabold text-sm sm:text-base text-white tracking-tight whitespace-nowrap font-display">
            OyoPasal AI
          </span>

          {/* Model Badge: frosted-glass rounded rectangle with "Gemini 4" */}
          <span className="px-2 py-0.5 rounded-md bg-white/15 backdrop-blur-xs border border-white/20 text-[11px] font-semibold text-white whitespace-nowrap shadow-2xs">
            Gemini 4
          </span>

          {/* Voice Trigger Pill: frosted translucent button with yellow audio waveform icon */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              liveVoice.toggleVoice();
            }}
            aria-label={isVoiceActive ? 'End voice conversation' : 'Start voice conversation'}
            title={isVoiceActive ? 'Stop Voice Conversation' : 'Start Voice Conversation'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 text-white font-bold text-xs transition-all duration-150 cursor-pointer shadow-xs whitespace-nowrap shrink-0 active:scale-95 ${
              isVoiceActive
                ? 'bg-rose-500/80 hover:bg-rose-600'
                : 'bg-white/15 hover:bg-white/25'
            }`}
          >
            <AudioLines className={`w-3.5 h-3.5 text-[#FACC15] shrink-0 ${isVoiceActive ? 'animate-bounce' : ''}`} />
            <span className="text-white font-bold">
              {isVoiceActive ? (language === 'ne' ? 'रोक्नुहोस्' : 'End') : 'Voice'}
            </span>
          </button>

          {/* Expand Icon: clean white diagonal expand arrow icon (↗) */}
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full text-white/80 group-hover:text-white transition-colors shrink-0"
            aria-hidden="true"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </div>
      )}

      {isOpen && (
        <div
          data-testid="chat-concierge-drawer"
          role="dialog"
          aria-label={t('chat.title')}
          className={`fixed z-[52] ${
            isMinimized
              ? 'bottom-20 sm:bottom-6 right-4 sm:right-5 w-80'
              : 'bottom-4 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[460px] max-w-[480px] h-[min(640px,88vh)]'
          } bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden opacity-100`}
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
                      {isVoiceActive ? 'Gemini 3.8 Live' : 'Gemini 4'}
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
                  onClick={liveVoice.toggleVoice}
                  aria-label={isVoiceActive ? 'End voice conversation' : 'Start voice conversation'}
                  title={
                    isVoiceActive
                      ? 'Stop Gemini Live Voice Conversation'
                      : 'Start Real-Time Voice Conversation (Gemini 3.8 Live)'
                  }
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                    isVoiceActive
                      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {isVoiceActive ? (
                    <PhoneOff className="w-3.5 h-3.5" />
                  ) : (
                    <AudioLines className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span className="hidden sm:inline">
                    {isVoiceActive ? (language === 'ne' ? 'रोक्नुहोस्' : 'End Voice') : 'Voice'}
                  </span>
                </button>
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
                    liveVoice.stopVoice(false);
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

                {(isVoiceActive || liveVoice.voiceError) && (
                  <div
                    className={`px-3.5 py-2.5 border-b text-xs flex flex-col gap-1.5 ${
                      liveVoice.voiceStatus === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
                        : 'bg-teal-950/90 border-teal-800 text-emerald-100'
                    }`}
                  >
                    {liveVoice.voiceStatus === 'error' ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="truncate">{liveVoice.voiceError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => liveVoice.stopVoice(false)}
                          className="font-bold underline shrink-0 cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                liveVoice.voiceStatus === 'connecting'
                                  ? 'bg-amber-400 animate-pulse'
                                  : liveVoice.isSpeaking
                                  ? 'bg-sky-400 animate-ping'
                                  : 'bg-emerald-400 animate-pulse'
                              }`}
                            />
                            <span className="font-bold">
                              {liveVoice.voiceStatus === 'connecting'
                                ? language === 'ne'
                                  ? 'Gemini 3.8 Live जडान हुँदैछ...'
                                  : 'Connecting Gemini 3.8 Live...'
                                : liveVoice.isSpeaking
                                ? language === 'ne'
                                  ? 'AI बोल्दैछ...'
                                  : 'AI Speaking (24kHz PCM)...'
                                : liveVoice.isMuted
                                ? language === 'ne'
                                  ? 'माइक म्युट छ'
                                  : 'Mic Muted'
                                : language === 'ne'
                                ? 'सुन्दैछ — अर्डर गर्न बोल्नुहोस्...'
                                : 'Listening live — speak to order or ask...'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={liveVoice.toggleMute}
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              {liveVoice.isMuted ? (
                                <MicOff className="w-3.5 h-3.5 text-amber-300" />
                              ) : (
                                <Mic className="w-3.5 h-3.5 text-emerald-300" />
                              )}
                              <span>{liveVoice.isMuted ? 'Unmute' : 'Mute'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => liveVoice.stopVoice(false)}
                              className="px-2 py-1 rounded bg-rose-500/80 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                            >
                              Stop
                            </button>
                          </div>
                        </div>
                        {(liveVoice.liveUserTranscript || liveVoice.liveModelTranscript) && (
                          <div className="text-[11px] text-emerald-100/90 space-y-0.5 pt-1 border-t border-teal-800/70">
                            {liveVoice.liveUserTranscript && (
                              <p className="truncate">
                                <strong>You:</strong> {liveVoice.liveUserTranscript}
                              </p>
                            )}
                            {liveVoice.liveModelTranscript && (
                              <p className="truncate text-sky-200">
                                <strong>AI:</strong> {liveVoice.liveModelTranscript}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

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
                    <button
                      type="button"
                      onClick={liveVoice.toggleVoice}
                      aria-label={isVoiceActive ? 'Stop voice chat' : 'Start voice chat'}
                      title={
                        isVoiceActive
                          ? 'Stop Voice Conversation'
                          : 'Talk with Gemini 3.8 Live Voice'
                      }
                      className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer border ${
                        isVoiceActive
                          ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {isVoiceActive ? <PhoneOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
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
                    <span>{t('chat.poweredBy')} + Gemini 3.8 Live</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      {t('chat.valleyGrounded')}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
    </>
  );
};

export const ChatConcierge: React.FC = () => (
  <ChatErrorBoundary>
    <ChatConciergeInner />
  </ChatErrorBoundary>
);
