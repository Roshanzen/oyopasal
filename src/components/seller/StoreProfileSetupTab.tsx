import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Store,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { sellerService } from '../../services/sellerService';
import { StoreGalleryImageItem, StoreProfileData } from '../../types';
import { useApp } from '../../context';

const MAX_GALLERY_IMAGES = 9;
const MAX_BANNER_SIZE_MB = 10;
const MAX_LOGO_SIZE_MB = 5;

interface QueuedGalleryFile {
  id: string;
  file: File;
  previewUrl: string;
}

export default function StoreProfileSetupTab() {
  const { showToast, language } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeProfile, setStoreProfile] = useState<StoreProfileData | null>(null);

  // Form Fields
  const [storeName, setStoreName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [areaWard, setAreaWard] = useState('');
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('21:00');

  // Media States
  const [coverBannerUrl, setCoverBannerUrl] = useState('');
  const [coverBannerFile, setCoverBannerFile] = useState<File | null>(null);
  const [coverBannerPreview, setCoverBannerPreview] = useState<string | null>(null);
  const [removeCoverBanner, setRemoveCoverBanner] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);

  // Gallery States
  const [galleryImages, setGalleryImages] = useState<StoreGalleryImageItem[]>([]);
  const [newGalleryFiles, setNewGalleryFiles] = useState<QueuedGalleryFile[]>([]);
  const [removeGalleryImageIds, setRemoveGalleryImageIds] = useState<(string | number)[]>([]);

  // Refs for file inputs
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial profile
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await sellerService.getSellerStoreProfile({ bypassCache: true });
      if (res && res.store) {
        populateForm(res.store);
      }
    } catch (err: any) {
      console.error('Failed to load store profile:', err);
      showToast(err?.message || 'Failed to load store profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data: StoreProfileData) => {
    setStoreProfile(data);
    setStoreName(data.store_name ?? '');
    setShortDescription(data.short_description ?? '');
    setAreaWard(data.area_ward ?? data.address ?? '');
    setOpeningTime(data.opening_time ?? '09:00');
    setClosingTime(data.closing_time ?? '21:00');

    setCoverBannerUrl(data.cover_banner_url ?? '');
    setCoverBannerFile(null);
    setCoverBannerPreview(null);
    setRemoveCoverBanner(false);

    setLogoUrl(data.logo_url ?? '');
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);

    setGalleryImages(data.gallery_images ?? []);
    setNewGalleryFiles([]);
    setRemoveGalleryImageIds([]);
  };

  useEffect(() => {
    fetchProfile();
    return () => {
      // Clean up blob URLs
      if (coverBannerPreview) URL.revokeObjectURL(coverBannerPreview);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      newGalleryFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  // Compute Active Gallery Count
  const activeExistingGallery = useMemo(() => {
    return galleryImages.filter((img) => !removeGalleryImageIds.includes(img.id));
  }, [galleryImages, removeGalleryImageIds]);

  const totalGalleryCount = activeExistingGallery.length + newGalleryFiles.length;

  // Banner handlers
  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning');
      return;
    }
    if (file.size > MAX_BANNER_SIZE_MB * 1024 * 1024) {
      showToast(`Cover banner must be smaller than ${MAX_BANNER_SIZE_MB}MB.`, 'warning');
      return;
    }

    if (coverBannerPreview) URL.revokeObjectURL(coverBannerPreview);
    setCoverBannerFile(file);
    setCoverBannerPreview(URL.createObjectURL(file));
    setRemoveCoverBanner(false);
  };

  const handleRemoveBanner = () => {
    if (coverBannerPreview) URL.revokeObjectURL(coverBannerPreview);
    setCoverBannerFile(null);
    setCoverBannerPreview(null);
    setRemoveCoverBanner(true);
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  // Logo handlers
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WEBP).', 'warning');
      return;
    }
    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      showToast(`Logo must be smaller than ${MAX_LOGO_SIZE_MB}MB.`, 'warning');
      return;
    }

    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleRemoveLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // Gallery handlers
  const handleAddGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const availableSlots = MAX_GALLERY_IMAGES - totalGalleryCount;
    if (availableSlots <= 0) {
      showToast(`You can upload up to ${MAX_GALLERY_IMAGES} gallery images only.`, 'warning');
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      showToast(`Only ${availableSlots} more image(s) can be added (max ${MAX_GALLERY_IMAGES}).`, 'info');
    }

    const newQueued: QueuedGalleryFile[] = [];
    for (const f of filesToProcess) {
      if (!f.type.startsWith('image/')) {
        showToast(`Skipped non-image file: ${f.name}`, 'warning');
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        showToast(`Skipped ${f.name}: Image exceeds 10MB limit.`, 'warning');
        continue;
      }
      newQueued.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
      });
    }

    setNewGalleryFiles((prev) => [...prev, ...newQueued]);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleRemoveExistingGalleryImage = (id: string | number) => {
    setRemoveGalleryImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleRemoveQueuedGalleryFile = (id: string) => {
    setNewGalleryFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  // Submit profile changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeName.trim()) {
      showToast('Store name is required.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('store_name', storeName.trim());
      formData.append('short_description', shortDescription.trim());
      formData.append('area_ward', areaWard.trim());
      formData.append('opening_time', openingTime.trim());
      formData.append('closing_time', closingTime.trim());

      // Cover Banner
      if (coverBannerFile) {
        formData.append('cover_banner', coverBannerFile);
      } else if (removeCoverBanner) {
        formData.append('remove_cover_banner', 'true');
      }

      // Logo
      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (removeLogo) {
        formData.append('remove_logo', 'true');
      }

      // Existing gallery removals
      removeGalleryImageIds.forEach((id) => {
        formData.append('remove_gallery_images', String(id));
      });

      // New gallery files
      newGalleryFiles.forEach((item) => {
        formData.append('gallery_images', item.file);
      });

      const res = await sellerService.updateSellerStoreProfile(formData);
      if (res && res.store) {
        populateForm(res.store);
        showToast(
          language === 'ne'
            ? 'पसल प्रोफाइल सफलतापूर्वक सुरक्षित र प्रकाशित गरियो!'
            : 'Store profile successfully saved and published!',
          'success'
        );
      }
    } catch (err: any) {
      console.error('Failed to update store profile:', err);
      showToast(err?.message || 'Failed to update store profile. Please check file sizes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Format 24-hr time to 12-hr string for live preview
  const formatPreviewTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hour = parseInt(parts[0], 10);
      const min = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${min.padStart(2, '0')} ${ampm}`;
    }
    return timeStr;
  };

  // Computed values for live preview
  const previewBannerSrc = useMemo(() => {
    if (coverBannerPreview) return coverBannerPreview;
    if (!removeCoverBanner && coverBannerUrl) return coverBannerUrl;
    return null;
  }, [coverBannerPreview, removeCoverBanner, coverBannerUrl]);

  const previewLogoSrc = useMemo(() => {
    if (logoPreview) return logoPreview;
    if (!removeLogo && logoUrl) return logoUrl;
    return null;
  }, [logoPreview, removeLogo, logoUrl]);

  const storeMonogram = (storeName || 'S').trim().charAt(0).toUpperCase();

  const previewGalleryList = useMemo(() => {
    const list: string[] = [];
    activeExistingGallery.forEach((img) => {
      if (img.url && !list.includes(img.url)) list.push(img.url);
    });
    newGalleryFiles.forEach((f) => {
      if (f.previewUrl && !list.includes(f.previewUrl)) list.push(f.previewUrl);
    });
    return list;
  }, [activeExistingGallery, newGalleryFiles]);

  const hasUnsavedChanges = useMemo(() => {
    if (!storeProfile) return false;
    return (
      storeName !== (storeProfile.store_name || '') ||
      shortDescription !== (storeProfile.short_description || '') ||
      areaWard !== (storeProfile.area_ward || storeProfile.address || '') ||
      openingTime !== (storeProfile.opening_time || '09:00') ||
      closingTime !== (storeProfile.closing_time || '21:00') ||
      Boolean(coverBannerFile) ||
      removeCoverBanner ||
      Boolean(logoFile) ||
      removeLogo ||
      newGalleryFiles.length > 0 ||
      removeGalleryImageIds.length > 0
    );
  }, [
    storeProfile,
    storeName,
    shortDescription,
    areaWard,
    openingTime,
    closingTime,
    coverBannerFile,
    removeCoverBanner,
    logoFile,
    removeLogo,
    newGalleryFiles,
    removeGalleryImageIds,
  ]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-sm font-medium">Loading store profile settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Store className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>{language === 'ne' ? 'पसल प्रोफाइल सेटअप' : 'Store Profile Setup'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ne'
              ? 'आफ्नो पसलको नाम, ब्यानर, लोगो, ठेगाना, समय र ग्यालरी तस्बिरहरू ग्राहकका लागि मिलाउनुहोस्।'
              : 'Customize your public storefront banner, logo, business details, operating hours, and gallery.'}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchProfile}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Two-Column Grid: Left Column (Form) | Right Column (Live Preview) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* =========================================================================
            LEFT COLUMN: FORM EDITORS & UPLOADERS (7 COLS ON XL)
           ========================================================================= */}
        <form onSubmit={handleSubmit} className="xl:col-span-7 space-y-6">
          {/* Card A: Cover Banner Uploader */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ne' ? 'पसल कभर ब्यानर' : 'Store Cover Banner'}
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Recommended size: 1600 × 450 px (max 10MB)
                </span>
              </div>
              {previewBannerSrc && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Banner</span>
                </button>
              )}
            </div>

            {/* Banner Preview Area */}
            <div className="relative w-full aspect-[16/5] rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 flex items-center justify-center group">
              {previewBannerSrc ? (
                <>
                  <img
                    src={previewBannerSrc}
                    alt="Cover banner preview"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-md hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Change Banner</span>
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition w-full h-full"
                >
                  <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Click or drag image to upload Store Cover Banner
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1">Supports JPG, PNG, WEBP</span>
                </div>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleBannerChange}
              className="hidden"
            />
          </div>

          {/* Card B: Store Logo Uploader */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'ne' ? 'पसल लोगो' : 'Store Logo'}
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Recommended size: 1:1 square, at least 400 × 400 px (max 5MB)
                </span>
              </div>
              {previewLogoSrc && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Logo</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Square Logo Box */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 group">
                {previewLogoSrc ? (
                  <>
                    <img
                      src={previewLogoSrc}
                      alt="Store logo preview"
                      className="w-full h-full object-contain p-2"
                    />
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition p-2"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-extrabold text-xl flex items-center justify-center shadow-xs">
                      {storeMonogram}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 font-medium">Click to add</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{previewLogoSrc ? 'Change Store Logo' : 'Upload Store Logo'}</span>
                </button>
                <p className="text-[11px] text-slate-400">
                  When no logo is uploaded, your store monogram ({storeMonogram}) will be displayed to buyers.
                </p>
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>

          {/* Card C, D, E, F: Store Profile Details Form */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            {/* Store Name Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {language === 'ne' ? 'पसलको नाम' : 'Storefront Name'} *
              </label>
              <input
                type="text"
                required
                value={storeName ?? ''}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Rahul Fresh Grocery"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                This is the public storefront name visible across the marketplace.
              </span>
            </div>

            {/* Short Store Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {language === 'ne' ? 'पसलको छोटो विवरण' : 'Short Store Description'}
                </label>
                <span
                  className={`text-xs font-mono font-bold ${
                    shortDescription.length > 200
                      ? 'text-amber-500'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {shortDescription.length} / 200
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={220}
                value={shortDescription ?? ''}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Tell customers about your store, specialty goods, fresh supplies, and quality service..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                This short bio appears under your store title and on search result cards.
              </span>
            </div>

            {/* Location (Area / Ward / Address) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {language === 'ne' ? 'पसलको ठेगाना र वडा' : 'Store Location (Area / Ward)'} *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={areaWard ?? ''}
                  onChange={(e) => setAreaWard(e.target.value)}
                  placeholder="e.g. Koteshwor-32, Mahadevsthan, Kathmandu"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Operating Hours (Open & Close Time) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{language === 'ne' ? 'खुल्ने समय' : 'Opening Time'}</span>
                </label>
                <input
                  type="time"
                  value={openingTime ?? '09:00'}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span>{language === 'ne' ? 'बन्द हुने समय' : 'Closing Time'}</span>
                </label>
                <input
                  type="time"
                  value={closingTime ?? '21:00'}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card G: Store Gallery (Up to 9 Images) */}
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{language === 'ne' ? 'पसल फोटो ग्यालरी' : 'Store Photo Gallery'}</span>
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Upload photos of your storefront, aisles, counter, or organic produce shelves.
                </span>
              </div>
              <span
                className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-full ${
                  totalGalleryCount >= MAX_GALLERY_IMAGES
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {totalGalleryCount} / {MAX_GALLERY_IMAGES}
              </span>
            </div>

            {/* Gallery Thumbnail Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {/* Existing Saved Images */}
              {activeExistingGallery.map((img) => (
                <div
                  key={`saved-${img.id}`}
                  className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 group"
                >
                  <img src={img.url} alt="Gallery" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingGalleryImage(img.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-red-600 text-white opacity-90 hover:opacity-100 hover:scale-110 transition shadow-sm cursor-pointer"
                    title="Delete image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                    Saved
                  </span>
                </div>
              ))}

              {/* Newly Queued Images */}
              {newGalleryFiles.map((item) => (
                <div
                  key={`new-${item.id}`}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-emerald-500 bg-slate-100 dark:bg-slate-900 group"
                >
                  <img src={item.previewUrl} alt="New upload" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveQueuedGalleryFile(item.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-red-600 text-white opacity-90 hover:opacity-100 hover:scale-110 transition shadow-sm cursor-pointer"
                    title="Remove upload"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold">
                    New
                  </span>
                </div>
              ))}

              {/* Add More Tile */}
              {totalGalleryCount < MAX_GALLERY_IMAGES && (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-900/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center p-3 text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-xs font-bold text-center">Add Photo</span>
                </button>
              )}
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/jpg"
              onChange={handleAddGalleryFiles}
              className="hidden"
            />
          </div>

          {/* Action Button: Save & Publish */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 px-6 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-base shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-75 disabled:cursor-wait"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Publishing Changes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{language === 'ne' ? 'पसल प्रोफाइल सुरक्षित र प्रकाशित गर्नुहोस्' : 'Save & Publish Store Profile'}</span>
                </>
              )}
            </button>
            {hasUnsavedChanges && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2 font-medium">
                You have unsaved changes. Review the live preview on the right before publishing.
              </p>
            )}
          </div>
        </form>

        {/* =========================================================================
            RIGHT COLUMN: REAL-TIME LIVE CUSTOMER STOREFRONT PREVIEW (5 COLS ON XL)
           ========================================================================= */}
        <div className="xl:col-span-5 sticky top-20 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Live Storefront Preview
              </h2>
            </div>
            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Unsaved Edits</span>
              </span>
            )}
          </div>

          {/* Storefront Card Simulation */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121F] shadow-lg">
            {/* Banner Simulation */}
            <div className="w-full h-40 sm:h-44 relative bg-slate-900 overflow-hidden">
              {previewBannerSrc ? (
                <img
                  src={previewBannerSrc}
                  alt="Banner preview"
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
                  <Store className="w-12 h-12 text-emerald-200/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              {/* Gallery counter pill */}
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/10">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gallery ({previewGalleryList.length})</span>
              </div>
            </div>

            {/* Overlapping Identity & Info */}
            <div className="p-4 sm:p-5 relative">
              <div className="flex items-start justify-between">
                {/* Logo Box */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 border-white dark:border-[#0D121F] shadow-md -mt-10 sm:-mt-12 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden p-1.5 shrink-0 z-10">
                  {previewLogoSrc ? (
                    <img
                      src={previewLogoSrc}
                      alt="Logo preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl flex items-center justify-center text-white font-extrabold text-2xl shadow-xs">
                      {storeMonogram}
                    </div>
                  )}
                </div>

                {/* Status Pill */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
                  <span>OPEN</span>
                  <span className="text-slate-400 font-normal">
                    • Closes {formatPreviewTime(closingTime)}
                  </span>
                </div>
              </div>

              {/* Store Name & Verified Badge */}
              <div className="mt-3">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {storeName.trim() || 'Store Name'}
                  </h3>
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#059669] text-white shrink-0 shadow-xs"
                    title="Verified Merchant"
                  >
                    <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </div>

                {/* Meta details */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-bold text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>4.8</span>
                  </span>
                  <span>•</span>
                  <span>10–15 mins</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 truncate max-w-[180px]">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{areaWard.trim() || 'Location / Ward'}</span>
                  </span>
                </div>

                {/* Short Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 line-clamp-2 leading-relaxed">
                  {shortDescription.trim() ||
                    'Add a short store description to introduce your business to buyers across OyoPasal.'}
                </p>

                {/* Live Gallery Strip */}
                {previewGalleryList.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Store Gallery ({previewGalleryList.length})
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {previewGalleryList.map((src, idx) => (
                        <div
                          key={`strip-${idx}`}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0"
                        >
                          <img src={src} alt="Gallery thumb" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Your profile updates sync directly to your customer-facing storefront (<code>/stores/:slug</code>) immediately after saving.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
