import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context';
import { chatService, paymentService } from '../services';
import { ChatOrderPreview, ChatProductOffer, Order } from '../types';
import { useLiveVoice } from './useLiveVoice';

export interface GroundingMapChunk {
  maps?: {
    uri?: string;
    title?: string;
  };
}

export interface PendingGatewayPayment {
  orderId: string;
  orderNumber: string;
  method: string;
  amount: number;
  transactionUuid: string;
  signature: string;
  productCode: string;
}

export interface ChatMessage {
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

export function useChatConcierge() {
  const {
    language,
    t,
    user,
    currentAddress,
    currentCoordinates,
    addToCart,
    refreshCart,
    publicSettings,
    setLoginModalOpen,
    setLocationModalOpen,
    showToast,
    formatPrice,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
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

  const pendingAutoOrderRef = useRef<{ messageId: string; preview: ChatOrderPreview } | null>(null);

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

  const effectiveLocation = useMemo(
    () => ({
      latitude: currentAddress?.lat ?? (currentAddress as any)?.latitude ?? currentCoordinates?.lat ?? geoCoords?.latitude ?? 27.6986,
      longitude: currentAddress?.lng ?? (currentAddress as any)?.longitude ?? currentCoordinates?.lng ?? geoCoords?.longitude ?? 85.3292,
      area: currentAddress?.area || 'New Baneshwor',
      street: currentAddress?.street || 'New Baneshwor Chowk',
      city: currentAddress?.city || 'Kathmandu',
      addressId: currentAddress?.id,
    }),
    [currentAddress, currentCoordinates, geoCoords]
  );

  const assignedLocationLabel = currentAddress
    ? `${currentAddress.title} – ${currentAddress.area}`
    : `${effectiveLocation.area}, ${effectiveLocation.city}`;

  const initiateInlinePaymentIfNeeded = useCallback(async (order: Order): Promise<PendingGatewayPayment | null> => {
    if (order.payment_method !== 'ESEWA' && order.payment_method !== 'KHALTI') {
      return null;
    }
    try {
      const payInit = await paymentService.initiatePayment(order.id, order.payment_method);
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        method: payInit.method,
        amount: payInit.amount,
        transactionUuid: payInit.transaction_uuid,
        signature: payInit.signature,
        productCode: payInit.product_code,
      };
    } catch {
      return null;
    }
  }, []);

  const handleConfirmDirectPurchase = useCallback(
    async (messageId: string, preview: ChatOrderPreview) => {
      if (!user) {
        pendingAutoOrderRef.current = { messageId, preview };
        showToast(
          language === 'ne'
            ? 'अर्डर स्वचालित रूपमा पक्का गर्न कृपया साइन इन गर्नुहोस्।'
            : 'Sign in to automatically place your order to your location.',
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

        const res = await chatService.placeDirectChatOrder({
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
        const pendingPayment = await initiateInlinePaymentIfNeeded(order);

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
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not place direct order', 'error');
      } finally {
        setPlacingMessageId(null);
      }
    },
    [
      currentAddress,
      effectiveLocation,
      initiateInlinePaymentIfNeeded,
      language,
      setLoginModalOpen,
      showToast,
      user,
    ]
  );

  // Automatically complete any queued auto-order right after the user signs in
  useEffect(() => {
    if (user && pendingAutoOrderRef.current) {
      const queued = pendingAutoOrderRef.current;
      pendingAutoOrderRef.current = null;
      void handleConfirmDirectPurchase(queued.messageId, queued.preview);
    }
  }, [user, handleConfirmDirectPurchase]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
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
      const data = await chatService.sendChatMessage({
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

      const assistantMsgId = `msg-${Date.now() + 1}`;
      let pendingPayment: PendingGatewayPayment | null = null;
      if (data.placedOrder) {
        pendingPayment = await initiateInlinePaymentIfNeeded(data.placedOrder);
        showToast(
          language === 'ne'
            ? `अर्डर ${data.placedOrder.order_number} स्वचालित रूपमा राखियो!`
            : `Order ${data.placedOrder.order_number} automatically placed to ${assignedLocationLabel}!`,
          'success'
        );
      } else if (data.requiresAuthForAutoOrder && data.orderPreview && !user) {
        pendingAutoOrderRef.current = { messageId: assistantMsgId, preview: data.orderPreview };
        setLoginModalOpen(true);
      }

      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: data.reply || 'Here are the best seller offers for your delivery address:',
        groundingChunks: data.groundingChunks || [],
        recommendedOffers: data.recommendedOffers || [],
        orderPreview: data.placedOrder ? null : data.orderPreview || null,
        placedOrder: data.placedOrder || null,
        pendingPayment,
        paymentVerified: data.placedOrder ? data.placedOrder.payment_method === 'CASH_ON_DELIVERY' : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const message =
        err instanceof Error ? err.message : 'Could not reach the live store catalog right now. Please try again!';
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const liveVoice = useLiveVoice({
    language,
    location: effectiveLocation,
    onOffers: useCallback((offers: ChatProductOffer[]) => {
      if (offers.length === 0) return;
      setMessages((prev) => [
        ...prev,
        {
          id: `voice-offers-${Date.now()}`,
          role: 'assistant',
          content:
            language === 'ne'
              ? '🎙️ भ्वाइस खोजबाट फेला परेका उत्कृष्ट विकल्पहरू:'
              : '🎙️ Matched live seller options from your voice request:',
          recommendedOffers: offers,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, [language]),
    onOrderPreview: useCallback(
      (preview: ChatOrderPreview) => {
        const msgId = `voice-preview-${Date.now()}`;
        if (!user) {
          pendingAutoOrderRef.current = { messageId: msgId, preview };
        }
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: 'assistant',
            content:
              language === 'ne'
                ? '🎙️ भ्वाइस अर्डर विवरण तयार छ:'
                : '🎙️ Prepared direct order from your voice command:',
            orderPreview: preview,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      },
      [language, user]
    ),
    onPlacedOrder: useCallback(
      async (order: Order) => {
        const pendingPayment = await initiateInlinePaymentIfNeeded(order);
        setMessages((prev) => [
          ...prev,
          {
            id: `voice-order-${Date.now()}`,
            role: 'assistant',
            content:
              language === 'ne'
                ? `🎙️ ✅ भ्वाइस कमाण्डबाट अर्डर ${order.order_number} स्वचालित रूपमा राखियो!`
                : `🎙️ ✅ Voice order ${order.order_number} automatically placed to ${assignedLocationLabel}!`,
            placedOrder: order,
            pendingPayment,
            paymentVerified: order.payment_method === 'CASH_ON_DELIVERY',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        showToast(
          language === 'ne'
            ? `भ्वाइस अर्डर ${order.order_number} राखियो!`
            : `Voice order ${order.order_number} placed!`,
          'success'
        );
      },
      [assignedLocationLabel, initiateInlinePaymentIfNeeded, language, showToast]
    ),
    onCartUpdated: useCallback(() => {
      refreshCart().catch(() => {});
    }, [refreshCart]),
    onTurnTranscripts: useCallback((userText: string, assistantText: string) => {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const appended: ChatMessage[] = [];
      if (userText) {
        appended.push({
          id: `voice-u-${Date.now()}`,
          role: 'user',
          content: `🎙️ ${userText}`,
          timestamp: nowStr,
        });
      }
      if (assistantText) {
        appended.push({
          id: `voice-a-${Date.now() + 1}`,
          role: 'assistant',
          content: assistantText,
          timestamp: nowStr,
        });
      }
      if (appended.length > 0) {
        setMessages((prev) => [...prev, ...appended]);
      }
    }, []),
  });

  const handleClearHistory = () => {
    pendingAutoOrderRef.current = null;
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: t('chat.welcome'),
        timestamp: language === 'ne' ? 'अहिले' : 'Just now',
      },
    ]);
  };

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

  const handleVerifyInlinePayment = async (messageId: string, challenge: PendingGatewayPayment) => {
    setVerifyingMessageId(messageId);
    try {
      const res = await paymentService.verifyPayment({
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment verification failed', 'error');
    } finally {
      setVerifyingMessageId(null);
    }
  };

  return {
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
  };
}
