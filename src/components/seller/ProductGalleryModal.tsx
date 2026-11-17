import React from 'react';
import { RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { Product } from '../../types';

interface ProductGalleryModalProps {
  product: Product | null;
  modalImgUrl: string;
  setModalImgUrl: (v: string) => void;
  modalUploading: boolean;
  onClose: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddUrl: (isPrimary: boolean) => void;
  onDeleteImage: (imageId: number) => void;
}

export default function ProductGalleryModal({
  product,
  modalImgUrl,
  setModalImgUrl,
  modalUploading,
  onClose,
  onUploadFile,
  onAddUrl,
  onDeleteImage,
}: ProductGalleryModalProps) {
  if (!product) return null;

  const items =
    product.gallery_items && product.gallery_items.length > 0
      ? product.gallery_items
      : product.gallery.map((url, idx) => ({ id: -(idx + 1), image_url: url, is_primary: idx === 0 }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-lg font-bold text-white">Product Gallery</h3>
            <p className="text-xs text-slate-400">{product.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-square">
              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              {item.is_primary && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                  PRIMARY
                </span>
              )}
              {item.id > 0 && (
                <button
                  type="button"
                  disabled={modalUploading}
                  onClick={() => onDeleteImage(item.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <label className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
            {modalUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{modalUploading ? 'Uploading...' : 'Upload & Attach New Photo'}</span>
            <input type="file" accept="image/*" onChange={onUploadFile} className="hidden" />
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={modalImgUrl}
              onChange={(e) => setModalImgUrl(e.target.value)}
              placeholder="Or paste image URL..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
            />
            <button
              type="button"
              disabled={modalUploading || !modalImgUrl.trim()}
              onClick={() => onAddUrl(false)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              Add
            </button>
            <button
              type="button"
              disabled={modalUploading || !modalImgUrl.trim()}
              onClick={() => onAddUrl(true)}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              Set Primary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
