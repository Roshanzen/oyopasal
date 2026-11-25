import React from 'react';
import { RefreshCw, Settings, Upload, Wallet } from 'lucide-react';
import { Language, SellerDashboardStats, SellerSettlementItem, Vendor } from '../../types';

interface SellerSettingsTabProps {
  effectiveVendor: Vendor;
  dashboardStats: SellerDashboardStats | null;
  settlements: SellerSettlementItem[];
  storeOnline: boolean;
  setStoreOnline: React.Dispatch<React.SetStateAction<boolean>>;
  openTime: string;
  setOpenTime: (v: string) => void;
  closeTime: string;
  setCloseTime: (v: string) => void;
  storeEta: string;
  setStoreEta: (v: string) => void;
  storeDesc: string;
  setStoreDesc: (v: string) => void;
  storeLogoUrl: string;
  storeCoverUrl: string;
  uploadingStoreLogo: boolean;
  uploadingStoreCover: boolean;
  savingStore: boolean;
  language: Language;
  formatPrice: (n: number) => string;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveStore: (e: React.FormEvent) => void;
}

export default function SellerSettingsTab({
  effectiveVendor,
  dashboardStats,
  settlements = [],
  storeOnline,
  setStoreOnline,
  openTime,
  setOpenTime,
  closeTime,
  setCloseTime,
  storeEta,
  setStoreEta,
  storeDesc,
  setStoreDesc,
  storeLogoUrl,
  storeCoverUrl,
  uploadingStoreLogo,
  uploadingStoreCover,
  savingStore,
  language,
  formatPrice,
  onLogoUpload,
  onCoverUpload,
  onSaveStore,
}: SellerSettingsTabProps) {
  const safeSettlements = Array.isArray(settlements) ? settlements : [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>{language === 'ne' ? 'पसल सञ्चालन सेटिङ' : 'Store Operating Settings'}</span>
        </h2>
        <form onSubmit={onSaveStore} className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">{language === 'ne' ? 'पसल अनलाइन स्थिति' : 'Accepting Live Orders'}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{storeOnline ? 'Online & visible to buyers' : 'Paused temporarily'}</span>
            </div>
            <button
              type="button"
              onClick={() => setStoreOnline((v) => !v)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer shadow-xs ${
                storeOnline ? 'bg-[#059669] text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {storeOnline ? 'ONLINE' : 'PAUSED'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Open Time</label>
              <input
                type="text"
                value={openTime ?? ''}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Close Time</label>
              <input
                type="text"
                value={closeTime ?? ''}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Dispatch ETA</label>
              <input
                type="text"
                value={storeEta ?? ''}
                onChange={(e) => setStoreEta(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Store Logo</label>
              <div className="flex items-center gap-2">
                {storeLogoUrl && (
                  <img src={storeLogoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs">
                  {uploadingStoreLogo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{uploadingStoreLogo ? 'Uploading...' : 'Upload Logo'}</span>
                  <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">Store Cover Banner</label>
              <div className="flex items-center gap-2">
                {storeCoverUrl && (
                  <img src={storeCoverUrl} alt="Cover" className="w-14 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs">
                  {uploadingStoreCover ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{uploadingStoreCover ? 'Uploading...' : 'Upload Cover'}</span>
                  <input type="file" accept="image/*" onChange={onCoverUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Store Description</label>
            <textarea
              rows={3}
              value={storeDesc ?? ''}
              onChange={(e) => setStoreDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={savingStore}
            className="px-5 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-sm cursor-pointer shadow-xs"
          >
            {savingStore ? 'Saving...' : 'Save Store Profile'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>{language === 'ne' ? 'भुक्तानी र सेटलमेन्ट इतिहास' : 'Settlements & Commission Ledger'}</span>
        </h2>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm flex items-center justify-between">
          <span className="text-slate-600 dark:text-slate-400">Platform Commission Rate</span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
            {dashboardStats?.commission_rate ?? effectiveVendor.commission_rate ?? 10}%
          </span>
        </div>

        {safeSettlements.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            {language === 'ne'
              ? 'अझै कुनै सेटलमेन्ट भुक्तानी जारी भएको छैन।'
              : 'No payout settlements issued yet. Completed deliveries accrue in your ledger balance.'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {safeSettlements.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Net Payout: {formatPrice(s.netPayout)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Gross {formatPrice(s.grossSales)} · Fee {formatPrice(s.commissionTotal)}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    s.status === 'paid'
                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                      : 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
