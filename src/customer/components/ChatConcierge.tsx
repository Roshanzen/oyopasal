import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  MapPin,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ShoppingBag,
  ShoppingCart,
  Zap,
  Star,
  CheckCircle2,
  CreditCard,
  Plus,
  Minus,
  Navigation,
  Lock,
  ArrowRight,
  Store,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import {
  ChatOrderPreview,
  ChatProductOffer,
  Order,
} from '../../shared/types';

interface GroundingMapChunk {
  maps?: {
    uri?: string;
    title?: string;
  };
}

interface PendingGatewayPayment {
  orderId: string;
  orderNumber: string;
  method: string;
  amount: number;
  transactionUuid: string;
  signature: string;
  productCode: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingChunks?: GroundingMapChunk[];
  recommendedOffers?: ChatProductOffer[];
  orderPreview?: ChatOrderPreview | null;
  placedOrder?: Order | null;
  pendingPayment?: PendingGatewayPayment | null;
  paymentVerified?: boolean;
}

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

export const ChatConcierge: React.FC = () => {
  const {
    language,
    t,
    formatPrice,
    user,
    currentAddress,
    currentCoordinates,
    addToCart,
    refreshCart,
    publicSettings,
    setLoginModalOpen,
    setLocationModalOpen,
    showToast,
  } = useApp();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: t('chat.welcome'),
      timestamp: language === 'ne' ? 'अहिले' : 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [placingMessageId, setPlacingMessageId] = useState<string | null>(null);
  const [verifyingMessageId, setVerifyingMessageId] = useState<string | null>(null);
  const [catalogBannerCount, setCatalogBannerCount] = useState<number | null>(null);
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync welcome message when language switches before conversation starts
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id.startsWith('welcome')) {
        return [
          {
            ...prev[0],
            content: t('chat.welcome'),
            timestamp: language === 'ne' ? 'अहिले' : 'Just now',
          },
        ];
      }
      return prev;
    });
  }, [language, t]);

  // Geolocation fallback if no address coordinates are set yet
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          setGeoCoords(null);
        },
        { timeout: 4000 }
      );
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, loading]);

  const effectiveLocation = {
    latitude: currentAddress?.lat ?? currentCoordinates?.lat ?? geoCoords?.latitude ?? 27.6986,
    longitude: currentAddress?.lng ?? currentCoordinates?.lng ?? geoCoords?.longitude ?? 85.3292,
    area: currentAddress?.area || 'New Baneshwor',
    street: currentAddress?.street || 'New Baneshwor Chowk',
    city: currentAddress?.city || 'Kathmandu',
    addressId: currentAddress?.id,
  };

  const assignedLocationLabel = currentAddress
    ? `${currentAddress.title} – ${currentAddress.area}`
    : `${effectiveLocation.area}, ${effectiveLocation.city}`;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const data = await api.sendChatMessage({
        messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
        userLocation: effectiveLocation,
        language,
      });

      if (data.catalogStats?.totalProducts) {
        setCatalogBannerCount(data.catalogStats.totalProducts);
      }
      if (data.cartUpdated) {
        refreshCart().catch(() => {});
      }

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.reply || 'Here are the best seller offers for your delivery address:',
        groundingChunks: data.groundingChunks || [],
        recommendedOffers: data.recommendedOffers || [],
        orderPreview: data.orderPreview || null,
        placedOrder: data.placedOrder || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content:
            err?.message ||
            'Could not reach the live store catalog right now. Please try again!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: t('chat.welcome'),
        timestamp: language === 'ne' ? 'अहिले' : 'Just now',
      },
    ]);
  };

  // Promote a single recommended offer into an interactive Direct Checkout Card
  const handlePrepareOfferDirectBuy = (messageId: string, offer: ChatProductOffer) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const qty = Math.min(offer.stock, Math.max(1, offer.suggested_quantity || 1));
        const subtotal = offer.price * qty;
        const freeThreshold = publicSettings?.delivery_fees?.freeDeliveryThreshold ?? 499;
        const baseDelivery = publicSettings?.delivery_fees?.baseDeliveryFee ?? 35;
        const deliveryFee = subtotal >= freeThreshold ? 0 : baseDelivery;
        const handlingFee = publicSettings?.delivery_fees?.handlingFee ?? 15;
        const preview: ChatOrderPreview = {
          items: [
            {
              product_id: offer.product_id,
              name: offer.name,
              unit: offer.unit,
              quantity: qty,
              unit_price: offer.price,
              line_total: subtotal,
              stock: offer.stock,
              image_url: offer.image_url,
              vendor_id: offer.vendor_id,
              vendor_name: offer.vendor_name,
              vendor_rating: offer.vendor_rating,
              distance_km: offer.distance_km,
              eta_mins: offer.eta_mins,
            },
          ],
          assigned_address: {
            id: effectiveLocation.addressId,
            title: currentAddress?.title || 'Assigned Location',
            street: effectiveLocation.street,
            area: effectiveLocation.area,
            city: effectiveLocation.city,
            lat: effectiveLocation.latitude,
            lng: effectiveLocation.longitude,
          },
          payment_method: m.orderPreview?.payment_method || 'CASH_ON_DELIVERY',
          delivery_option: m.orderPreview?.delivery_option || 'EXPRESS_12_MINS',
          coupon_code: m.orderPreview?.coupon_code || null,
          subtotal,
          delivery_fee: deliveryFee,
          free_delivery_threshold: freeThreshold,
          handling_fee: handlingFee,
          discount: 0,
          total_amount: subtotal + deliveryFee + handlingFee,
          estimated_mins: offer.eta_mins,
          requires_auth: !user,
        };
        return { ...m, orderPreview: preview };
      })
    );
  };

  const updateOrderPreview = (
    messageId: string,
    updater: (prevPreview: ChatOrderPreview) => ChatOrderPreview
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.orderPreview) return m;
        const nextPreview = updater(m.orderPreview);
        const subtotal = nextPreview.items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
        const freeThreshold =
          nextPreview.free_delivery_threshold ||
          publicSettings?.delivery_fees?.freeDeliveryThreshold ||
          499;
        const baseDelivery =
          m.orderPreview.delivery_fee > 0
            ? m.orderPreview.delivery_fee
            : publicSettings?.delivery_fees?.baseDeliveryFee ?? 35;
        const deliveryFee = subtotal >= freeThreshold ? 0 : baseDelivery;
        const handlingFee =
          nextPreview.handling_fee ?? publicSettings?.delivery_fees?.handlingFee ?? 15;
        const discount = Math.min(subtotal, nextPreview.discount || 0);
        const total = Math.max(0, subtotal + deliveryFee + handlingFee - discount);
        return {
          ...m,
          orderPreview: {
            ...nextPreview,
            subtotal,
            delivery_fee: deliveryFee,
            total_amount: total,
          },
        };
      })
    );
  };

  const handleConfirmDirectPurchase = async (messageId: string, preview: ChatOrderPreview) => {
    if (!user) {
      showToast(
        language === 'ne'
          ? 'सीधै खरिद पूरा गर्न कृपया साइन इन गर्नुहोस्।'
          : 'Please sign in to complete your direct purchase.',
        'info'
      );
      setLoginModalOpen(true);
      return;
    }

    setPlacingMessageId(messageId);
    try {
      const payloadAddress = currentAddress
        ? {
            title: currentAddress.title,
            recipient_name: currentAddress.recipient_name || user.full_name,
            phone: currentAddress.phone || user.phone,
            street: currentAddress.street,
            area: currentAddress.area,
            city: currentAddress.city,
            landmark: currentAddress.landmark,
            lat: currentAddress.lat,
            lng: currentAddress.lng,
          }
        : {
            title: preview.assigned_address.title,
            recipient_name: user.full_name,
            phone: user.phone || '+977 9800000000',
            street: effectiveLocation.street,
            area: effectiveLocation.area,
            city: effectiveLocation.city,
            lat: effectiveLocation.latitude,
            lng: effectiveLocation.longitude,
          };

      const res = await api.placeDirectChatOrder({
        items: preview.items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        address_id: currentAddress?.id || preview.assigned_address.id,
        delivery_address: payloadAddress,
        payment_method: preview.payment_method,
        delivery_option: preview.delivery_option,
        coupon_code: preview.coupon_code || null,
        notes: `Direct AI Purchase -> ${effectiveLocation.area}`,
      });

      const order = res.order;
      let pendingPayment: PendingGatewayPayment | null = null;

      if (preview.payment_method === 'ESEWA' || preview.payment_method === 'KHALTI') {
        try {
          const payInit = await api.initiatePayment(order.id, preview.payment_method);
          pendingPayment = {
            orderId: order.id,
            orderNumber: order.order_number,
            method: payInit.method,
            amount: payInit.amount,
            transactionUuid: payInit.transaction_uuid,
            signature: payInit.signature,
            productCode: payInit.product_code,
          };
        } catch {
          // Order still placed; user can pay from tracking page
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                orderPreview: null,
                placedOrder: order,
                pendingPayment,
                paymentVerified: preview.payment_method === 'CASH_ON_DELIVERY',
              }
            : m
        )
      );

      showToast(
        language === 'ne'
          ? `अर्डर ${order.order_number} सफलतापूर्वक राखियो!`
          : `Order ${order.order_number} placed directly to ${effectiveLocation.area}!`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not place direct order', 'error');
    } finally {
      setPlacingMessageId(null);
    }
  };

  const handleVerifyInlinePayment = async (messageId: string, challenge: PendingGatewayPayment) => {
    setVerifyingMessageId(messageId);
    try {
      const res = await api.verifyPayment({
        order_id: challenge.orderId,
        transaction_uuid: challenge.transactionUuid,
        signature: challenge.signature,
      });
      if (res.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  pendingPayment: null,
                  paymentVerified: true,
                  placedOrder: m.placedOrder
                    ? { ...m.placedOrder, payment_status: 'PAID' }
                    : m.placedOrder,
                }
              : m
          )
        );
        showToast(
          language === 'ne'
            ? `भुक्तानी प्रमाणित भयो (${challenge.method})!`
            : `${challenge.method} payment verified!`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Payment verification failed', 'error');
    } finally {
      setVerifyingMessageId(null);
    }
  };

  const suggestions = DEFAULT_SUGGESTIONS_BY_LANG[language] || DEFAULT_SUGGESTIONS_BY_LANG.en;

  return (
    <AnimatePresence>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={() => setIsOpen(true)}
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

      {/* Floating Chat Drawer */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className={`fixed z-50 ${
            isMinimized
              ? 'bottom-6 right-5 w-80'
              : 'bottom-4 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[460px] max-w-[480px] h-[640px] max-h-[88vh]'
          } bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden`}
        >
          {/* Header */}
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
                onClick={handleClearHistory}
                title="Restart chat"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`}
                />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Active Assigned Delivery Location Bar */}
              <div className="px-3.5 py-2 bg-emerald-50/90 dark:bg-emerald-950/40 border-b border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 shrink-0">
                    {language === 'ne' ? 'डेलिभरी स्थान:' : 'Delivering to:'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {assignedLocationLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold shrink-0 cursor-pointer"
                >
                  {language === 'ne' ? 'परिवर्तन' : 'Change'}
                </button>
              </div>

              {/* Message List */}
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
                      {/* Message Text */}
                      <div className="whitespace-pre-line text-sm leading-relaxed">{msg.content}</div>

                      {/* Matched Best Seller & Best Price Offers */}
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
                              <div
                                key={offer.product_id}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5"
                              >
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
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {offer.vendor_name}
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-1.5">
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                                        {formatPrice(offer.price)}
                                      </span>
                                      {offer.original_price > offer.price && (
                                        <span className="text-[11px] line-through text-slate-400">
                                          {formatPrice(offer.original_price)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addToCart(offer.product_id, offer.suggested_quantity || 1)
                                        }
                                        className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <ShoppingCart className="w-3 h-3" />
                                        <span>{language === 'ne' ? 'थप्नुहोस्' : '+ Cart'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePrepareOfferDirectBuy(msg.id, offer)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Zap className="w-3 h-3" />
                                        <span>{language === 'ne' ? 'किन्नुहोस्' : 'Buy Now'}</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive Direct Purchase Bundle Card */}
                      {msg.orderPreview && !msg.placedOrder && (
                        <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300/70 dark:border-emerald-800/80 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                              <Zap className="w-4 h-4 text-amber-500" />
                              <span>
                                {language === 'ne'
                                  ? 'तुरुन्तै अर्डर सारांश'
                                  : 'Direct Purchase to Assigned Address'}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                              ~{msg.orderPreview.estimated_mins} mins
                            </span>
                          </div>

                          {/* Items with +/- quantity controls */}
                          <div className="space-y-1.5">
                            {msg.orderPreview.items.map((item) => (
                              <div
                                key={item.product_id}
                                className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.vendor_name} · {formatPrice(item.unit_price)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateOrderPreview(msg.id, (prev) => ({
                                        ...prev,
                                        items: prev.items.map((it) =>
                                          it.product_id === item.product_id
                                            ? {
                                                ...it,
                                                quantity: Math.max(1, it.quantity - 1),
                                                line_total:
                                                  it.unit_price * Math.max(1, it.quantity - 1),
                                              }
                                            : it
                                        ),
                                      }))
                                    }
                                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="text-xs font-extrabold w-4 text-center">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateOrderPreview(msg.id, (prev) => ({
                                        ...prev,
                                        items: prev.items.map((it) =>
                                          it.product_id === item.product_id
                                            ? {
                                                ...it,
                                                quantity: Math.min(it.stock, it.quantity + 1),
                                                line_total:
                                                  it.unit_price *
                                                  Math.min(it.stock, it.quantity + 1),
                                              }
                                            : it
                                        ),
                                      }))
                                    }
                                    className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Delivery & Payment Controls */}
                          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                            {(['CASH_ON_DELIVERY', 'ESEWA', 'KHALTI'] as const).map((pm) => {
                              const active = msg.orderPreview?.payment_method === pm;
                              return (
                                <button
                                  key={pm}
                                  type="button"
                                  onClick={() =>
                                    updateOrderPreview(msg.id, (prev) => ({
                                      ...prev,
                                      payment_method: pm,
                                    }))
                                  }
                                  className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {pm === 'CASH_ON_DELIVERY'
                                    ? 'COD'
                                    : pm === 'ESEWA'
                                    ? 'eSewa'
                                    : 'Khalti'}
                                </button>
                              );
                            })}
                          </div>

                          {/* Totals Summary */}
                          <div className="text-xs space-y-1 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/60">
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                              <span>
                                {language === 'ne' ? 'डेलिभरी ठेगाना' : 'Assigned Delivery'}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                                {assignedLocationLabel}
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                              <span>{language === 'ne' ? 'डेलिभरी शुल्क' : 'Delivery Fee'}</span>
                              <span className="font-semibold">
                                {msg.orderPreview.delivery_fee === 0
                                  ? 'FREE'
                                  : formatPrice(msg.orderPreview.delivery_fee)}
                              </span>
                            </div>
                            {msg.orderPreview.discount > 0 && (
                              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                                <span>Coupon ({msg.orderPreview.coupon_code})</span>
                                <span>-{formatPrice(msg.orderPreview.discount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-1">
                              <span>{language === 'ne' ? 'कुल जम्मा' : 'Total Payable'}</span>
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {formatPrice(msg.orderPreview.total_amount)}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={placingMessageId === msg.id}
                            onClick={() => handleConfirmDirectPurchase(msg.id, msg.orderPreview!)}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            {placingMessageId === msg.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {placingMessageId === msg.id
                                ? language === 'ne'
                                  ? 'अर्डर राखिँदैछ...'
                                  : 'Placing Order...'
                                : !user
                                ? language === 'ne'
                                  ? 'साइन इन गरी तुरुन्तै किन्नुहोस्'
                                  : `Sign in & Order • ${formatPrice(msg.orderPreview.total_amount)}`
                                : language === 'ne'
                                ? `अर्डर पक्का गर्नुहोस् • ${formatPrice(msg.orderPreview.total_amount)}`
                                : `Confirm & Buy Now • ${formatPrice(msg.orderPreview.total_amount)}`}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Confirmed Direct Order Receipt Card */}
                      {msg.placedOrder && (
                        <div className="p-3 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-500/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Order Confirmed: {msg.placedOrder.order_number}</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {formatPrice(msg.placedOrder.total_amount)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Delivering to <strong>{msg.placedOrder.delivery_address.area}</strong> (
                            {msg.placedOrder.estimated_delivery_mins} mins) ·{' '}
                            {msg.placedOrder.payment_method}
                          </p>

                          {msg.pendingPayment && !msg.paymentVerified && (
                            <button
                              type="button"
                              disabled={verifyingMessageId === msg.id}
                              onClick={() =>
                                handleVerifyInlinePayment(msg.id, msg.pendingPayment!)
                              }
                              className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>
                                {verifyingMessageId === msg.id
                                  ? 'Verifying...'
                                  : `Authorize ${msg.pendingPayment.method} Payment`}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              navigate(`/orders/${msg.placedOrder!.id}`);
                            }}
                            className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>
                              {language === 'ne' ? 'लाइभ अर्डर ट्र्याक गर्नुहोस्' : 'Track Live Order'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Google Maps Grounding Links if present */}
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
                          msg.role === 'user'
                            ? 'text-emerald-100'
                            : 'text-slate-400 dark:text-slate-500'
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

              {/* Quick Suggestions */}
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
                        onClick={() => handleSendMessage(sug)}
                        className="text-xs bg-white dark:bg-[#111726] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Footer */}
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
  );
};
