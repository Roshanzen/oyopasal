import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Order, Product, NotificationItem } from '../types';
import ProductCard from '../components/ProductCard';
import {
  User,
  Package,
  MapPin,
  Heart,
  Bell,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Plus,
  ArrowRight,
  Store,
  Database
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export default function AccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'profile';

  const {
    user,
    addresses,
    setLocationModalOpen,
    wishlistIds,
    addToCart,
    showToast
  } = useApp();

  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  // Edit profile form state
  const [fullName, setFullName] = useState(user?.full_name || 'Roshan Yadav');
  const [email, setEmail] = useState(user?.email || 'yadavroshan864@gmail.com');
  const [phone, setPhone] = useState(user?.phone || '+977 9841234567');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setPhone(user.phone);
    }
  }, [user]);

  // Load orders
  useEffect(() => {
    if (activeTab === 'orders') {
      async function loadOrders() {
        try {
          setLoadingOrders(true);
          const res = await api.getOrders();
          setOrders(res.results || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingOrders(false);
        }
      }
      loadOrders();
    }
  }, [activeTab]);

  // Load wishlist
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

  // Load notifications
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
      const token = await cred.user.getIdToken();
      const res = await fetch('/api/v1/auth/firebase-login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: token,
          full_name: cred.user.displayName,
          phone: cred.user.phoneNumber,
        })
      });
      const data = await res.json();
      if (data.success) {
        setFullName(data.user.full_name || cred.user.displayName || fullName);
        setEmail(data.user.email || cred.user.email || email);
        showToast('Successfully signed in with Google & synced to Cloud SQL!', 'success');
      } else {
        showToast('Connected with Google!', 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Google Sign-in cancelled', 'error');
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateUser({ full_name: fullName, email, phone });
      showToast('Profile updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8 pb-24">
      
      {/* Title */}
      <div className="pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
          My Account
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your personal profile, past deliveries, addresses, and wishlist
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-2">
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-3 shadow-2xs space-y-1">
            <button
              onClick={() => setTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Personal Profile</span>
            </button>

            <button
              onClick={() => setTab('orders')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Order History & Tracking</span>
            </button>

            <button
              onClick={() => setTab('addresses')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Saved Addresses</span>
            </button>

            <button
              onClick={() => setTab('wishlist')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                activeTab === 'wishlist'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className="w-4 h-4 shrink-0" />
              <span>My Wishlist</span>
            </button>

            <button
              onClick={() => setTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-colors text-left cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span>Notifications</span>
            </button>
          </div>

          <div className="p-4 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-sm text-emerald-950 dark:text-emerald-200 space-y-1">
            <span className="font-extrabold text-emerald-800 dark:text-emerald-300 block">OyoPasal VIP Club</span>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              You earn 1 Reward Point for every Rs. 10 spent. Free express shipping unlocked!
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl flex items-center justify-center font-display">
                  {fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                    {fullName}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    OyoPasal Member since 2024 · Kathmandu Valley
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Phone Number (for Courier Rider Contact)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={syncingGoogle}
                    className="px-5 py-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{syncingGoogle ? 'Signing in...' : 'Sign in with Google'}</span>
                  </button>
                </div>
              </form>

              {/* Cloud SQL Database Connection Card */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Cloud SQL (PostgreSQL)</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Region: asia-southeast1 • Drizzle ORM • Orders, Vendors & User DB Live
                    </p>
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

          {/* TAB 2: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">
                Past Deliveries & Active Orders
              </h2>

              {loadingOrders ? (
                <div className="space-y-3">
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
                </div>
              ) : orders.length > 0 ? (
                orders.map((o) => (
                  <div
                    key={o.id}
                    className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-slate-900 dark:text-white">
                            {o.order_number}
                          </span>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Placed {new Date(o.created_at).toLocaleDateString()} at{' '}
                          {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/orders/${o.id}`}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <span>Live Tracking</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Vendors & Items list */}
                    <div className="space-y-2 text-sm">
                      {o.items_by_vendor.map((vg, idx) => (
                        <div key={idx} className="flex items-start justify-between">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold">{vg.vendor.name}:</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-md">
                              {vg.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">
                        Total Amount Paid: <strong className="text-slate-900 dark:text-white font-bold">Rs. {o.total_amount}</strong> ({o.payment_method.replace(/_/g, ' ')})
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">
                        Delivered to: {o.delivery_address.title} ({o.delivery_address.area})
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
                  <Package className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No orders placed yet</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Your order history will appear here once you make your first order.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Addresses */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">
                  Saved Delivery Addresses
                </h2>
                <button
                  onClick={() => setLocationModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Address</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-4 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-slate-900 dark:text-white">
                        {addr.title}
                      </span>
                      {addr.is_default && (
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-md">
                          Default Address
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                      {addr.recipient_name} · {addr.phone}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {addr.street}, {addr.area}, {addr.city}
                    </p>
                    {addr.landmark && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Landmark: {addr.landmark}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Wishlist */}
          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">
                Saved Wishlist Items
              </h2>

              {loadingWishlist ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-pulse">
                  <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
                  <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
                </div>
              ) : wishlistProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {wishlistProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
                  <Heart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Your wishlist is empty</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500">Click the heart icon on any product to save it for later.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">
                Alerts & Updates
              </h2>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {n.title}
                    </h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{n.created_at}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {n.message}
                  </p>
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
