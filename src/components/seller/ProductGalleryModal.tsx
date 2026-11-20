import React, { useState, useEffect } from 'react';
import { RefreshCw, Save, X } from 'lucide-react';
import { Product } from '../../types';
import { sellerService } from '../../services';
import { useToastContext } from '../../context/ToastContext';
import ProductImageUploadGrid from './ProductImageUploadGrid';

export interface ProductGalleryModalProps {
  product: Product | null;
  onClose: () => void;
  onProductUpdated?: (updatedProduct: Product) => void;
  modalImgUrl?: string;
  setModalImgUrl?: (v: string) => void;
  modalUploading?: boolean;
  onUploadFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddUrl?: (isPrimary: boolean) => void;
  onDeleteImage?: (imageId: number) => void;
}

export default function ProductGalleryModal({
  product,
  onClose,
  onProductUpdated,
}: ProductGalleryModalProps) {
  const { showToast } = useToastContext();
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      if (Array.isArray(product.gallery) && product.gallery.length > 0) {
        setImages(product.gallery.slice(0, 6));
      } else if (product.image_url) {
        setImages([product.image_url]);
      } else {
        setImages([]);
      }
    }
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    if (images.length === 0) {
      showToast('Please keep at least 1 cover image for the product.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await sellerService.updateSellerProduct(product.id, {
        images: images.slice(0, 6),
        image_url: images[0],
        gallery_urls: images.slice(1, 6),
      });

      if (res.success && res.product) {
        showToast('Product images updated successfully!', 'success');
        if (onProductUpdated) {
          onProductUpdated(res.product);
        }
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update product images';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div>
            <h3 className="text-lg font-bold text-white">Manage Product Images</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">{product.name}</p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 6-Slot Multi-Image Gallery Grid */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
          <ProductImageUploadGrid
            images={images}
            onChange={setImages}
            maxImages={6}
            disabled={saving}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving || images.length === 0}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-md shadow-emerald-950/30"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Images</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
