import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import {
  Bike,
  Navigation,
  MapPin,
  CheckCircle2,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Sparkles,
  Crosshair
} from 'lucide-react';

const KATHMANDU_WAYPOINTS = [
  { label: 'New Baneshwor Hub', lat: 27.6915, lng: 85.3420 },
  { label: 'Thapathali Bridge', lat: 27.6890, lng: 85.3175 },
  { label: 'Pulchowk Chowk', lat: 27.6740, lng: 85.3180 },
  { label: 'New Baneshwor Dropoff', lat: 27.6986, lng: 85.3292 }
];

export default function RiderPortalPage() {
  const { user, loginCustomer, logoutCustomer, showToast, formatPrice } = useApp();

  const [identifier, setIdentifier] = useState('rider.ramesh@oyopasal.np');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [profile, setProfile] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<Record<number, { lat: string; lng: string; speed: string; eta: string }>>({});

  const isRider = user?.role === 'delivery_agent' || user?.role === 'admin';

  const loadRiderWorkspace = useCallback(async () => {
    if (!isRider) return;
    setLoading(true);
    try {
      const [prof, assignRes] = await Promise.all([
        api.getDeliveryProfile().catch(() => null),
        api.getDeliveryAssignments()
      ]);
      if (prof) setProfile(prof);
      setAssignments(assignRes.results || []);
    } catch (err: any) {
      showToast(err?.message || 'Could not load rider workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [isRider, showToast]);

  useEffect(() => {
    loadRiderWorkspace();
  }, [loadRiderWorkspace]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await loginCustomer({ phone_or_email: identifier.trim(), password });
    } catch {
      // handled
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickRiderDemo = async () => {
    setAuthLoading(true);
    try {
      await loginCustomer({ phone_or_email: 'rider.ramesh@oyopasal.np', demo_quick_login: true });
    } catch {
      // handled
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePushCoords = async (assignmentId: number, lat: number, lng: number, speed = 26, eta = 5, note?: string) => {
    try {
      await api.pushDeliveryLocation(assignmentId, {
        lat,
        lng,
        speed_kmh: speed,
        eta_minutes: eta,
        status_note: note || 'Live GPS Telemetry Update'
      });
      showToast(`Pushed live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`, 'success');
      await loadRiderWorkspace();
    } catch (err: any) {
      showToast(err?.message || 'Failed to push GPS ping', 'error');
    }
  };

  const handleUseBrowserGps = (assignmentId: number) => {
    if (!navigator.geolocation) {
      showToast('Browser geolocation unavailable; use a waypoint preset below.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        handlePushCoords(assignmentId, pos.coords.latitude, pos.coords.longitude, 24, 5, 'Device Geolocation Ping');
      },
      () => {
        showToast('Geolocation permission denied. Select a waypoint below.', 'error');
      }
    );
  };

  if (!isRider) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-10 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Storefront</span>
            </Link>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
              EV Courier Fleet App
            </span>
          </div>

          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-sky-600/20 text-sky-400 flex items-center justify-center mx-auto border border-sky-500/30">
                <Bike className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-white">OyoPasal Delivery Rider App</h1>
              <p className="text-sm text-slate-400">Accept dispatches, emit live GPS coordinates, and confirm doorstep deliveries.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Rider Email</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm cursor-pointer"
              >
                {authLoading ? 'Signing in...' : 'Sign In to Rider Console'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={authLoading}
                onClick={handleQuickRiderDemo}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Quick Seeded Rider Access (Ramesh Pandey)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-10 pb-24">
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              {profile?.full_name || user?.full_name} · Rider Console
            </h1>
            <p className="text-xs text-slate-400">
              {profile ? `${profile.vehicle_type} · ${profile.vehicle_number} · Deliveries: ${profile.total_deliveries}` : 'Admin Fleet View'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {profile && (
            <select
              value={profile.availability_status}
              onChange={async e => {
                const next = e.target.value as 'offline' | 'available' | 'busy';
                await api.updateDeliveryAvailability(next);
                setProfile((p: any) => ({ ...p, availability_status: next }));
                showToast(`Availability set to ${next.toUpperCase()}`, 'info');
              }}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-emerald-400"
            >
              <option value="available">AVAILABLE</option>
              <option value="busy">BUSY</option>
              <option value="offline">OFFLINE</option>
            </select>
          )}
          <button
            onClick={loadRiderWorkspace}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={logoutCustomer}
            className="px-3.5 py-2 rounded-xl bg-rose-950/60 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <MapPin className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="font-bold text-lg text-white">No Active Delivery Assignments</h3>
          <p className="text-sm text-slate-400">When the Admin Console assigns an order to you, it will appear here for pickup and GPS broadcast.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {assignments.map(a => {
            const draft = gpsCoords[a.id] || {
              lat: String(a.current_lat || a.pickup_lat || 27.6915),
              lng: String(a.current_lng || a.pickup_lng || 85.3420),
              speed: String(a.speed_kmh || 26),
              eta: String(a.eta_minutes || 6)
            };
            return (
              <div key={a.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-lg text-white">{a.order_number}</span>
                      <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                        {a.status}
                      </span>
                      <span className="text-xs text-emerald-400 font-mono">{formatPrice(a.total_amount)} ({a.payment_method})</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Pickup: <strong>{a.vendor_name}</strong> → Dropoff: <strong>{a.recipient_name}</strong> ({a.delivery_address}) · {a.recipient_phone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {a.status === 'assigned' && (
                      <button
                        onClick={async () => {
                          await api.updateDeliveryStatus(a.id, 'accepted');
                          showToast('Assignment accepted', 'success');
                          loadRiderWorkspace();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Accept
                      </button>
                    )}
                    {['assigned', 'accepted'].includes(a.status) && (
                      <button
                        onClick={async () => {
                          await api.updateDeliveryStatus(a.id, 'picked_up');
                          showToast('Marked Picked Up & Out for Delivery', 'success');
                          loadRiderWorkspace();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Pick Up
                      </button>
                    )}
                    {['picked_up', 'in_transit'].includes(a.status) && (
                      <button
                        onClick={async () => {
                          await api.updateDeliveryStatus(a.id, 'delivered', 'Handed over at doorstep');
                          showToast('Order Delivered! Commission ledger settled.', 'success');
                          loadRiderWorkspace();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Delivered</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live GPS Broadcaster */}
                {a.status !== 'delivered' && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5" />
                        Live GPS Telemetry Broadcaster
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUseBrowserGps(a.id)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>Use Device GPS</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {KATHMANDU_WAYPOINTS.map(wp => (
                        <button
                          key={wp.label}
                          type="button"
                          onClick={() => handlePushCoords(a.id, wp.lat, wp.lng, 28, 4, `Passing ${wp.label}`)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 cursor-pointer"
                        >
                          📍 {wp.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={draft.lat}
                        onChange={e => setGpsCoords(p => ({ ...p, [a.id]: { ...draft, lat: e.target.value } }))}
                        placeholder="Lat"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                      <input
                        type="text"
                        value={draft.lng}
                        onChange={e => setGpsCoords(p => ({ ...p, [a.id]: { ...draft, lng: e.target.value } }))}
                        placeholder="Lng"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                      <input
                        type="number"
                        value={draft.speed}
                        onChange={e => setGpsCoords(p => ({ ...p, [a.id]: { ...draft, speed: e.target.value } }))}
                        placeholder="km/h"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                      <input
                        type="number"
                        value={draft.eta}
                        onChange={e => setGpsCoords(p => ({ ...p, [a.id]: { ...draft, eta: e.target.value } }))}
                        placeholder="ETA min"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handlePushCoords(a.id, Number(draft.lat), Number(draft.lng), Number(draft.speed), Number(draft.eta))}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Push Ping
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
