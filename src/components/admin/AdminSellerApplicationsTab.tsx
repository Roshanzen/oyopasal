import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  HelpCircle,
  History,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  X,
} from 'lucide-react';
import {
  sellerOnboardingService,
  SellerApplicationItem,
  SellerApplicationSummary,
} from '../../services/sellerOnboardingService';
import { useApp } from '../../context';

export default function AdminSellerApplicationsTab() {
  const { showToast } = useApp();

  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<SellerApplicationItem[]>([]);
  const [summary, setSummary] = useState<SellerApplicationSummary>({
    total: 0,
    pending: 0,
    under_review: 0,
    approved: 0,
    invitation_sent: 0,
    active: 0,
    rejected: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected for Review Modal
  const [selectedApp, setSelectedApp] = useState<SellerApplicationItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action Modals State
  const [actionLoading, setActionLoading] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false);
  const [additionalInfoText, setAdditionalInfoText] = useState('');

  const loadApplications = async () => {
    setLoading(true);
    try {
      const res = await sellerOnboardingService.getAdminApplications({
        status: statusFilter,
        search: searchQuery.trim(),
        page,
      });

      if (res.results) {
        setApplications(res.results.applications || []);
        if (res.results.summary) {
          setSummary(res.results.summary);
        }
      }
      setTotalCount(res.count || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load seller applications';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadApplications();
  };

  const handleOpenDetail = async (app: SellerApplicationItem) => {
    setSelectedApp(app);
    setDetailLoading(true);
    try {
      const res = await sellerOnboardingService.getAdminApplicationDetail(app.id);
      if (res.application) {
        setSelectedApp(res.application);
      }
    } catch (err) {
      console.error('Failed to load application details', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleMoveUnderReview = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      await sellerOnboardingService.updateApplicationStatus(selectedApp.id, {
        status: 'UNDER_REVIEW',
        notes: internalNote.trim() || 'Application moved to Under Review for KYC verification.',
      });
      showToast(`Application ${selectedApp.application_number} moved to Under Review.`, 'success');
      setInternalNote('');
      await handleOpenDetail(selectedApp);
      await loadApplications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const frontendOrigin = window.location.origin;
      const res = await sellerOnboardingService.approveApplication(selectedApp.id, frontendOrigin);
      showToast(res.message, 'success');
      await handleOpenDetail(selectedApp);
      await loadApplications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve application';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp || !rejectionReason.trim()) {
      showToast('A rejection reason is required.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await sellerOnboardingService.rejectApplication(selectedApp.id, rejectionReason.trim(), internalNote.trim());
      showToast(`Application ${selectedApp.application_number} has been rejected.`, 'success');
      setRejectionModalOpen(false);
      setRejectionReason('');
      setInternalNote('');
      await handleOpenDetail(selectedApp);
      await loadApplications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject application';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!selectedApp || !additionalInfoText.trim()) {
      showToast('Please specify the additional information required.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await sellerOnboardingService.updateApplicationStatus(selectedApp.id, {
        additional_info: additionalInfoText.trim(),
        notes: internalNote.trim() || 'Additional verification information requested from applicant.',
      });
      showToast('Additional information request sent to applicant.', 'success');
      setRequestInfoModalOpen(false);
      setAdditionalInfoText('');
      setInternalNote('');
      await handleOpenDetail(selectedApp);
      await loadApplications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request info';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendInvitation = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const frontendOrigin = window.location.origin;
      const res = await sellerOnboardingService.resendInvitation(selectedApp.id, frontendOrigin);
      showToast(res.message, 'success');
      await handleOpenDetail(selectedApp);
      await loadApplications();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend invitation';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedApp || !internalNote.trim()) return;
    setActionLoading(true);
    try {
      await sellerOnboardingService.updateApplicationStatus(selectedApp.id, {
        notes: internalNote.trim(),
      });
      showToast('Internal note saved.', 'success');
      setInternalNote('');
      await handleOpenDetail(selectedApp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save note';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'UNDER_REVIEW':
        return 'bg-blue-950/80 text-blue-300 border-blue-800';
      case 'APPROVED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'INVITATION_SENT':
        return 'bg-purple-950/80 text-purple-300 border-purple-800';
      case 'ACTIVE':
        return 'bg-teal-950/80 text-teal-300 border-teal-800';
      case 'REJECTED':
        return 'bg-rose-950/80 text-rose-300 border-rose-800';
      case 'SUSPENDED':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const safeApplications = Array.isArray(applications) ? applications : [];

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-slate-400 block mb-1">Total Apps</span>
          <span className="text-2xl font-black text-white">{summary.total}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-amber-400 block mb-1">Pending</span>
          <span className="text-2xl font-black text-amber-400">{summary.pending}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-blue-400 block mb-1">Under Review</span>
          <span className="text-2xl font-black text-blue-400">{summary.under_review}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-emerald-400 block mb-1">Approved</span>
          <span className="text-2xl font-black text-emerald-400">{summary.approved}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-purple-400 block mb-1">Invited</span>
          <span className="text-2xl font-black text-purple-400">{summary.invitation_sent}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-teal-400 block mb-1">Active Vendors</span>
          <span className="text-2xl font-black text-teal-400">{summary.active}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
          <span className="text-xs font-bold text-rose-400 block mb-1">Rejected</span>
          <span className="text-2xl font-black text-rose-400">{summary.rejected}</span>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, store, applicant, email, phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="INVITATION_SENT">Invitation Sent</option>
            <option value="ACTIVE">Active Vendors</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <button
            type="button"
            onClick={loadApplications}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Applications Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {loading && safeApplications.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading seller applications from database...</p>
          </div>
        ) : safeApplications.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Store className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No seller applications found</p>
            <p className="text-xs text-slate-500">Applications submitted through the public portal will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Store Name</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {safeApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      {app.application_number}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white max-w-[180px] truncate">
                      {app.business_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200">
                      {app.full_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      <div>{app.phone}</div>
                      <div className="text-[11px] text-slate-500">{app.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {app.business_category}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {app.district}, {app.province?.split(' ')[0]}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(app.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(app)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Application Details & Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-xs select-none">
          <div className="relative w-full max-w-4xl bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{selectedApp.business_name}</h2>
                    <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      {selectedApp.application_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Category: {selectedApp.business_category} · Submitted {new Date(selectedApp.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${getStatusBadge(
                    selectedApp.status
                  )}`}
                >
                  {selectedApp.status.replace('_', ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {detailLoading && (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading full records and audit history...</span>
                </div>
              )}

              {/* Action Buttons Toolbar */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {['PENDING'].includes(selectedApp.status) && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleMoveUnderReview}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Move to Under Review</span>
                    </button>
                  )}

                  {['PENDING', 'UNDER_REVIEW'].includes(selectedApp.status) && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleApprove}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-900/30 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Send Invitation</span>
                    </button>
                  )}

                  {['PENDING', 'UNDER_REVIEW'].includes(selectedApp.status) && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setRequestInfoModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Request Additional Info</span>
                    </button>
                  )}

                  {['INVITATION_SENT', 'APPROVED'].includes(selectedApp.status) && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleResendInvitation}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Resend Activation Email</span>
                    </button>
                  )}

                  {!['REJECTED', 'ACTIVE'].includes(selectedApp.status) && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setRejectionModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Application</span>
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400">
                  Reviewed by: <span className="font-semibold text-slate-200">{selectedApp.reviewed_by_email || 'Pending'}</span>
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Applicant Info */}
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>Applicant Details</span>
                  </h3>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Full Name</span>
                      <span className="font-semibold text-white">{selectedApp.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email</span>
                      <span className="font-semibold text-white">{selectedApp.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mobile Number</span>
                      <span className="font-semibold text-white">{selectedApp.phone}</span>
                    </div>
                    {selectedApp.alt_phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Alt Phone</span>
                        <span className="font-semibold text-white">{selectedApp.alt_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Info */}
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400" />
                    <span>Business Information</span>
                  </h3>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Store Name</span>
                      <span className="font-semibold text-white">{selectedApp.business_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Category</span>
                      <span className="font-semibold text-white">{selectedApp.business_category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">PAN / VAT</span>
                      <span className="font-semibold text-white">{selectedApp.pan_vat_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Registration #</span>
                      <span className="font-semibold text-white">{selectedApp.registration_number || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Physical Location */}
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Store Location</span>
                  </h3>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Province</span>
                      <span className="font-semibold text-white">{selectedApp.province || 'Bagmati'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">District</span>
                      <span className="font-semibold text-white">{selectedApp.district}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Municipality / Ward</span>
                      <span className="font-semibold text-white">
                        {selectedApp.municipality} {selectedApp.ward_number ? `Ward ${selectedApp.ward_number}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Complete Address</span>
                      <span className="font-semibold text-white text-right max-w-[200px]">
                        {selectedApp.complete_address}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submitted Documents & Logo */}
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>Documents & Assets</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Store Logo</span>
                      {selectedApp.logo_url ? (
                        <a
                          href={selectedApp.logo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>View Logo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">Not provided</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">PAN / VAT Certificate</span>
                      {selectedApp.pan_vat_doc_url ? (
                        <a
                          href={selectedApp.pan_vat_doc_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>View Document</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">Not uploaded</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Company Registration</span>
                      {selectedApp.registration_doc_url ? (
                        <a
                          href={selectedApp.registration_doc_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>View Document</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">Not uploaded</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Notes Section */}
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Internal Review Notes
                </h3>
                {selectedApp.admin_notes && (
                  <pre className="text-xs text-slate-300 font-sans whitespace-pre-wrap bg-slate-900 p-3 rounded-xl border border-slate-800">
                    {selectedApp.admin_notes}
                  </pre>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Add an internal note or observation for this application..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    disabled={actionLoading || !internalNote.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer disabled:opacity-50"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {/* Audit History Timeline */}
              {selectedApp.audit_logs && selectedApp.audit_logs.length > 0 && (
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span>Application Audit Trail</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedApp.audit_logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <div>
                          <span className="font-bold text-emerald-400 font-mono mr-2">{log.action}</span>
                          <span className="text-slate-300">{log.notes}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 shrink-0">
                          by <span className="font-semibold text-slate-400">{log.actor_name}</span> at{' '}
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reject Seller Application</h3>
                <p className="text-xs text-slate-400">{selectedApp.business_name} ({selectedApp.application_number})</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Rejection Reason (will be emailed to applicant) <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain clearly why this application is rejected (e.g. invalid PAN document, store category not supported, etc.)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !rejectionReason.trim()}
                onClick={handleReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Info Request Modal */}
      {requestInfoModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Request Additional Information</h3>
                <p className="text-xs text-slate-400">{selectedApp.business_name} ({selectedApp.application_number})</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Information or Documents Required <span className="text-amber-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={additionalInfoText}
                onChange={(e) => setAdditionalInfoText(e.target.value)}
                placeholder="Specify the additional files or clarifications the applicant must provide..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRequestInfoModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !additionalInfoText.trim()}
                onClick={handleRequestInfo}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
