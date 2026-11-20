import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { adminService } from '../../services';
import { HeroBanner } from '../../types';

interface AdminHeroBannersTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBannersUpdated?: () => void;
}

export default function AdminHeroBannersTab({
  showToast,
  onBannersUpdated,
}: AdminHeroBannersTabProps) {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAdminHeroBanners();
      const list = Array.isArray(data) ? data : ((data as unknown as { results: HeroBanner[] }).results || []);
      setBanners(list);
      // Auto-set next display order
      if (list.length > 0) {
        const maxOrder = Math.max(...list.map((b) => b.display_order || 0));
        setDisplayOrder(maxOrder + 1);
      } else {
        setDisplayOrder(1);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to fetch hero banners', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      showToast('Please select a PNG, JPEG, or WebP image file.', 'error');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
    if (!altText) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setAltText(`OyoPasal - ${cleanName}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePreview) {
      showToast('Please upload or select a graphic banner photo.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminService.createAdminHeroBanner({
        data_url: filePreview,
        filename: selectedFile?.name || 'hero_banner.jpg',
        target_url: targetUrl.trim() || '/',
        alt_text: altText.trim() || 'OyoPasal Promotional Banner',
        display_order: displayOrder,
        is_active: true,
      });

      showToast('Hero banner uploaded & published successfully!', 'success');
      // Reset form
      setSelectedFile(null);
      setFilePreview('');
      setTargetUrl('');
      setAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      await fetchBanners();
      if (onBannersUpdated) onBannersUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload hero banner', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: HeroBanner) => {
    try {
      const updated = await adminService.updateAdminHeroBanner(banner.id, {
        is_active: !banner.is_active,
      });
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
      showToast(
        updated.is_active ? `Banner #${banner.id} is now Active on storefront` : `Banner #${banner.id} is now Hidden`,
        'info'
      );
      if (onBannersUpdated) onBannersUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle banner status', 'error');
    }
  };

  const handleDelete = async (banner: HeroBanner) => {
    if (!window.confirm(`Are you sure you want to permanently delete Banner #${banner.id}?`)) {
      return;
    }
    try {
      await adminService.deleteAdminHeroBanner(banner.id);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
      showToast(`Banner #${banner.id} deleted successfully`, 'info');
      if (onBannersUpdated) onBannersUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete banner', 'error');
    }
  };

  const handleReorder = async (bannerId: number, direction: 'up' | 'down') => {
    try {
      const updatedList = await adminService.reorderAdminHeroBanner(bannerId, direction);
      if (Array.isArray(updatedList)) {
        setBanners(updatedList);
      } else {
        await fetchBanners();
      }
      showToast('Banner order updated', 'success');
      if (onBannersUpdated) onBannersUpdated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reorder banner', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-emerald-400" />
            <span>Storefront Hero Banners</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage full-width promotional banners rotating on the OyoPasal Customer Homepage hero carousel.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBanners}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Banners</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* =========================================================================
            1. UPLOAD CARD (LEFT COLUMN - 5 cols)
            ========================================================================= */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Upload New Hero Banner</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Photo uploads publish live directly to the storefront hero carousel.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* File Dropzone */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Banner Artwork Photo <span className="text-rose-400">*</span>
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-5 text-center flex flex-col items-center justify-center min-h-[160px] overflow-hidden ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : filePreview
                    ? 'border-emerald-500/50 bg-slate-950'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/70 hover:bg-slate-950'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileChange(f);
                  }}
                />

                {filePreview ? (
                  <div className="w-full space-y-2">
                    <div className="w-full aspect-[21/7] rounded-xl overflow-hidden border border-slate-800 bg-black">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <span className="truncate max-w-[200px] text-emerald-400 font-medium">
                        {selectedFile?.name || 'Artwork selected'}
                      </span>
                      <span className="text-slate-500 underline hover:text-slate-300">Click to replace</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-2.5">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-white">
                      Click to choose or drag & drop photo here
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, or WebP</p>
                  </>
                )}
              </div>

              {/* Recommended Dimensions Note */}
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                <span className="font-bold text-amber-400">Recommended:</span>{' '}
                <strong className="text-white">1920 × 600 px</strong> widescreen graphic — all text, branding, and
                promotions should be designed inside the image itself.
              </p>
            </div>

            {/* Click Destination URL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Click Destination URL (Optional)
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="e.g. /category/fruits-vegetables or /outlets/fresh"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Customers are redirected here when they click anywhere on this banner slide.
              </span>
            </div>

            {/* Alt Text / Accessible Label */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Banner Description / Alt Text
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="e.g. Super Savings - Fresh Vegetables Festival"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Display Order</label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="w-32 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Lower numbers display first (e.g., 1 is the opening slide).
              </span>
            </div>

            {/* Emerald Green Action Button */}
            <button
              type="submit"
              disabled={isSubmitting || !filePreview}
              className="w-full py-3 px-6 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Publishing Banner...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Upload & Publish Banner</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* =========================================================================
            2. LIVE ACTIVE BANNERS LIST (RIGHT COLUMN - 7 cols)
            ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>Live Banners on Storefront ({banners.length})</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Sorted by Display Order</span>
          </div>

          {loading ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Loading hero banners from database...</p>
            </div>
          ) : banners.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900 border border-dashed border-slate-800 text-center space-y-2">
              <ImageIcon className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">No custom hero banners found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload your first widescreen promotional banner using the upload card on the left.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {banners.map((banner, index) => {
                const isFirst = index === 0;
                const isLast = index === banners.length - 1;

                return (
                  <div
                    key={banner.id}
                    className={`p-4 rounded-2xl bg-slate-900 border transition-all flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                      banner.is_active
                        ? 'border-slate-800 hover:border-slate-700'
                        : 'border-slate-800/60 opacity-60 bg-slate-950/40'
                    }`}
                  >
                    {/* Widescreen Banner Thumbnail Preview */}
                    <div className="relative w-full sm:w-48 aspect-[16/6] rounded-xl overflow-hidden bg-black shrink-0 border border-slate-800">
                      <img
                        src={banner.image_url || banner.image}
                        alt={banner.alt_text}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          // Fallback thumbnail if broken
                          (e.currentTarget as HTMLImageElement).src =
                            '/assets/images/hero_groceries_fresh_1794407355931.jpg';
                        }}
                      />
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-xs text-[10px] font-mono font-bold text-white">
                        #{banner.display_order}
                      </span>
                    </div>

                    {/* Banner Information & Target Link */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate max-w-[280px]">
                          {banner.alt_text || `Hero Banner #${banner.id}`}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            banner.is_active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              banner.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          {banner.is_active ? 'Live on Storefront' : 'Hidden'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                        <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="font-mono text-emerald-300 truncate">
                          {banner.target_url || '/'}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500">
                        Slide position: <strong>{index + 1}</strong> of {banners.length}
                      </p>
                    </div>

                    {/* Action Controls: Reorder, Active Toggle, Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* Reorder Arrows */}
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleReorder(banner.id, 'up')}
                          disabled={isFirst}
                          title="Move banner up"
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(banner.id, 'down')}
                          disabled={isLast}
                          title="Move banner down"
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Active/Hidden Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(banner)}
                        title={banner.is_active ? 'Hide banner from storefront' : 'Show banner on storefront'}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                          banner.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(banner)}
                        title="Delete banner"
                        className="w-9 h-9 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
