import React from 'react';
import { Check, Pencil, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { adminService } from '../../services';
import { AdminCouponItem, Category, Promotion } from '../../types';
import AdminHeroBannersTab from './AdminHeroBannersTab';

interface AdminCmsTabProps {
  categories: Category[];
  promotions: Promotion[];
  coupons: AdminCouponItem[];
  catName: string;
  catNameNe: string;
  catSlug: string;
  catDesc: string;
  catImageUrl: string;
  uploadingCatImg: boolean;
  editingCatId: number | null;
  editCatName: string;
  editCatImg: string;
  setCatName: (v: string) => void;
  setCatNameNe: (v: string) => void;
  setCatSlug: (v: string) => void;
  setCatDesc: (v: string) => void;
  setCatImageUrl: (v: string) => void;
  setUploadingCatImg: (b: boolean) => void;
  setEditingCatId: (id: number | null) => void;
  setEditCatName: (v: string) => void;
  setEditCatImg: (v: string) => void;
  promoTitle: string;
  promoSub: string;
  promoImageUrl: string;
  promoDestUrl: string;
  promoStartsAt: string;
  promoEndsAt: string;
  uploadingPromoImg: boolean;
  setPromoTitle: (v: string) => void;
  setPromoSub: (v: string) => void;
  setPromoImageUrl: (v: string) => void;
  setPromoDestUrl: (v: string) => void;
  setPromoStartsAt: (v: string) => void;
  setPromoEndsAt: (v: string) => void;
  setUploadingPromoImg: (b: boolean) => void;
  couponCode: string;
  couponDesc: string;
  couponVal: number;
  setCouponCode: (v: string) => void;
  setCouponDesc: (v: string) => void;
  setCouponVal: (v: number) => void;
  onUploadAsset: (
    file: File,
    entityType: string,
    setBusy: (b: boolean) => void,
    onDone: (url: string) => void
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AdminCmsTab(props: AdminCmsTabProps) {
  const {
    categories,
    promotions,
    coupons,
    catName,
    catNameNe,
    catSlug,
    catDesc,
    catImageUrl,
    uploadingCatImg,
    editingCatId,
    editCatName,
    editCatImg,
    setCatName,
    setCatNameNe,
    setCatSlug,
    setCatDesc,
    setCatImageUrl,
    setUploadingCatImg,
    setEditingCatId,
    setEditCatName,
    setEditCatImg,
    promoTitle,
    promoSub,
    promoImageUrl,
    promoDestUrl,
    promoStartsAt,
    promoEndsAt,
    uploadingPromoImg,
    setPromoTitle,
    setPromoSub,
    setPromoImageUrl,
    setPromoDestUrl,
    setPromoStartsAt,
    setPromoEndsAt,
    setUploadingPromoImg,
    couponCode,
    couponDesc,
    couponVal,
    setCouponCode,
    setCouponDesc,
    setCouponVal,
    onUploadAsset,
    onRefresh,
    showToast,
  } = props;

  return (
    <div className="space-y-8">
      <AdminHeroBannersTab showToast={showToast} onBannersUpdated={onRefresh} />

      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-base font-extrabold text-white mb-4">Categories, Legacy Promotions & Coupons</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Categories Management */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await adminService.createAdminCategory({
              name: catName,
              name_ne: catNameNe || catName,
              slug: catSlug,
              description: catDesc,
              image_url: catImageUrl || undefined,
            });
            setCatName('');
            setCatNameNe('');
            setCatSlug('');
            setCatDesc('');
            setCatImageUrl('');
            showToast('Category created', 'success');
            onRefresh();
          }}
          className="space-y-2.5"
        >
          <h3 className="font-bold text-white">Create Category</h3>
          <input
            required
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Name (English)"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <input
            value={catNameNe}
            onChange={(e) => setCatNameNe(e.target.value)}
            placeholder="Name (Nepali - Optional)"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <input
            required
            value={catSlug}
            onChange={(e) => setCatSlug(e.target.value)}
            placeholder="slug-url"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <input
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            placeholder="Short description"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <div className="flex gap-2 items-center">
            <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1 shrink-0">
              {uploadingCatImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadAsset(f, 'category', setUploadingCatImg, setCatImageUrl);
                  e.target.value = '';
                }}
              />
            </label>
            <input
              value={catImageUrl}
              onChange={(e) => setCatImageUrl(e.target.value)}
              placeholder="Category image URL"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
            Add Category
          </button>
        </form>

        <div className="pt-3 border-t border-slate-800 space-y-2 max-h-80 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              {editingCatId === cat.db_id ? (
                <div className="space-y-2">
                  <input
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                  />
                  <input
                    value={editCatImg}
                    onChange={(e) => setEditCatImg(e.target.value)}
                    placeholder="Image URL"
                    className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!cat.db_id) return;
                        await adminService.updateAdminCategory(cat.db_id, {
                          name: editCatName,
                          image_url: editCatImg || null,
                        });
                        setEditingCatId(null);
                        showToast('Category updated', 'success');
                        onRefresh();
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCatId(null)}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {cat.image_url && <img src={cat.image_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-bold text-white block truncate">{cat.name}</span>
                      <span className="text-slate-500">
                        /{cat.slug} · {cat.item_count} items
                      </span>
                    </div>
                  </div>
                  {cat.db_id && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.db_id!);
                          setEditCatName(cat.name);
                          setEditCatImg(cat.image_url || '');
                        }}
                        className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminService.deleteAdminCategory(cat.db_id!);
                          showToast(`Deactivated ${cat.name}`, 'info');
                          onRefresh();
                        }}
                        className="p-1 rounded bg-rose-950/60 text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Promotions Management */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!promoImageUrl.trim()) {
              showToast('Please upload or enter a promotion banner image URL', 'error');
              return;
            }
            await adminService.createAdminPromotion({
              title: promoTitle,
              subtitle: promoSub,
              image_url: promoImageUrl.trim(),
              destination_url: promoDestUrl.trim() || undefined,
              starts_at: promoStartsAt || undefined,
              ends_at: promoEndsAt || undefined,
            });
            setPromoTitle('');
            setPromoSub('');
            setPromoImageUrl('');
            setPromoDestUrl('');
            setPromoStartsAt('');
            setPromoEndsAt('');
            showToast('Promotion banner added', 'success');
            onRefresh();
          }}
          className="space-y-2.5"
        >
          <h3 className="font-bold text-white">Create Banner Promotion</h3>
          <input
            required
            value={promoTitle}
            onChange={(e) => setPromoTitle(e.target.value)}
            placeholder="Banner Title"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <input
            required
            value={promoSub}
            onChange={(e) => setPromoSub(e.target.value)}
            placeholder="Subtitle"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <div className="flex gap-2 items-center">
            <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1 shrink-0">
              {uploadingPromoImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadAsset(f, 'promotion', setUploadingPromoImg, setPromoImageUrl);
                  e.target.value = '';
                }}
              />
            </label>
            <input
              required
              value={promoImageUrl}
              onChange={(e) => setPromoImageUrl(e.target.value)}
              placeholder="Banner image URL * (Recommended: 1920 × 600 px)"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Recommended size: <strong className="text-emerald-400">1920 × 600 px</strong> (21:7 / 16:5 widescreen ratio) for sharp edge-to-edge full width display without side gaps or distortion.
          </p>
          <input
            value={promoDestUrl}
            onChange={(e) => setPromoDestUrl(e.target.value)}
            placeholder="Destination URL (e.g. /category/top-deals)"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 block">Starts At</label>
              <input
                type="date"
                value={promoStartsAt}
                onChange={(e) => setPromoStartsAt(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-400 block">Ends At</label>
              <input
                type="date"
                value={promoEndsAt}
                onChange={(e) => setPromoEndsAt(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">
            Publish Banner
          </button>
        </form>

        <div className="space-y-2 pt-3 border-t border-slate-800 max-h-80 overflow-y-auto">
          {promotions.map((pr) => (
            <div
              key={pr.id}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-2 text-slate-300"
            >
              <div className="min-w-0">
                <span className="font-bold text-white block truncate">{pr.title}</span>
                <span className="text-emerald-400">
                  {pr.badge} · {pr.is_active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
              {pr.db_id !== undefined && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await adminService.updateAdminPromotion(pr.db_id!, { is_active: pr.is_active === false });
                      onRefresh();
                    }}
                    className="px-2 py-1 rounded bg-slate-800 text-indigo-300 font-bold cursor-pointer"
                  >
                    {pr.is_active === false ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminService.deleteAdminPromotion(pr.db_id!);
                      showToast('Banner deleted', 'info');
                      onRefresh();
                    }}
                    className="p-1 rounded bg-rose-950/60 text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Coupons Management */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await adminService.createAdminCoupon({
            code: couponCode,
            description: couponDesc,
            discount_value: couponVal,
          });
          setCouponCode('');
          setCouponDesc('');
          showToast('Coupon created', 'success');
          onRefresh();
        }}
        className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
      >
        <h3 className="font-bold text-white">Create Coupon Code</h3>
        <input
          required
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          placeholder="CODE (e.g. DASHAIN20)"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          required
          value={couponDesc}
          onChange={(e) => setCouponDesc(e.target.value)}
          placeholder="Description"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <input
          type="number"
          value={couponVal}
          onChange={(e) => setCouponVal(Number(e.target.value))}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer">
          Create Coupon
        </button>
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          {coupons.map((c) => (
            <div key={c.id} className="text-xs flex items-center justify-between text-slate-300 py-1">
              <span>
                <strong>{c.code}</strong> ({c.discountValue}
                {c.discountType === 'percentage' ? '%' : ' Rs'})
              </span>
              <button
                type="button"
                onClick={async () => {
                  await adminService.toggleAdminCoupon(c.id, !c.isActive);
                  onRefresh();
                }}
                className="underline text-indigo-400 cursor-pointer"
              >
                {c.isActive ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      </form>
        </div>
      </div>
    </div>
  );
}
