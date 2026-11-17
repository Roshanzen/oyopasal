import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { useApp } from '../context';
import {
  authService,
  httpClient,
  notificationService,
  orderService,
  productService,
  supportService,
  wishlistService,
} from '../services';
import { DbStatusResponse, NotificationItem, Order, Product, SupportTicket } from '../types';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export function useAccountPortal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'profile';

  const {
    user,
    setUserDirect,
    setLoginModalOpen,
    logoutCustomer,
    addresses,
    setLocationModalOpen,
    wishlistIds,
    refreshCart,
    setCartDrawerOpen,
    showToast,
    t,
    formatPrice,
    language,
  } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const [ticketCategory, setTicketCategory] = useState('order_issue');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatusResponse | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setPhone(user.phone);
    }
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingOrders(true);
      const res = await orderService.getOrders();
      setOrders(res.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  }, [user]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    try {
      const res = await supportService.getSupportTickets();
      setTickets(res.results || []);
    } catch (err) {
      console.error(err);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
  }, [activeTab, loadOrders]);

  useEffect(() => {
    if (activeTab === 'support') loadTickets();
  }, [activeTab, loadTickets]);

  useEffect(() => {
    if (activeTab === 'wishlist') {
      async function loadWishlist() {
        try {
          setLoadingWishlist(true);
          const res = await wishlistService.getWishlist();
          setWishlistProducts(res.results || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingWishlist(false);
        }
      }
      loadWishlist();
    }
  }, [activeTab, wishlistIds]);

  useEffect(() => {
    if (activeTab === 'notifications') {
      async function loadNotifs() {
        try {
          const res = await notificationService.getNotifications();
          setNotifications(res.results || []);
        } catch (err) {
          console.error(err);
        }
      }
      loadNotifs();
    }
  }, [activeTab]);

  useEffect(() => {
    productService
      .getDbStatus()
      .then((data) => setDbStatus(data))
      .catch(() => {});
  }, []);

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const handleGoogleSignIn = async () => {
    setSyncingGoogle(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const data = await authService.firebaseLogin({
        id_token: idToken,
        full_name: cred.user.displayName || undefined,
        phone: cred.user.phoneNumber || undefined,
      });
      if (data.success && data.user) {
        if (data.token) httpClient.setToken(data.token);
        setUserDirect(data.user);
        showToast(
          language === 'ne' ? 'Google मार्फत सफलतापूर्वक लगइन भयो!' : 'Successfully signed in with Google!',
          'success'
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google Sign-in cancelled', 'error');
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authService.updateUser({ full_name: fullName, email, phone });
      if (updated) setUserDirect(updated);
      showToast(language === 'ne' ? 'प्रोफाइल अपडेट भयो' : 'Profile updated successfully', 'success');
    } catch {
      showToast(language === 'ne' ? 'प्रोफाइल अपडेट गर्न सकिएन' : 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleReorder = async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const res = await orderService.reorderOrder(orderId);
      await refreshCart();
      setCartDrawerOpen(true);
      showToast(
        language === 'ne'
          ? `${res.added_count} सामान टोकरीमा थपियो!`
          : `Added ${res.added_count} items back into your basket!`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not reorder items', 'error');
    } finally {
      setReorderingId(null);
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrder || !refundReason.trim()) return;
    setSubmittingRefund(true);
    try {
      await orderService.requestRefund(refundOrder.id, refundReason.trim());
      showToast('Refund request submitted to OyoPasal support team.', 'success');
      setRefundOrder(null);
      setRefundReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit refund request', 'error');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleMarkNotifRead = async (n: NotificationItem) => {
    try {
      if (!n.read) {
        await notificationService.markNotificationRead(n.id);
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)));
      }
      if (n.reference_url) navigate(n.reference_url);
    } catch {
      // ignore
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    setCreatingTicket(true);
    try {
      await supportService.createSupportTicket({
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      setTicketSubject('');
      setTicketMessage('');
      showToast('Support ticket created.', 'success');
      await loadTickets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create support ticket', 'error');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleReplyTicket = async (ticketId: number) => {
    const msg = (replyDrafts[ticketId] || '').trim();
    if (!msg) return;
    try {
      await supportService.replySupportTicket(ticketId, msg);
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      await loadTickets();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reply failed', 'error');
    }
  };

  return {
    activeTab,
    setTab,
    user,
    setLoginModalOpen,
    logoutCustomer,
    addresses,
    setLocationModalOpen,
    t,
    formatPrice,
    language,
    orders,
    wishlistProducts,
    notifications,
    tickets,
    loadingOrders,
    loadingWishlist,
    reorderingId,
    refundOrder,
    setRefundOrder,
    refundReason,
    setRefundReason,
    submittingRefund,
    ticketCategory,
    setTicketCategory,
    ticketSubject,
    setTicketSubject,
    ticketMessage,
    setTicketMessage,
    creatingTicket,
    replyDrafts,
    setReplyDrafts,
    fullName,
    setFullName,
    email,
    phone,
    setPhone,
    savingProfile,
    syncingGoogle,
    dbStatus,
    handleGoogleSignIn,
    handleSaveProfile,
    handleReorder,
    handleSubmitRefund,
    handleMarkNotifRead,
    handleCreateTicket,
    handleReplyTicket,
  };
}
