import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { chatService, paymentService } from '../services';
import { ChatOrderPreview, ChatProductOffer, Order } from '../types';

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

      const assistantMsg: ChatMessage = {
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
      let pendingPayment: PendingGatewayPayment | null = null;

      if (preview.payment_method === 'ESEWA' || preview.payment_method === 'KHALTI') {
        try {
          const payInit = await paymentService.initiatePayment(order.id, preview.payment_method);
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not place direct order', 'error');
    } finally {
      setPlacingMessageId(null);
    }
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
  };
}
