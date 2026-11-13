import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { translateOrderStatus } from '../../shared/i18n/translations';
import { api } from '../../shared/services/api';
import { Order, Product, NotificationItem, SupportTicket } from '../../shared/types';
import ProductCard from '../components/ProductCard';
import {
  User,
  Package,
  MapPin,
  Heart,
  Bell,
  Plus,
  ArrowRight,
  Store,
  Database,
  LogIn,
  LogOut,
  RotateCcw,
  LifeBuoy,
  Send,
  AlertCircle
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../../shared/lib/firebase.ts';

export default function AccountPage() {
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
    language
  } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Refund modal
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Support ticket create/reply
  const [ticketCategory, setTicketCategory] = useState('order_issue');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

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
      const res = await api.getOrders();
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
      const res = await api.getSupportTickets();
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
          const res = await api.getWishlist();
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
          const res = await api.getNotifications();
          setNotifications(res.results || []);
        } catch (err) {
          console.error(err);
        }
      }
      loadNotifs();
    }
  }, [activeTab]);

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ status?: string; counts?: any } | null>(null);

  useEffect(() => {
    fetch('/api/v1/db/status/')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(() => {});
  }, []);

  const handleGoogleSignIn = async () => {
    setSyncingGoogle(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const data = await api.firebaseLogin({
        id_token: idToken,
        full_name: cred.user.displayName || undefined,
        phone: cred.user.phoneNumber || undefined
      });
      if (data.success && data.user) {
        if (data.token) api.setToken(data.token);
        setUserDirect(data.user);
        showToast(
          language === 'ne' ? 'Google मार्फत सफलतापूर्वक लगइन भयो!' : 'Successfully signed in with Google!',
          'success'
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Google Sign-in cancelled', 'error');
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
      const updated = await api.updateUser({ full_name: fullName, email, phone });
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
      const res = await api.reorderOrder(orderId);
      await refreshCart();
      setCartDrawerOpen(true);
      showToast(
        language === 'ne'
          ? `${res.added_count} सामान टोकरीमा थपियो!`
          : `Added ${res.added_count} items back into your basket!`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not reorder items', 'error');
    } finally {
      setReorderingId(null);
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundOrder || !refundReason.trim()) return;
    setSubmittingRefund(true);
    try {
      await api.requestRefund(refundOrder.id, refundReason.trim());
      showToast('Refund request submitted to OyoPasal support team.', 'success');
      setRefundOrder(null);
      setRefundReason('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit refund request', 'error');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleMarkNotifRead = async (n: NotificationItem) => {
    try {
      if (!n.read) {
        await api.markNotificationRead(n.id);
        setNotifications(prev => prev.map(item => (item.id === n.id ? { ...item, read: true } : item)));
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
      await api.createSupportTicket({
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim()
      });
      setTicketSubject('');
      setTicketMessage('');
      showToast('Support ticket created.', 'success');
      await loadTickets();
    } catch (err: any) {
      showToast(err?.message || 'Could not create support ticket', 'error');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleReplyTicket = async (ticketId: number) => {
    const msg = (replyDrafts[ticketId] || '').trim();
    if (!msg) return;
    try {
      await api.replySupportTicket(ticketId, msg);
      setReplyDrafts(prev => ({ ...prev, [ticketId]: '' }));
      await loadTickets();
    } catch (err: any) {
      showToast(err?.message || 'Reply failed', 'error');
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8 pb-24">
      <div className="pb-6 mb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">{t('account.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('account.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2.5">
          {!user ? (
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{t('header.login')} / {t('header.signIn')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={logoutCustomer}
              className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60 font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('header.signOut')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-2">
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-3 shadow-2xs space-y-1">
            {[
              { id: 'profile', icon: User, label: t('account.tabProfile') },
              { id: 'orders', icon: Package, label: t('account.tabOrders') },
              { id: 'addresses', icon: MapPin, label: t('account.tabAddresses') },
              { id: 'wishlist', icon: Heart, label: t('account.tabWishlist') },
              { id: 'notifications', icon: Bell, label: t('account.tabNotifications') },
              { id: 'support', icon: LifeBuoy, label: language === 'ne' ? 'ग्राहक सहायता' : 'Support & Help' }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                    activeTab === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-3">
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-6">
              {!user && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">{t('account.guestBannerTitle')}</h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">{t('account.guestBannerSub')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoginModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    {t('header.signIn')}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl flex items-center justify-center font-display">
                  {(fullName || 'G').charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                    {user ? fullName : t('header.guestUser')}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {user?.role ? `Role: ${user.role.toUpperCase()}` : t('account.memberSince')}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.fullName')}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.emailAddress')}</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.phoneNumber')}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
                  >
                    {savingProfile ? t('account.saving') : t('account.saveProfile')}
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={syncingGoogle}
                    className="px-5 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-300 dark:border-slate-700 cursor-pointer"
                  >
                    <span>{syncingGoogle ? t('account.signingIn') : t('account.googleSignIn')}</span>
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t('account.dbTitle')}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('account.dbSub')}</p>
                  </div>
                </div>
                {dbStatus?.counts && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      <strong>{dbStatus.counts.products}</strong> Products
                    </span>
                    <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      <strong>{dbStatus.counts.vendors}</strong> Vendors
                    </span>
                    <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      <strong>{dbStatus.counts.orders}</strong> Orders
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.pastOrdersTitle')}</h2>
              {!user ? (
                <div className="p-8 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center space-y-3">
                  <p className="text-sm text-slate-500">Please sign in to inspect your order history.</p>
                  <button onClick={() => setLoginModalOpen(true)} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm cursor-pointer">
                    {t('header.signIn')}
                  </button>
                </div>
              ) : loadingOrders ? (
                <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
              ) : orders.length > 0 ? (
                orders.map((o) => (
                  <div key={o.id} className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-slate-900 dark:text-white">{o.order_number}</span>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                            {translateOrderStatus(o.status, language)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t('account.placedAt', {
                            date: new Date(o.created_at).toLocaleDateString(),
                            time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleReorder(o.id)}
                          disabled={reorderingId === o.id}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{language === 'ne' ? 'फेरि अर्डर' : 'Reorder'}</span>
                        </button>
                        {o.status !== 'CANCELLED' && (
                          <button
                            onClick={() => setRefundOrder(o)}
                            className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold cursor-pointer"
                          >
                            {language === 'ne' ? 'फिर्ता अनुरोध' : 'Request Refund'}
                          </button>
                        )}
                        <Link
                          to={`/orders/${o.id}`}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5"
                        >
                          <span>{t('account.liveTracking')}</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {o.items_by_vendor.map((vg, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold">{vg.vendor.name}:</span>
                          <span className="text-slate-500 dark:text-slate-400 truncate">
                            {vg.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500">
                        {t('account.totalPaid')} <strong className="text-slate-900 dark:text-white font-bold">{formatPrice(o.total_amount)}</strong> ({o.payment_method.replace(/_/g, ' ')} · {o.payment_status})
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('account.noOrdersTitle')}</h3>
                  <p className="text-sm text-slate-400">{t('account.noOrdersSub')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.savedAddressesTitle')}</h2>
                <button
                  onClick={() => setLocationModalOpen(true)}
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
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{addr.recipient_name} · {addr.phone}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{addr.street}, {addr.area}, {addr.city}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.savedWishlistTitle')}</h2>
              {loadingWishlist ? (
                <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
              ) : wishlistProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {wishlistProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              ) : (
                <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('account.emptyWishlistTitle')}</h3>
                  <p className="text-sm text-slate-400">{t('account.emptyWishlistSub')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
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
                    onClick={() => handleMarkNotifRead(n)}
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
          )}

          {activeTab === 'support' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {language === 'ne' ? 'नयाँ सहायता टिकट खोल्नुहोस्' : 'Open Support Ticket'}
                </h2>
                <form onSubmit={handleCreateTicket} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={ticketCategory}
                      onChange={e => setTicketCategory(e.target.value)}
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
                      onChange={e => setTicketSubject(e.target.value)}
                      placeholder="Subject (e.g. Missing item in delivery)"
                      className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={ticketMessage}
                    onChange={e => setTicketMessage(e.target.value)}
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
                {tickets.map(ticket => (
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
                      {ticket.messages.map(m => (
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
                        onChange={e => setReplyDrafts(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleReplyTicket(ticket.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Reply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Refund Request Modal */}
      {refundOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setRefundOrder(null)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" />
          <form onSubmit={handleSubmitRefund} className="relative bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full z-10 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Request Refund · {refundOrder.order_number}
              </h3>
            </div>
            <p className="text-sm text-slate-500">Order Total: {formatPrice(refundOrder.total_amount)}</p>
            <textarea
              rows={3}
              required
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              placeholder="Explain why you are requesting a refund..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRefundOrder(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRefund}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold cursor-pointer"
              >
                {submittingRefund ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
