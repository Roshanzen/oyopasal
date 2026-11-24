import React, { useState, useRef, useCallback } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { adminService } from '../../services';
import { useToastContext } from '../../context/ToastContext';

export interface ProductImageUploadGridProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export default function ProductImageUploadGrid({
  images,
  onChange,
  maxImages = 6,
  disabled = false,
}: ProductImageUploadGridProps) {
  const { showToast } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);

  const totalSlots = maxImages;
  const currentCount = images.length;
  const remainingSlots = Math.max(0, totalSlots - currentCount);
  const isMaxReached = currentCount >= totalSlots;

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled || isUploading) return;
      const files = Array.from(fileList).filter((f) =>
        f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name)
      );

      if (files.length === 0) {
        showToast('Please select valid image files (JPG, PNG, or WebP).', 'error');
        return;
      }

      const available = maxImages - images.length;
      if (available <= 0) {
        showToast(`Maximum ${maxImages} product images allowed.`, 'info');
        return;
      }

      let filesToUpload = files;
      if (files.length > available) {
        filesToUpload = files.slice(0, available);
        showToast(`Maximum ${maxImages} product images allowed. Uploading first ${available}.`, 'info');
      }

      setIsUploading(true);
      try {
        const uploadPromises = filesToUpload.map((file) =>
          adminService.uploadMediaFile(file, 'product', undefined, true)
        );
        const results = await Promise.all(uploadPromises);
        const newUrls = results.map((r) => r.url).filter(Boolean);
        const updated = [...images, ...newUrls].slice(0, maxImages);
        onChange(updated);
        showToast(
          newUrls.length === 1 ? 'Product image uploaded' : `${newUrls.length} images uploaded`,
          'success'
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to upload image(s)';
        showToast(msg, 'error');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [disabled, images, isUploading, maxImages, onChange, showToast]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isMaxReached) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isMaxReached) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    if (disabled) return;
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const handleMoveLeft = (index: number) => {
    if (index <= 0 || disabled) return;
    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    onChange(updated);
  };

  const handleMoveRight = (index: number) => {
    if (index >= images.length - 1 || disabled) return;
    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    onChange(updated);
  };

  const handleMakeCover = (index: number) => {
    if (index === 0 || disabled) return;
    const updated = [...images];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    onChange(updated);
    showToast('Updated cover photo', 'success');
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (images.length >= maxImages) {
      showToast(`Maximum ${maxImages} product images allowed.`, 'info');
      return;
    }
    const isValid =
      ['http://', 'https://', '/uploads/', '/media/', 'data:image/', '/static/'].some((p) =>
        trimmed.startsWith(p)
      ) &&
      !trimmed.includes('\n') &&
      !trimmed.includes('\r') &&
      trimmed.length <= 500;

    if (!isValid) {
      showToast('Please enter a valid image URL (e.g. https://... or /uploads/...).', 'error');
      return;
    }

    if (images.includes(trimmed)) {
      showToast('This image has already been added.', 'info');
      return;
    }

    const updated = [...images, trimmed];
    onChange(updated);
    setUrlInput('');
    setShowUrlField(false);
    showToast('Image URL added', 'success');
  };

  return (
    <div className="space-y-3 select-none">
      {/* Hidden Multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
        className="hidden"
      />

      {/* Header Row: Title & Dynamic Counter Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Product Images <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(Up to {maxImages})</span>
          </label>
          <span className="text-rose-500 font-bold">*</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled || isMaxReached}
            onClick={() => setShowUrlField((prev) => !prev)}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{showUrlField ? 'Close URL' : 'Paste URL'}</span>
          </button>

          {/* Dynamic Counter Badge */}
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
              currentCount === 0
                ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                : isMaxReached
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/80'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {currentCount} / {maxImages} uploaded
          </span>
        </div>
      </div>

      {/* Optional Paste URL Input Bar */}
      <AnimatePresence>
        {showUrlField && !isMaxReached && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
                placeholder="Paste direct image URL (https://... or /uploads/...)"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Add Image
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6-Slot Responsive Gallery Grid (3 cols x 2 rows desktop, 2 cols x 3 rows mobile) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-3.5 p-3 rounded-2xl border transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60'
        }`}
      >
        {/* Render 6 Slots total */}
        {Array.from({ length: totalSlots }).map((_, slotIndex) => {
          const imageSrc = images[slotIndex];
          const isCover = slotIndex === 0 && Boolean(imageSrc);
          const isSlotOccupied = Boolean(imageSrc);

          if (isSlotOccupied) {
            return (
              <motion.div
                key={`occupied-${slotIndex}-${imageSrc}`}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className={`relative aspect-square rounded-xl overflow-hidden bg-slate-900 shadow-sm group border transition-all ${
                  isCover
                    ? 'border-2 border-[#059669] ring-2 ring-emerald-500/20'
                    : 'border-slate-700/80 hover:border-slate-600'
                }`}
              >
                {/* 1:1 Image Preview */}
                <img
                  src={imageSrc}
                  alt={`Product view ${slotIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />

                {/* Cover Photo Badge for Slot 1 */}
                {isCover ? (
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-[#059669] text-white text-[10px] font-extrabold shadow-md flex items-center gap-1 backdrop-blur-xs">
                    <Star className="w-3 h-3 fill-white" />
                    <span>Cover Photo</span>
                  </div>
                ) : (
                  /* "Set as Cover" Hover Shortcut for non-cover slots */
                  <button
                    type="button"
                    onClick={() => handleMakeCover(slotIndex)}
                    title="Set as Cover Photo"
                    className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/70 hover:bg-[#059669] text-white text-[10px] font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                  >
                    <Star className="w-2.5 h-2.5" />
                    <span>Make Cover</span>
                  </button>
                )}

                {/* Top-Right Circular Delete/Remove Button (×) */}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(slotIndex)}
                  title="Remove image"
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-slate-950/80 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-bold shadow-md cursor-pointer transition-all hover:scale-110"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Bottom Reorder Bar (Arrows) */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={slotIndex === 0}
                    onClick={() => handleMoveLeft(slotIndex)}
                    title="Move earlier"
                    className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[10px] font-mono text-white/80 font-bold">
                    #{slotIndex + 1}
                  </span>

                  <button
                    type="button"
                    disabled={slotIndex === images.length - 1}
                    onClick={() => handleMoveRight(slotIndex)}
                    title="Move later"
                    className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          }

          /* Empty Slot */
          const isFirstEmptySlot = slotIndex === currentCount;

          return (
            <motion.button
              key={`empty-slot-${slotIndex}`}
              type="button"
              disabled={disabled || isUploading || isMaxReached}
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              whileHover={!disabled && !isUploading ? { scale: 1.01 } : undefined}
              whileTap={!disabled && !isUploading ? { scale: 0.98 } : undefined}
              className={`relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all cursor-pointer ${
                slotIndex === 0
                  ? 'border-emerald-600/70 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400'
                  : isFirstEmptySlot
                  ? 'border-emerald-700/60 hover:border-emerald-500 bg-emerald-950/10 hover:bg-emerald-950/30 text-emerald-400'
                  : 'border-slate-800 bg-slate-900/30 hover:border-slate-700 text-slate-500 hover:text-slate-400'
              }`}
            >
              {isUploading && isFirstEmptySlot ? (
                <div className="flex flex-col items-center gap-1.5">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                  <span className="text-[11px] font-bold text-emerald-300">Uploading...</span>
                </div>
              ) : (
                <>
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-colors ${
                      slotIndex === 0 || isFirstEmptySlot
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : 'bg-slate-800/60 text-slate-500'
                    }`}
                  >
                    {slotIndex === 0 ? <Camera className="w-4.5 h-4.5" /> : <Plus className="w-4.5 h-4.5" />}
                  </div>
                  <span className="text-xs font-bold">
                    {slotIndex === 0 ? 'Add Cover Image' : 'Add Image'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Slot {slotIndex + 1}
                  </span>
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Helper Note / Max limit announcement */}
      {isMaxReached ? (
        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Maximum 6 images reached.</span>
          </div>
          <span className="text-[11px] text-slate-500">Remove an image to replace it.</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>Click any empty slot or drag & drop multiple files (JPG, PNG, WebP)</span>
          <span>Slot 1 is your main storefront cover</span>
        </div>
      )}
    </div>
  );
}
