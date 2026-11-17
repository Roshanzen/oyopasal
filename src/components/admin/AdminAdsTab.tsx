import React from 'react';
import { ExternalLink, Megaphone, RefreshCw, Trash2, Upload } from 'lucide-react';
import { adminService } from '../../services';
import { Advertisement } from '../../types';

interface AdminAdsTabProps {
  ads: Advertisement[];
  loading: boolean;
  adTitle: string;
  adSubtitle: string;
  adImageUrl: string;
  adDestUrl: string;
  adPlacement: string;
  adPriority: number;
  uploadingAdImg: boolean;
  setAdTitle: (v: string) => void;
  setAdSubtitle: (v: string) => void;
  setAdImageUrl: (v: string) => void;
  setAdDestUrl: (v: string) => void;
  setAdPlacement: (v: string) => void;
  setAdPriority: (v: number) => void;
  setUploadingAdImg: (b: boolean) => void;
  onUploadAsset: (
    file: File,
    entityType: string,
    setBusy: (b: boolean) => void,
    onDone: (url: string) => void
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AdminAdsTab(props: AdminAdsTabProps) {
  const {
    ads,
    loading,
    adTitle,
    adSubtitle,
    adImageUrl,
    adDestUrl,
    adPlacement,
    adPriority,
    uploadingAdImg,
    setAdTitle,
    setAdSubtitle,
    setAdImageUrl,
    setAdDestUrl,
    setAdPlacement,
    setAdPriority,
    setUploadingAdImg,
    onUploadAsset,
    onRefresh,
    showToast,
  } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!adImageUrl.trim()) {
            showToast('Please upload or enter an advertisement image URL', 'error');
            return;
          }
          await adminService.createAdminAdvertisement({
            title: adTitle,
            subtitle: adSubtitle,
            image_url: adImageUrl.trim(),
            destination_url: adDestUrl.trim() || '/search',
            placement: adPlacement,
            priority: adPriority,
          });
          setAdTitle('');
          setAdSubtitle('');
          setAdImageUrl('');
          setAdDestUrl('/search');
          showToast('Advertisement campaign created', 'success');
          onRefresh();
        }}
        className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
      >
        <h3 className="font-bold text-white flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-amber-400" />
          <span>Create Storefront Advertisement</span>
        </h3>
        <input
          required
          value={adTitle}
          onChange={(e) => setAdTitle(e.target.value)}
          placeholder="Campaign Headline"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          value={adSubtitle}
          onChange={(e) => setAdSubtitle(e.target.value)}
          placeholder="Subtitle / Offer Details"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <div className="flex gap-2 items-center">
          <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1 shrink-0">
            {uploadingAdImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Upload</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadAsset(f, 'advertisement', setUploadingAdImg, setAdImageUrl);
                e.target.value = '';
              }}
            />
          </label>
          <input
            required
            value={adImageUrl}
            onChange={(e) => setAdImageUrl(e.target.value)}
            placeholder="Creative image URL *"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Placement</label>
            <select
              value={adPlacement}
              onChange={(e) => setAdPlacement(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            >
              <option value="homepage_mid">Homepage Mid Banner</option>
              <option value="homepage_bottom">Homepage Bottom Strip</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Priority</label>
            <input
              type="number"
              min="1"
              value={adPriority}
              onChange={(e) => setAdPriority(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            />
          </div>
        </div>
        <input
          value={adDestUrl}
          onChange={(e) => setAdDestUrl(e.target.value)}
          placeholder="Destination route (e.g. /category/organic-gourmet)"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
        />
        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
        >
          Publish Advertisement
        </button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        {loading && ads.length === 0 ? (
          <div className="p-10 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
            Loading advertisements...
          </div>
        ) : ads.length === 0 ? (
          <div className="p-10 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
            No advertisements created yet.
          </div>
        ) : (
          ads.map((ad) => (
            <div
              key={ad.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <img src={ad.image_url} alt={ad.title} className="w-20 h-14 rounded-xl object-cover bg-slate-800 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm truncate">{ad.title}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono">
                      {ad.placement}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                        ad.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ad.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{ad.subtitle}</p>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {ad.destination_url}
                    </span>
                    <span>·</span>
                    <span className="text-amber-400 font-mono">{ad.clicks_count} clicks</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await adminService.updateAdminAdvertisement(ad.db_id, { is_active: !ad.is_active });
                    onRefresh();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  {ad.is_active ? 'Pause' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await adminService.deleteAdminAdvertisement(ad.db_id);
                    showToast('Advertisement deleted', 'info');
                    onRefresh();
                  }}
                  className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
