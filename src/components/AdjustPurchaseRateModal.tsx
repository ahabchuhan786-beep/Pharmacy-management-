import React, { useState, useEffect } from "react";
import { Product } from "../types";
import {
  X,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Package,
  Sparkles,
  Calculator,
  ArrowRight,
  AlertCircle,
  Tag,
} from "lucide-react";

interface AdjustPurchaseRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  availableStock?: number;
  onSave: (productId: string, newCostPrice: number, newSalePrice?: number) => void;
}

export const AdjustPurchaseRateModal: React.FC<AdjustPurchaseRateModalProps> = ({
  isOpen,
  onClose,
  product,
  availableStock = 0,
  onSave,
}) => {
  const currentCost = product?.costPrice !== undefined 
    ? product.costPrice 
    : Math.round((product?.price || 0) * 0.78);

  const currentSale = product?.price || 0;

  const [purchaseRate, setPurchaseRate] = useState<number | string>(currentCost);
  const [saleRate, setSaleRate] = useState<number | string>(currentSale);
  const [alsoUpdateSalePrice, setAlsoUpdateSalePrice] = useState(false);
  const [notes, setNotes] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (product) {
      const initialCost = product.costPrice !== undefined 
        ? product.costPrice 
        : Math.round((product.price || 0) * 0.78);
      setPurchaseRate(initialCost);
      setSaleRate(product.price || 0);
      setAlsoUpdateSalePrice(false);
      setNotes("");
      setSaveSuccess(false);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const numPurchaseRate = Math.max(0, Number(purchaseRate) || 0);
  const numSaleRate = Math.max(0, Number(saleRate) || 0);

  // Profit & Margin calculations
  const profitPerUnit = numSaleRate - numPurchaseRate;
  const marginPercent = numSaleRate > 0 ? ((profitPerUnit / numSaleRate) * 100) : 0;
  const markupPercent = numPurchaseRate > 0 ? ((profitPerUnit / numPurchaseRate) * 100) : 0;
  const totalStockCostValue = availableStock * numPurchaseRate;
  const totalStockRetailValue = availableStock * numSaleRate;
  const totalStockProfit = availableStock * profitPerUnit;

  const handleApplyPreset = (ratio: number) => {
    const calcCost = Math.round(numSaleRate * ratio);
    setPurchaseRate(calcCost);
  };

  const handleAdjustByPercent = (percentChange: number) => {
    const current = Number(purchaseRate) || currentCost;
    const adjusted = Math.max(0, Math.round(current * (1 + percentChange / 100)));
    setPurchaseRate(adjusted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numPurchaseRate < 0) return;

    onSave(
      product.id,
      numPurchaseRate,
      alsoUpdateSalePrice ? numSaleRate : undefined
    );

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div
      id="adjust-purchase-rate-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-emerald-700/80 text-emerald-100 rounded">
                  {product.productCode || "PRD-000"}
                </span>
                <span className="text-xs text-teal-200 font-medium">{product.category}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                Adjust Purchase Rate (خرید ریٹ)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Info Bar */}
        <div className="bg-emerald-50/60 border-b border-emerald-100 px-5 py-3 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 font-medium">Product: </span>
            <span className="font-bold text-slate-800 text-sm">{product.name}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-emerald-200 font-semibold text-emerald-800">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>Stock: {availableStock.toLocaleString()} units</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Current Comparison Box */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Purchase Rate
              </span>
              <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                Rs. {currentCost.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current Sale Rate
              </span>
              <div className="text-base font-bold font-mono text-blue-700 mt-0.5">
                Rs. {currentSale.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* New Purchase Rate Input */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                New Purchase Rate (خرید ریٹ فی یونٹ) *
              </span>
              <span className="text-[11px] font-mono text-emerald-600">PKR per unit</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-sm">
                Rs.
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value)}
                placeholder="0.00"
                className="w-full pl-11 pr-3 py-2.5 border-2 border-emerald-500 rounded-xl text-slate-900 font-bold font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/20"
                autoFocus
              />
            </div>
          </div>

          {/* Quick preset percentage buttons */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Quick Calculation Presets (% of Sale Rate)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "70%", ratio: 0.7 },
                { label: "75%", ratio: 0.75 },
                { label: "78%", ratio: 0.78 },
                { label: "80%", ratio: 0.8 },
                { label: "85%", ratio: 0.85 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleApplyPreset(btn.ratio)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg transition-colors cursor-pointer"
                >
                  {btn.label} (Rs. {Math.round(numSaleRate * btn.ratio)})
                </button>
              ))}

              <button
                type="button"
                onClick={() => handleAdjustByPercent(5)}
                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Increase cost by 5%"
              >
                +5%
              </button>
              <button
                type="button"
                onClick={() => handleAdjustByPercent(-5)}
                className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Decrease cost by 5%"
              >
                -5%
              </button>
            </div>
          </div>

          {/* Optional: Also Update Sale Rate Toggle */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold select-none">
              <input
                type="checkbox"
                checked={alsoUpdateSalePrice}
                onChange={(e) => setAlsoUpdateSalePrice(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span>Also update Master Sale Rate (فروخت ریٹ)</span>
            </label>

            {alsoUpdateSalePrice && (
              <div className="relative pl-6">
                <span className="absolute left-9 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-xs">
                  Rs.
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saleRate}
                  onChange={(e) => setSaleRate(e.target.value)}
                  placeholder="New Sale Rate"
                  className="w-full pl-16 pr-3 py-2 border border-blue-400 rounded-lg text-slate-800 font-bold font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Live Profit & Margin Impact Analysis */}
          <div className="p-3.5 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <span className="flex items-center gap-1 text-slate-700">
                <Calculator className="w-3.5 h-3.5 text-blue-600" />
                Profit & Margin Impact
              </span>
              <span className={profitPerUnit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                {marginPercent.toFixed(1)}% Margin
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Profit / Unit</span>
                <span className={`text-xs font-bold ${profitPerUnit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {profitPerUnit >= 0 ? "+" : ""}Rs. {profitPerUnit.toFixed(2)}
                </span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Markup</span>
                <span className="text-xs font-bold text-blue-700">
                  {markupPercent.toFixed(1)}%
                </span>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Stock Cost Value</span>
                <span className="text-xs font-bold text-slate-800">
                  Rs. {Math.round(totalStockCostValue).toLocaleString()}
                </span>
              </div>
            </div>

            {profitPerUnit < 0 && (
              <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-medium pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Warning: Purchase rate is higher than sale rate (loss per unit).</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveSuccess}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Saved Successfully!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Purchase Rate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
