import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Layers,
  Palette,
  Plus,
  PlusCircle,
  RefreshCw,
  Ruler,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { sellerService } from '../../services/sellerService';
import { Product, ProductVariant } from '../../types';

interface SellerVariantsModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: (updatedProduct: Product) => void;
  formatPrice: (n: number) => string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const COLOR_PRESETS = [
  { name: 'Black', code: '#000000' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Navy Blue', code: '#0F2C59' },
  { name: 'Maroon', code: '#800000' },
  { name: 'Heather Grey', code: '#9CA3AF' },
  { name: 'Forest Green', code: '#059669' },
  { name: 'Crimson Red', code: '#DC2626' },
  { name: 'Royal Blue', code: '#2563EB' },
  { name: 'Olive Green', code: '#556B2F' },
  { name: 'Beige / Cream', code: '#F5F5DC' },
];

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const SHOE_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44', '45'];

export default function SellerVariantsModal({
  product,
  isOpen,
  onClose,
  onProductUpdated,
  formatPrice,
  showToast,
}: SellerVariantsModalProps) {
  if (!isOpen) return null;

  const currentVariants: ProductVariant[] = product.variants || [];
  const hasExistingVariants = currentVariants.length > 0;

  // Mode: 'view' (stock & variant matrix) | 'edit' (configure / regenerate variants)
  const [activeTab, setActiveTab] = useState<'matrix' | 'builder'>(
    hasExistingVariants ? 'matrix' : 'builder'
  );

  // Local state for Quick Restock / Toggle on existing variants
  const [restockingVariantId, setRestockingVariantId] = useState<string | null>(null);
  const [togglingVariantId, setTogglingVariantId] = useState<string | null>(null);

  // Builder state
  const [selectedColors, setSelectedColors] = useState<Array<{ name: string; code: string }>>(() => {
    if (Array.isArray(product.available_colors) && product.available_colors.length > 0) {
      return product.available_colors.map((c) => ({
        name: typeof c === 'string' ? c : c.name,
        code: typeof c === 'string' ? '#000000' : c.color_code || '#000000',
      }));
    }
    return [{ name: 'Black', code: '#000000' }, { name: 'White', code: '#FFFFFF' }];
  });

  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    if (Array.isArray(product.available_sizes) && product.available_sizes.length > 0) {
      return product.available_sizes;
    }
    return ['S', 'M', 'L', 'XL'];
  });

  const [customColorName, setCustomColorName] = useState('');
  const [customColorCode, setCustomColorCode] = useState('#059669');
  const [customSizeInput, setCustomSizeInput] = useState('');

  // Generated matrix in builder mode
  const [builderVariants, setBuilderVariants] = useState<
    Array<{
      color: string;
      color_code: string;
      size: string;
      sku: string;
      price: number;
      original_price: number;
      stock: number;
      image_url?: string;
    }>
  >(() => {
    if (hasExistingVariants) {
      return currentVariants.map((v, i) => ({
        color: v.color || v.color_name || 'Standard',
        color_code: v.color_code || '#000000',
        size: v.size || 'One Size',
        sku: v.sku || `${product.base_sku || 'SKU'}-V${i + 1}`,
        price: v.selling_price || product.discounted_price || 100,
        original_price: v.regular_price || product.original_price || 120,
        stock: v.stock !== undefined ? v.stock : 25,
        image_url: v.image_url || '',
      }));
    }
    return [];
  });

  const [savingBuilder, setSavingBuilder] = useState(false);

  // Quick Restock on specific variant
  const handleRestockVariant = async (variantId: string, addQty: number) => {
    setRestockingVariantId(variantId);
    try {
      const res = await sellerService.restockProduct(product.id, addQty, variantId);
      if (res.success && res.product) {
        onProductUpdated(res.product);
        showToast(`Added +${addQty} units to variant stock!`, 'success');
      }
    } catch (err) {
      console.error('Failed to restock variant:', err);
      showToast('Could not restock variant. Please try again.', 'error');
    } finally {
      setRestockingVariantId(null);
    }
  };

  // Toggle in_stock on specific variant
  const handleToggleVariantStock = async (variantId: string) => {
    setTogglingVariantId(variantId);
    try {
      const res = await sellerService.toggleProductStock(product.id, variantId);
      if (res.success && res.product) {
        onProductUpdated(res.product);
        showToast('Variant stock status updated.', 'success');
      }
    } catch (err) {
      console.error('Failed to toggle variant:', err);
      showToast('Could not toggle variant stock.', 'error');
    } finally {
      setTogglingVariantId(null);
    }
  };

  // Toggle color in builder
  const toggleColor = (preset: { name: string; code: string }) => {
    const exists = selectedColors.some((c) => c.name.toLowerCase() === preset.name.toLowerCase());
    if (exists) {
      if (selectedColors.length <= 1) {
        showToast('Keep at least one color option.', 'info');
        return;
      }
      setSelectedColors(selectedColors.filter((c) => c.name.toLowerCase() !== preset.name.toLowerCase()));
    } else {
      setSelectedColors([...selectedColors, preset]);
    }
  };

  const handleAddCustomColor = () => {
    if (!customColorName.trim()) return;
    if (selectedColors.some((c) => c.name.toLowerCase() === customColorName.trim().toLowerCase())) {
      showToast('This color already exists.', 'info');
      return;
    }
    setSelectedColors([...selectedColors, { name: customColorName.trim(), code: customColorCode }]);
    setCustomColorName('');
  };

  // Toggle size in builder
  const toggleSize = (sizeStr: string) => {
    if (selectedSizes.includes(sizeStr)) {
      if (selectedSizes.length <= 1) {
        showToast('Keep at least one size option.', 'info');
        return;
      }
      setSelectedSizes(selectedSizes.filter((s) => s !== sizeStr));
    } else {
      setSelectedSizes([...selectedSizes, sizeStr]);
    }
  };

  const handleAddCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const clean = customSizeInput.trim().toUpperCase();
    if (selectedSizes.includes(clean)) {
      showToast('This size already exists.', 'info');
      return;
    }
    setSelectedSizes([...selectedSizes, clean]);
    setCustomSizeInput('');
  };

  // Generate combinations
  const handleGenerateCombinations = () => {
    const basePrice = product.discounted_price || product.price || 100;
    const origPrice = product.original_price || basePrice;
    const baseSku = product.base_sku || 'SKU';

    const newRows: typeof builderVariants = [];
    let idx = 1;

    selectedColors.forEach((col) => {
      selectedSizes.forEach((sz) => {
        const cleanCol = col.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
        const cleanSz = sz.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
        newRows.push({
          color: col.name,
          color_code: col.code,
          size: sz,
          sku: `${baseSku}-${cleanCol}-${cleanSz}-${idx}`,
          price: basePrice,
          original_price: origPrice,
          stock: 25,
          image_url: '',
        });
        idx++;
      });
    });

    setBuilderVariants(newRows);
    showToast(`Generated ${newRows.length} variant combinations!`, 'success');
  };

  // Save builder variants to backend
  const handleSaveVariants = async () => {
    if (builderVariants.length === 0) {
      showToast('Please generate at least one variant combination.', 'error');
      return;
    }

    setSavingBuilder(true);
    try {
      const payload = {
        variants: builderVariants.map((v) => ({
          color: v.color,
          color_code: v.color_code,
          size: v.size,
          sku: v.sku,
          discounted_price: v.price,
          original_price: v.original_price,
          price: v.price,
          stock: v.stock,
          image_url: v.image_url,
          is_active: true,
        })),
      };

      const res = await sellerService.updateSellerProduct(product.id, payload as any);
      if (res.success && res.product) {
        onProductUpdated(res.product);
        showToast('Variants saved successfully to product!', 'success');
        setActiveTab('matrix');
      }
    } catch (err) {
      console.error('Failed to update product variants:', err);
      showToast('Failed to save variants. Please check inputs.', 'error');
    } finally {
      setSavingBuilder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center gap-3.5 min-w-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
            )}
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{product.name}</h3>
                <span className="text-xs bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-semibold shrink-0">
                  {currentVariants.length > 0 ? `${currentVariants.length} Variants` : 'Single Product'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage color swatches, size options, and individual inventory levels.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800/80 bg-slate-950/20">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 px-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'matrix'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Layers className="w-4 h-4" />
            <span>Active Variants ({currentVariants.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`pb-3 px-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'builder'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Palette className="w-4 h-4" />
            <span>Color & Size Builder</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: ACTIVE VARIANTS MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-4">
              {currentVariants.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3">
                  <Palette className="w-10 h-10 text-slate-500 mx-auto" />
                  <h4 className="text-base font-bold text-white">No Color or Size Variants Configured</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    This item is currently sold as a single product. Switch to the <strong>Color & Size Builder</strong> tab to create selectable colors and sizes!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('builder')}
                    className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Configure Colors & Sizes Now</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                    <span>
                      Total inventory across variants: <strong>{product.stock || 0} units</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('builder')}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Edit or Add More Colors / Sizes</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                          <th className="py-3 px-4 font-semibold">Color</th>
                          <th className="py-3 px-4 font-semibold">Size</th>
                          <th className="py-3 px-4 font-semibold">SKU</th>
                          <th className="py-3 px-4 font-semibold">Price</th>
                          <th className="py-3 px-4 font-semibold">Stock</th>
                          <th className="py-3 px-4 font-semibold">Status</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {currentVariants.map((v) => {
                          const cName = v.color || v.color_name || 'Standard';
                          const cCode = v.color_code || '#6B7280';
                          const isRestocking = restockingVariantId === v.id;
                          const isToggling = togglingVariantId === v.id;
                          const inStock = v.in_stock && (v.stock || 0) > 0;

                          return (
                            <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                              {/* Color */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-xs"
                                    style={{ backgroundColor: cCode }}
                                  />
                                  <span className="font-semibold text-white text-xs">{cName}</span>
                                </div>
                              </td>

                              {/* Size */}
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">
                                  {v.size || 'One Size'}
                                </span>
                              </td>

                              {/* SKU */}
                              <td className="py-3 px-4 font-mono text-xs text-slate-400">
                                {v.sku}
                              </td>

                              {/* Price */}
                              <td className="py-3 px-4 font-mono text-xs font-bold text-white">
                                {formatPrice(v.selling_price || product.discounted_price)}
                              </td>

                              {/* Stock */}
                              <td className="py-3 px-4">
                                <span
                                  className={`font-mono text-xs font-bold ${(v.stock || 0) === 0 ? 'text-red-400' : (v.stock || 0) <= 5 ? 'text-amber-400' : 'text-emerald-400'
                                    }`}
                                >
                                  {v.stock || 0} units
                                </span>
                              </td>

                              {/* Status */}
                              <td className="py-3 px-4">
                                {inStock ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-red-400 font-semibold">
                                    <AlertCircle className="w-3.5 h-3.5" /> Out of Stock
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isRestocking}
                                    onClick={() => handleRestockVariant(v.id, 10)}
                                    title="Add +10 units"
                                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-mono font-bold border border-slate-700 cursor-pointer"
                                  >
                                    {isRestocking ? <RefreshCw className="w-3 h-3 animate-spin" /> : '+10'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isRestocking}
                                    onClick={() => handleRestockVariant(v.id, 25)}
                                    title="Add +25 units"
                                    className="px-2 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-mono font-bold border border-emerald-800 cursor-pointer"
                                  >
                                    +25
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isToggling}
                                    onClick={() => handleToggleVariantStock(v.id)}
                                    title="Toggle Stock"
                                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                  >
                                    {inStock ? (
                                      <ToggleRight className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <ToggleLeft className="w-4 h-4 text-slate-500" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COLOR & SIZE BUILDER */}
          {activeTab === 'builder' && (
            <div className="space-y-6">
              {/* Step 1: Colors Selection */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                    Step 1: Choose Available Colors
                  </h4>
                </div>

                {/* Color Swatch Selector */}
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((col) => {
                    const isSelected = selectedColors.some(
                      (c) => c.name.toLowerCase() === col.name.toLowerCase()
                    );
                    return (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => toggleColor(col)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${isSelected
                          ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-xs'
                          : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500'
                          }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: col.code }}
                        />
                        <span>{col.name}</span>
                        {isSelected && <span className="text-emerald-400">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Adder */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <input
                    type="color"
                    value={customColorCode}
                    onChange={(e) => setCustomColorCode(e.target.value)}
                    className="w-9 h-9 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0.5"
                    title="Select color swatch"
                  />
                  <input
                    type="text"
                    value={customColorName}
                    onChange={(e) => setCustomColorName(e.target.value)}
                    placeholder="Custom Color Name (e.g., Lavender Purple)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomColor}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add Color
                  </button>
                </div>
              </div>

              {/* Step 2: Sizes Selection */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                    Step 2: Choose Available Sizes
                  </h4>
                </div>

                {/* Apparel Presets */}
                <div>
                  <span className="text-xs text-slate-400 block mb-2 font-medium">Clothing & Apparel:</span>
                  <div className="flex flex-wrap gap-2">
                    {APPAREL_SIZES.map((sz) => {
                      const isSelected = selectedSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => toggleSize(sz)}
                          className={`w-11 h-9 rounded-xl font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${isSelected
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                            : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500'
                            }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shoes Presets */}
                <div>
                  <span className="text-xs text-slate-400 block mb-2 font-medium">Footwear & Shoes (EU):</span>
                  <div className="flex flex-wrap gap-2">
                    {SHOE_SIZES.map((sz) => {
                      const isSelected = selectedSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => toggleSize(sz)}
                          className={`w-11 h-9 rounded-xl font-mono font-bold text-xs flex items-center justify-center border transition-all cursor-pointer ${isSelected
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-xs'
                            : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:border-slate-500'
                            }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Size Input */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                  <input
                    type="text"
                    value={customSizeInput}
                    onChange={(e) => setCustomSizeInput(e.target.value)}
                    placeholder="Custom Size (e.g. Free Size, 250g, 1 Litre)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSize}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    + Add Size
                  </button>
                </div>
              </div>

              {/* Step 3: Generate Combinations Button */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-800/60">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Generate Variant Matrix</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedColors.length} colors × {selectedSizes.length} sizes ={' '}
                    <strong>{selectedColors.length * selectedSizes.length} total combinations</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateCombinations}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Generate Combinations
                </button>
              </div>

              {/* Step 4: Combinations Table */}
              {builderVariants.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Review & Customize ({builderVariants.length} Variants)
                    </h5>
                    <button
                      type="button"
                      onClick={() => setBuilderVariants([])}
                      className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-2xl max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800 text-slate-400 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Color</th>
                          <th className="py-2.5 px-3">Size</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Price (Rs.)</th>
                          <th className="py-2.5 px-3">Stock Qty</th>
                          <th className="py-2.5 px-3 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {builderVariants.map((row, idx) => (
                          <tr key={`${row.color}-${row.size}-${idx}`} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                                  style={{ backgroundColor: row.color_code }}
                                />
                                <span className="font-semibold text-white">{row.color}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 font-bold text-emerald-300">{row.size}</td>
                            <td className="py-2 px-3 font-mono text-slate-400">{row.sku}</td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                value={row.price}
                                onChange={(e) => {
                                  const updated = [...builderVariants];
                                  updated[idx].price = Number(e.target.value);
                                  setBuilderVariants(updated);
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min={0}
                                value={row.stock}
                                onChange={(e) => {
                                  const updated = [...builderVariants];
                                  updated[idx].stock = Number(e.target.value);
                                  setBuilderVariants(updated);
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setBuilderVariants(builderVariants.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={savingBuilder}
                      onClick={handleSaveVariants}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                    >
                      {savingBuilder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save Variants to Product</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
