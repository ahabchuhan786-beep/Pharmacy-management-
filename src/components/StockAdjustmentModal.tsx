import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Product, StockAdjustment, StockAdjustmentType, StockAdjustmentReason } from "../types";
import {
  X,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Calendar,
  User,
  FileText,
  DollarSign,
  Info,
} from "lucide-react";

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProduct?: Product | null;
  defaultType?: StockAdjustmentType;
}

const ADJUSTMENT_REASONS: Array<{ value: StockAdjustmentReason; label: string }> = [
  { value: "Physical Count / Audit Reconcile", label: "Physical Count / Audit Reconcile" },
  { value: "Opening Stock / Initial Setup" as any, label: "Opening Stock / Initial Balance" },
  { value: "Found Stock / Unrecorded Surplus", label: "Found Stock / Unrecorded Surplus" },
  { value: "Damaged / Broken in Store", label: "Damaged / Broken in Store" },
  { value: "Expired / Near Expiry Discard", label: "Expired / Near Expiry Discard" },
  { value: "Correction / Opening Stock", label: "Inventory Entry Correction" },
  { value: "Theft / Unexplained Shortage", label: "Theft / Unexplained Shortage" },
  { value: "Sample / Marketing Issue", label: "Sample / Doctor Demo Dispensed" },
  { value: "Customer Return Unbilled", label: "Customer Return (Unbilled/Manual)" },
  { value: "Other", label: "Other / Custom Reason" },
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  preselectedProduct,
  defaultType = "Increase",
}) => {
  const {
    currentProducts,
    getItemAvailableStock,
    saveStockAdjustment,
    generateNextAdjustmentNumber,
    settings,
  } = useApp();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(preselectedProduct || null);
  const [productSearch, setProductSearch] = useState("");
  const [type, setType] = useState<StockAdjustmentType>(defaultType);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [reason, setReason] = useState<string>("Physical Count / Audit Reconcile");
  const [unitCost, setUnitCost] = useState<number | string>(0);
  const [batch, setBatch] = useState("");
  const [exp, setExp] = useState("");
  const [adjustedBy, setAdjustedBy] = useState(settings.defaultSalesman || "Adnan (In-charge)");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmCapToZero, setConfirmCapToZero] = useState(false);

  // Sync preselected product when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setConfirmCapToZero(false);
      setType(defaultType);
      if (preselectedProduct) {
        setSelectedProduct(preselectedProduct);
        const estCost =
          preselectedProduct.costPrice !== undefined
            ? preselectedProduct.costPrice
            : Math.round(preselectedProduct.price * 0.78);
        setUnitCost(estCost);
      } else {
        setSelectedProduct(null);
        setProductSearch("");
        setUnitCost(0);
      }
      setQuantity(1);
      setReason(defaultType === "Increase" ? "Physical Count / Audit Reconcile" : "Damaged / Broken in Store");
      setAdjustedBy(settings.defaultSalesman || "Adnan (In-charge)");
      setNotes("");
      setBatch("");
      setExp("");
    }
  }, [isOpen, preselectedProduct, defaultType, settings.defaultSalesman]);

  // Current stock of selected product
  const currentStockInfo = useMemo(() => {
    if (!selectedProduct) return { availableStock: 0, totalPurchased: 0, totalSold: 0, status: "Out of Stock" };
    return getItemAvailableStock(selectedProduct.id, selectedProduct.name);
  }, [selectedProduct, getItemAvailableStock]);

  const numQty = Math.max(0, Number(quantity) || 0);
  const currentAvailable = currentStockInfo.availableStock;
  const projectedStock =
    type === "Increase"
      ? currentAvailable + numQty
      : Math.max(0, currentAvailable - numQty);

  const isZeroStockDecrease = type === "Decrease" && currentAvailable <= 0;
  const isDeductingMoreThanAvailable =
    type === "Decrease" && currentAvailable > 0 && numQty > currentAvailable;

  // Filtered products for selector
  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return currentProducts.slice(0, 30);
    const q = productSearch.toLowerCase().trim();
    return currentProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.productCode && p.productCode.toLowerCase().includes(q)) ||
          (p.category && typeof p.category === "string" && p.category.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [currentProducts, productSearch]);

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setProductSearch("");
    setConfirmCapToZero(false);
    setError(null);
    const estCost = prod.costPrice !== undefined ? prod.costPrice : Math.round(prod.price * 0.78);
    setUnitCost(estCost);
  };

  const handleApplyQuickQty = (add: number) => {
    const cur = Number(quantity) || 0;
    setQuantity(cur + add);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProduct) {
      setError("Please select a product to adjust.");
      return;
    }

    if (numQty <= 0) {
      setError("Please enter a valid adjustment quantity greater than 0.");
      return;
    }

    if (isZeroStockDecrease) {
      setError(
        `Available stock for "${selectedProduct.name}" is already 0 units. You cannot decrease stock below 0.`
      );
      return;
    }

    if (isDeductingMoreThanAvailable && !confirmCapToZero) {
      setError(
        `Requested decrease (${numQty}) exceeds current stock (${currentAvailable} units). Tick the confirmation checkbox below to reduce all ${currentAvailable} remaining units to 0.`
      );
      return;
    }

    const effectiveQty = isDeductingMoreThanAvailable ? currentAvailable : numQty;
    const numCost = Math.max(0, Number(unitCost) || 0);
    const totalVal = Math.round(effectiveQty * numCost);

    const adjustmentRecord: StockAdjustment = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      adjustmentNumber: generateNextAdjustmentNumber(),
      date: new Date().toISOString().split("T")[0],
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productCode: selectedProduct.productCode,
      category: selectedProduct.category,
      type,
      quantity: effectiveQty,
      previousStock: currentAvailable,
      newStock: projectedStock,
      unitCost: numCost,
      totalValue: totalVal,
      batch: batch.trim() || undefined,
      exp: exp.trim() || undefined,
      reason,
      adjustedBy: adjustedBy.trim() || "Staff",
      notes: isDeductingMoreThanAvailable
        ? `${notes.trim() ? notes.trim() + " " : ""}(Requested -${numQty}, capped at available ${currentAvailable})`
        : notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = saveStockAdjustment(adjustmentRecord);
    if (!res.success) {
      setError(res.error || "Failed to save stock adjustment.");
      return;
    }

    // Sync with backend API
    fetch("/api/stock-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adjustmentRecord),
    }).catch((err) => console.warn("Backend stock adjustment notice:", err));

    setSuccessMsg(
      `Successfully adjusted stock for "${selectedProduct.name}" by ${type === "Increase" ? "+" : "-"}${effectiveQty} units. New available stock is now ${projectedStock}.`
    );

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                type === "Increase"
                  ? "bg-emerald-600 shadow-emerald-200"
                  : "bg-rose-600 shadow-rose-200"
              }`}
            >
              {type === "Increase" ? (
                <PlusCircle className="w-5 h-5" />
              ) : (
                <MinusCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Stock Adjustment</span>
              </h3>
              <p className="text-xs text-slate-500">
                Directly adjust physical inventory count, damage write-offs, or unrecorded surplus.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* Type Toggle: Increase vs Decrease */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setType("Increase");
                  if (reason === "Damaged / Broken in Store" || reason === "Expired / Near Expiry Discard") {
                    setReason("Physical Count / Audit Reconcile");
                  }
                }}
                className={`py-3 px-4 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === "Increase"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <PlusCircle className={`w-4 h-4 ${type === "Increase" ? "text-emerald-600" : "text-slate-400"}`} />
                <span>+ Increase Stock</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setType("Decrease");
                  if (reason === "Physical Count / Audit Reconcile" || reason === "Found Stock / Unrecorded Surplus") {
                    setReason("Damaged / Broken in Store");
                  }
                }}
                className={`py-3 px-4 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === "Decrease"
                    ? "bg-rose-50 border-rose-500 text-rose-800 shadow-xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                <MinusCircle className={`w-4 h-4 ${type === "Decrease" ? "text-rose-600" : "text-slate-400"}`} />
                <span>- Decrease Stock</span>
              </button>
            </div>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Product
            </label>

            {selectedProduct ? (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedProduct.name}</span>
                    {selectedProduct.productCode && (
                      <span className="text-[11px] font-mono bg-slate-200 px-1.5 py-0.2 rounded text-slate-600">
                        {selectedProduct.productCode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{selectedProduct.category}</span>
                    <span>•</span>
                    <span>Retail: Rs. {selectedProduct.price}</span>
                  </div>
                </div>

                {!preselectedProduct && (
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 cursor-pointer"
                  >
                    Change Item
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search medicines or surgical items..."
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white shadow-xs">
                  {searchResults.map((p) => {
                    const st = getItemAvailableStock(p.id, p.name);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="p-2.5 hover:bg-blue-50/70 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500">{p.category}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-700">
                            Stock: {st.availableStock}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Current Stock vs New Stock Calculation Pill Banner */}
          {selectedProduct && (
            <div className="p-3.5 bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl text-white shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Recorded Current Stock</span>
                <span className="text-lg font-mono font-bold text-white">{currentAvailable} units</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1 bg-slate-700/60 rounded-lg text-xs font-mono font-semibold">
                <span className={type === "Increase" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {type === "Increase" ? `+ ${numQty}` : `- ${numQty}`}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-white font-bold">{projectedStock} units</span>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">New Stock Balance</span>
                <span
                  className={`text-lg font-mono font-bold ${
                    projectedStock > 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {projectedStock} units
                </span>
              </div>
            </div>
          )}

          {/* Quantity & Quick Increment Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quantity to Adjust <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1">
                {[1, 5, 10, 25, 50, 100].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleApplyQuickQty(inc)}
                    className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer active:scale-95 transition-all"
                  >
                    +{inc}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            {isZeroStockDecrease && (
              <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 mt-1 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Available stock is already 0 units — cannot decrease below 0. Switch to &ldquo;Increase Stock (+)&rdquo; or record a Purchase first.</span>
              </p>
            )}

            {isDeductingMoreThanAvailable && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 mt-1">
                <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>
                    Requested decrease ({numQty} units) exceeds current stock ({currentAvailable} units). Only {currentAvailable} units will be deducted so stock becomes 0 without affecting future purchases.
                  </span>
                </p>
                <label className="flex items-center gap-2 text-[11px] font-bold text-amber-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmCapToZero}
                    onChange={(e) => setConfirmCapToZero(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Confirm reducing remaining {currentAvailable} units to 0</span>
                </label>
              </div>
            )}
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Adjustment <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Cost Rate & Valuation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Unit Cost Rate (Rs.)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs.</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Total value: Rs. {Math.round(numQty * (Number(unitCost) || 0)).toLocaleString()}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Adjusted By
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={adjustedBy}
                  onChange={(e) => setAdjustedBy(e.target.value)}
                  placeholder="Staff / In-charge name"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Optional Batch and Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Batch No (Optional)
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. B-992"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Expiry Date (Optional)
              </label>
              <input
                type="text"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                placeholder="e.g. 12/28"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Adjustment Notes & Justification
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Provide reason, inspection notes, voucher # or remarks..."
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
              type === "Increase"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
            }`}
          >
            {type === "Increase" ? (
              <PlusCircle className="w-4 h-4" />
            ) : (
              <MinusCircle className="w-4 h-4" />
            )}
            <span>
              Confirm {type === "Increase" ? "Stock Increase" : "Stock Decrease"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
