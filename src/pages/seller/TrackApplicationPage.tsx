import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Mail,
  Search,
  ShieldCheck,
  Store,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { sellerOnboardingService, TrackApplicationResponse } from '../../services/sellerOnboardingService';
import { useApp } from '../../context';

export default function TrackApplicationPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useApp();

  const [applicationNumber, setApplicationNumber] = useState(searchParams.get('app') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackApplicationResponse | null>(null);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!applicationNumber.trim() || !email.trim()) {
      setError('Please provide both your application reference number and registered email.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await sellerOnboardingService.trackApplication(applicationNumber.trim(), email.trim().toLowerCase());
      setResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No application matching these details was found.';
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('app') && searchParams.get('email')) {
      handleTrack();
    }
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Pending Review',
          className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          icon: Clock,
          description: 'Your application has been received and is queued for administrative review.',
        };
      case 'UNDER_REVIEW':
        return {
          label: 'Under Active Review',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          icon: Search,
          description: 'OyoPasal operations administrators are currently verifying your store and business documentation.',
        };
      case 'APPROVED':
        return {
          label: 'Application Approved',
          className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: CheckCircle2,
          description: 'Congratulations! Your application has been approved. Account activation is being processed.',
        };
      case 'INVITATION_SENT':
        return {
          label: 'Invitation Sent',
          className: 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300 dark:border-purple-800',
          icon: Mail,
          description: 'A secure, single-use activation invitation has been sent to your email. Check your inbox to create your password.',
        };
      case 'ACTIVE':
        return {
          label: 'Store Active & Verified',
          className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          icon: ShieldCheck,
          description: 'Your merchant account is active! You can log in directly to the Vendor Portal.',
        };
      case 'REJECTED':
        return {
          label: 'Application Rejected',
          className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800',
          icon: AlertCircle,
          description: 'Your application could not be approved based on our verification criteria.',
        };
      case 'SUSPENDED':
        return {
          label: 'Account Suspended',
          className: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-400 dark:border-slate-700',
          icon: AlertTriangle,
          description: 'This vendor account has been temporarily suspended by platform administration.',
        };
      default:
        return {
          label: status,
          className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          icon: Clock,
          description: 'Current status of your seller application.',
        };
    }
  };

  return (
    <div className="min-h-[85vh] w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Storefront</span>
          </Link>
          <Link
            to="/become-seller"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <span>New application? Apply here</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/20">
            <Search className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Track Seller Application
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Check the real-time review status of your OyoPasal partner store application.
          </p>
        </div>

        {/* Tracking Input Card */}
        <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <form onSubmit={handleTrack} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Application Reference Number
                </label>
                <input
                  type="text"
                  required
                  value={applicationNumber ?? ''}
                  onChange={(e) => setApplicationNumber(e.target.value)}
                  placeholder="e.g. APP-2026-AB12CD"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={email ?? ''}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ramesh@gmail.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Check Application Status</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Results Card */}
        {result && (
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
            {/* Status Header */}
            {(() => {
              const badge = getStatusBadge(result.status);
              const IconComponent = badge.icon;
              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {result.business_name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Category: {result.business_category} · Ref: <span className="font-mono">{result.application_number}</span>
                      </p>
                    </div>

                    <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${badge.className}`}>
                      <IconComponent className="w-4 h-4" />
                      <span>{badge.label}</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              );
            })()}

            {/* Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Submitted On</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {new Date(result.submitted_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Last Administrative Action</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {result.reviewed_at
                    ? new Date(result.reviewed_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Awaiting Administrator'}
                </span>
              </div>
            </div>

            {/* Additional Info Requested Notice */}
            {result.additional_info_requested && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Action Required: Additional Information Requested</span>
                </div>
                <p className="leading-relaxed">{result.additional_info_requested}</p>
              </div>
            )}

            {/* Rejection Reason Notice */}
            {result.status === 'REJECTED' && result.rejection_reason && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Rejection Reason</span>
                </div>
                <p className="leading-relaxed">{result.rejection_reason}</p>
                <p className="text-slate-500 dark:text-slate-400 pt-1">
                  For appeals or questions, contact merchant support at <span className="font-semibold">sellers@oyopasal.com</span>.
                </p>
              </div>
            )}

            {/* Activation CTA if invitation sent */}
            {result.status === 'INVITATION_SENT' && (
              <div className="p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Ready to Activate Your Store</span>
                </div>
                <p className="text-xs text-purple-800 dark:text-purple-300 leading-relaxed">
                  Please click the link in your invitation email to set your password, or enter your token below.
                </p>
                <Link
                  to="/vendor/activate"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <span>Go to Account Activation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Active Store Login CTA */}
            {result.status === 'ACTIVE' && (
              <Link
                to="/seller"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>Go to Vendor Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
