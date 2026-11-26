import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    '🔍 Find Products',
    '📦 Track My Order',
    '🏪 Find Stores',
    '🛒 Shopping Assistance',
    '⚡ Order cheapest fresh milk & avocados delivered now',
  ],
  ne: [
    '🔍 सामान खोज्नुहोस्',
    '📦 मेरो अर्डर ट्र्याक गर्नुहोस्',
    '🏪 नजिकका पसल खोज्नुहोस्',
    '🛒 किनमेल सहायता',
    '⚡ सस्तो ताजा दूध र एभोकाडो अहिले नै अर्डर गर्नुहोस्',
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
  const location = useLocation();

  // Strict Customer-Only Isolation: Never render on merchant / vendor / admin / rider routes
  const isVendorOrPortalRoute =
    location.pathname.startsWith('/seller') ||
    location.pathname.startsWith('/vendor') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/rider') ||
    location.pathname === '/become-seller' ||
    location.pathname === '/track-application';

  if (isVendorOrPortalRoute) {
    return null;
  }

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
          <button
          data-testid="chat-concierge-trigger"
          type="button"
          aria-expanded={false}
          aria-haspopup="dialog"
          aria-label="Ask OyoPasal AI"
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
            setIsOpen(true);
          }}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-center select-none cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-full transition-transform duration-300 animate-gentle-float"
          title="Ask OyoPasal AI"
        >
            {/* Standalone Full-Body Robot Character from Reference with Transparent Background & Soft Green Glow */}
            <div className="relative h-16 sm:h-20 w-auto flex items-center justify-center animate-drop-glow transition-transform duration-300 group-hover:scale-110 active:scale-95">
              <img
                src="/assets/images/oyopasal_robot_character.png"
                alt="OyoPasal AI Robot"
                className="h-16 sm:h-20 w-auto object-contain select-none pointer-events-none"
                draggable={false}
              />

                  {/* Glowing Online Pulsing Pip */}
                  <span className="absolute -top-0.5 right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-emerald-950 shadow-xs animate-ping" />
                  <span className="absolute -top-0.5 right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-emerald-950 shadow-xs" />

                  {/* Live voice indicator if currently active */}
                  {isVoiceActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full shadow-md animate-pulse whitespace-nowrap">
                Live Voice
              </span>
            )}
            </div>

                {/* Tooltip on hover: "Ask OyoPasal AI" */}
                <div className="pointer-events-none absolute -top-8.5 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center px-2.5 py-1 rounded-lg bg-slate-900/95 text-white text-[11px] font-bold whitespace-nowrap shadow-xl border border-emerald-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                  <span className="flex items-center gap-1">
                    <span>Ask OyoPasal AI</span>
                    <Sparkles className="w-3 h-3 text-[#FACC15] fill-[#FACC15]" />
                  </span>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                </div>
            </button>
      )}

            {isOpen && (
              <div
                data-testid="chat-concierge-drawer"
                role="dialog"
                aria-label="Ai Assistant"
                className={`fixed z-[52] ${isMinimized
                    ? 'bottom-20 sm:bottom-6 right-4 sm:right-5 w-80'
                    : 'bottom-4 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[480px] md:w-[500px] max-w-[520px] h-[min(650px,90vh)]'
                  } bg-white dark:bg-[#111726] rounded-[24px] shadow-2xl border border-emerald-900/20 dark:border-slate-800 flex flex-col overflow-hidden opacity-100`}
              >
                {/* Redesigned Emerald-to-Forest Gradient Header */}
                <div
                  className="relative rounded-t-[24px] text-white p-3.5 sm:p-4 md:py-[20px] md:px-[24px] flex items-center justify-between select-none shadow-sm overflow-hidden"
                  style={{ background: 'linear-gradient(90deg, #065F46 0%, #064E3B 100%)' }}
                >
                  {/* Subtle matte texture / curved background accents */}
                  <div className="absolute inset-0 pointer-events-none opacity-10 overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 500 100" fill="none" preserveAspectRatio="none">
                      <path d="M0,80 C150,120 350,0 500,40 L500,0 L0,0 Z" fill="white" />
                      <circle cx="430" cy="15" r="75" fill="white" />
                    </svg>
                  </div>

                  {/* Left Side: 56x56 Mascot Container + Ai Assistant ✨ + Mint-green Online Indicator */}
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 relative z-10">
                    <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-[56px] md:h-[56px] rounded-2xl overflow-hidden ring-1.5 ring-emerald-400/40 border border-white/20 shrink-0 bg-[#043E30]/70 shadow-inner flex items-center justify-center p-0.5">
                      <img
                        src="/assets/images/oyopasal_ai_robot_avatar.png"
                        alt="OyoPasal AI Robot Mascot"
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-extrabold text-xl sm:text-2xl md:text-[27px] leading-tight text-white flex items-center gap-1.5 truncate">
                        <span>Ai Assistant</span>
                        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#FACC15] fill-[#FACC15] shrink-0" />
                      </h3>
                      {/* Small mint-green online status indicator underneath the title */}
                      <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-xs" />
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-emerald-200/90 tracking-wide">
                          Online
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side Controls: Voice button, Refresh, Collapse, Close */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 relative z-10">
                    {/* 1. Voice button: Translucent glass-style green/white pill, yellow waveform icon, white Voice label */}
                    <button
                      type="button"
                      onClick={liveVoice.toggleVoice}
                      aria-label={isVoiceActive ? 'End voice conversation' : 'Start voice conversation'}
                      title={
                        isVoiceActive
                          ? 'Stop Voice Conversation'
                          : 'Start Real-Time Voice Conversation'
                      }
                      className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border ${
                        isVoiceActive
                          ? 'bg-rose-500/90 text-white border-rose-300/40 hover:bg-rose-600 animate-pulse'
                          : 'bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-md'
                      }`}
                    >
                      {isVoiceActive ? (
                        <PhoneOff className="w-3.5 h-3.5 text-white shrink-0" />
                      ) : (
                        <AudioLines className="w-4 h-4 text-[#FACC15] shrink-0" />
                      )}
                      <span className="text-white font-semibold">
                        {isVoiceActive ? (language === 'ne' ? 'रोक्नुहोस्' : 'End') : 'Voice'}
                      </span>
                    </button>

                    {/* 2. Refresh: White outline refresh icon to start a new chat */}
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      title="New chat"
                      aria-label="New chat"
                      className="p-1.5 sm:p-2 text-white/90 hover:text-white hover:bg-white/15 rounded-full transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-white stroke-[2]" />
                    </button>

                    {/* 3. Collapse: White downward chevron to minimize the drawer */}
                    <button
                      type="button"
                      onClick={() => setIsMinimized(!isMinimized)}
                      title={isMinimized ? 'Expand' : 'Collapse'}
                      aria-label={isMinimized ? 'Expand' : 'Collapse'}
                      className="p-1.5 sm:p-2 text-white/90 hover:text-white hover:bg-white/15 rounded-full transition-colors cursor-pointer"
                    >
                      <ChevronDown
                        className={`w-5 h-5 text-white transition-transform duration-200 ${
                          isMinimized ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* 4. Close: White X icon to close the assistant panel */}
                    <button
                      type="button"
                      onClick={() => {
                        liveVoice.stopVoice(false);
                        setIsOpen(false);
                        setIsMinimized(false);
                      }}
                      title="Close assistant"
                      aria-label="Close assistant"
                      className="p-1.5 sm:p-2 text-white/90 hover:text-white hover:bg-white/15 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5 text-white" />
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
                        className={`px-3.5 py-2.5 border-b text-xs flex flex-col gap-1.5 ${liveVoice.voiceStatus === 'error'
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
                                  className={`w-2.5 h-2.5 rounded-full ${liveVoice.voiceStatus === 'connecting'
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
                            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-0.5 ring-1 ring-amber-400/60 border border-emerald-400/40 shadow-xs bg-emerald-950">
                              <img
                                src="/assets/images/oyopasal_ai_robot_avatar.png"
                                alt="OyoPasal AI"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <div
                            className={`max-w-[90%] space-y-2.5 ${msg.role === 'user'
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
                              className={`text-[11px] text-right ${msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
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
                          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 ring-1 ring-amber-400/60 border border-emerald-400/40 shadow-xs bg-emerald-950">
                            <img
                              src="/assets/images/oyopasal_ai_robot_avatar.png"
                              alt="OyoPasal AI"
                              className="w-full h-full object-cover"
                            />
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
                              : 'Talk with Real-Time Voice'
                          }
                          className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer border ${isVoiceActive
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
