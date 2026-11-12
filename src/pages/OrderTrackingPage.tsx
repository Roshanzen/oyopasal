import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Order } from '../types';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  Phone,
  ShieldCheck,
  ArrowLeft,
  XCircle,
  Truck,
  RotateCcw
} from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      if (!id) return;
      try {
        setLoading(true);
        const res = await api.getOrderById(id);
        setOrder(res);
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [id]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const updated = await api.cancelOrder(order.id);
      setOrder(updated);
      setShowCancelModal(false);
      showToast('Order cancelled successfully', 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not cancel order';
      showToast(msg, 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse space-y-4">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Order Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
          The requested order ID could not be retrieved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/account?tab=orders"
            className="p-2 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-display">
                Order {order.order_number}
              </h1>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                  isDelivered
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                    : isCancelled
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300'
                }`}
              >
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Placed on {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {!isDelivered && !isCancelled && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            Cancel Order
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Live Tracking Timeline */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Estimated Arrival Banner */}
          {!isDelivered && !isCancelled ? (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-bold uppercase tracking-wider mb-1">
                  <Clock className="w-4 h-4" />
                  <span>Estimated Delivery</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-display">
                  Arriving in 10-12 Mins
                </h2>
                <p className="text-xs text-emerald-100 mt-1">
                  Your delivery partner is on the way with your order.
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Truck className="w-7 h-7 text-emerald-200" />
              </div>
            </div>
          ) : isDelivered ? (
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Completed</span>
                </div>
                <h2 className="text-2xl font-extrabold font-display text-emerald-900 dark:text-white">
                  Delivered Successfully!
                </h2>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Thank you for shopping with OyoPasal. Enjoy your fresh groceries!
                </p>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200">
              <h2 className="text-xl font-extrabold text-rose-900 dark:text-rose-200">
                Order Cancelled
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                This order was cancelled. Any pre-authorized charges will be refunded.
              </p>
            </div>
          )}

          {/* Interactive Google Map Live Route Tracking */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Live Courier Dispatch Route (Google Maps)</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                Fast EV Delivery Partner
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full relative">
              <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                <Map
                  defaultCenter={{ lat: 27.6960, lng: 85.3280 }}
                  defaultZoom={14}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                  gestureHandling="cooperative"
                >
                  {/* Fulfillment Hub / Vendor Marker */}
                  <AdvancedMarker
                    position={{ lat: 27.6915, lng: 85.3420 }}
                    title="Neighborhood Fulfilment Hub"
                  >
                    <Pin background="#059669" borderColor="#064e3b" glyphColor="#ffffff" scale={1.1} />
                  </AdvancedMarker>

                  {/* Courier Rider Marker */}
                  <AdvancedMarker
                    position={{ lat: 27.6970, lng: 85.3310 }}
                    title="OyoPasal Express Courier Rider"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white animate-bounce">
                      <Truck className="w-4 h-4 text-white" />
                    </div>
                  </AdvancedMarker>

                  {/* Customer Delivery Address Marker */}
                  <AdvancedMarker
                    position={{ lat: 27.6995, lng: 85.3220 }}
                    title="Delivery Destination"
                  >
                    <Pin background="#ea580c" borderColor="#9a3412" glyphColor="#ffffff" scale={1.2} />
                  </AdvancedMarker>
                </Map>
              </APIProvider>

              {/* Floating Route Pill */}
              <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-md flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Baneshwor Hub ➔ {order.delivery_address?.area || 'Kathmandu'}</span>
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide mb-5">
              Live Delivery Milestones
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {order.tracking_updates.map((step, idx) => (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                      step.done
                        ? 'bg-emerald-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-3" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {step.title}
                      </h4>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {step.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Partner Details */}
          {!isCancelled && (
            <div className="p-4 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs flex items-center justify-center">
                  RP
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Ramesh Pandey (EV Courier Rider)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    OyoPasal Express Hero · 4.9★ (1,240+ deliveries)
                  </p>
                </div>
              </div>

              <button
                onClick={() => showToast('Connecting to rider...', 'info')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Call Rider</span>
              </button>
            </div>
          )}

        </div>

        {/* Right Col: Order Receipt & Delivery Address */}
        <div className="space-y-6">
          
          {/* Destination */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-2">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wide">
              Delivery Destination
            </h3>
            <div className="flex items-start gap-2.5 pt-1">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {order.delivery_address.title} ({order.delivery_address.recipient_name})
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  {order.delivery_address.street}, {order.delivery_address.area}
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-[11px]">
                  Phone: {order.delivery_address.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Receipt */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-100 dark:border-slate-800">
              Order Receipt
            </h3>

            {order.items_by_vendor.map((vendorGroup, idx) => (
              <div key={idx} className="space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{vendorGroup.vendor.name}</span>
                </div>
                {vendorGroup.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-slate-600 dark:text-slate-400 pl-5">
                    <span className="truncate max-w-[180px]">
                      {item.quantity}x {item.product_name}
                    </span>
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                      Rs. {item.total}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">Rs. {order.subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Delivery Charge</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">
                  {order.delivery_fee === 0 ? 'FREE' : `Rs. ${order.delivery_fee}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Handling Fee</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">Rs. {order.handling_fee}</span>
              </div>
              {order.coupon_discount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Coupon Discount</span>
                  <span className="tabular-nums">- Rs. {order.coupon_discount}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-extrabold text-sm text-slate-900 dark:text-white">
                <span>Total Paid</span>
                <span className="text-base text-emerald-700 dark:text-emerald-400 tabular-nums">
                  Rs. {order.total_amount}
                </span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Payment: <strong className="text-slate-800 dark:text-slate-200">{order.payment_method.replace(/_/g, ' ')}</strong> ({order.payment_status})
            </div>
          </div>

        </div>

      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowCancelModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
          />
          <div className="relative bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full z-10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cancel this Order?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to cancel order {order.order_number}? Local sellers have already prepared your items.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
