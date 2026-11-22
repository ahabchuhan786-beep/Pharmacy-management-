import React, { useEffect } from "react";
import { AlertTriangle, Plus, Copy, X, Layers, ArrowUpRight } from "lucide-react";

interface DuplicateItemAlertModalProps {
  isOpen: boolean;
  productName: string;
  existingQuantity: number;
  newQuantity: number;
  existingLineNumber?: number;
  rate?: number;
  category?: string;
  contextType?: "order" | "purchase";
  onMergeQuantity: () => void;
  onAddAsSeparate: () => void;
  onCancel: () => void;
}

export const DuplicateItemAlertModal: React.FC<DuplicateItemAlertModalProps> = ({
  isOpen,
  productName,
  existingQuantity,
  newQuantity,
  existingLineNumber,
  rate,
  category,
  contextType = "order",
  onMergeQuantity,
  onAddAsSeparate,
  onCancel,
}) => {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const totalAfterMerge = existingQuantity + newQuantity;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in-95 duration-150 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertTriangle className="w-6 h-6 text-amber-600 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  Duplicate Item Detected!
                </h3>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Duplicate Warning
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                This item is already listed in your current {contextType === "order" ? "sales order" : "purchase bill"}.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Comparison Card */}
        <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-800 font-bold uppercase tracking-wider">
                Product Name
              </div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {productName}
              </div>
              {category && (
                <div className="text-[11px] text-slate-500">{category}</div>
              )}
            </div>
            {rate !== undefined && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Rate</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  Rs. {rate.toLocaleString("en-PK")}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-center">
            <div className="bg-white p-2 rounded-lg border border-amber-200">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                {existingLineNumber ? `Line #${existingLineNumber}` : "Already In List"}
              </span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {existingQuantity} units
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-blue-200">
              <span className="text-[10px] text-blue-600 block font-semibold uppercase">
                New Quantity
              </span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                +{newQuantity} units
              </span>
            </div>

            <div className="bg-white p-2 rounded-lg border border-emerald-200">
              <span className="text-[10px] text-emerald-600 block font-semibold uppercase">
                If Merged
              </span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                {totalAfterMerge} units
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          How would you like to handle this duplicate entry? You can increase the quantity of the existing line, or keep it as a separate row (e.g. for different batch/scheme):
        </p>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {/* Option 1: Merge Quantities (Recommended) */}
          <button
            type="button"
            onClick={onMergeQuantity}
            className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs transition-all flex items-center justify-between font-semibold text-xs cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/50 flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="font-bold">
                  Increase Existing Quantity to {totalAfterMerge} units
                </div>
                <div className="text-[11px] text-emerald-100 font-normal">
                  Merge with existing line quantity
                </div>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </button>

          {/* Option 2: Add as Separate Row */}
          <button
            type="button"
            onClick={onAddAsSeparate}
            className="w-full p-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-xl transition-all flex items-center justify-between text-xs font-semibold cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600">
                <Copy className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="font-bold">Add as Separate Line Item</div>
                <div className="text-[11px] text-slate-500 font-normal">
                  Keep both entries separately (e.g. different batch or bonus)
                </div>
              </div>
            </div>
          </button>

          {/* Option 3: Cancel */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-center"
          >
            Cancel / Don't Add
          </button>
        </div>
      </div>
    </div>
  );
};
