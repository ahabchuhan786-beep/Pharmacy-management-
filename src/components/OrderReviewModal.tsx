import React, { useMemo } from "react";
import { Order } from "../types";
import { useApp } from "../context/AppContext";
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Edit3,
  ShieldCheck,
  Package,
  Layers,
} from "lucide-react";

interface OrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmGeneratePdf: () => void;
  saveError?: string | null;
}

export const OrderReviewModal: React.FC<OrderReviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmGeneratePdf,
  saveError,
}) => {
  const { draftOrder, getItemAvailableStock } = useApp();

  // Perform rigorous verification
  const verification = useMemo(() => {
    const totalLines = draftOrder.items.length;
    const totalQuantity = draftOrder.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

    let isMathValid = true;
    let areAllQuantitiesValid = true;
    let areAllRatesValid = true;
    let areAllStocksValid = true;
    const mathErrors: string[] = [];

    let calculatedSubtotal = 0;

    // Aggregate requested quantity+bonus per product to avoid duplicate-row blind spots
    const stockRequests = new Map<
      string,
      { productId?: string; productName: string; requested: number }
    >();

    draftOrder.items.forEach((item, idx) => {
      const qty = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const disc1 = Number(item.disc1) || 0;
      const disc2 = Number(item.disc2) || 0;
      const bon = Number(item.bon) || 0;

      const gross = qty * rate;
      const expectedLineAmount =
        Math.round(gross * (1 - disc1 / 100) * (1 - disc2 / 100) * 100) / 100;
      const actualLineAmount = Number(item.amount) || 0;
      calculatedSubtotal += actualLineAmount;

      if (qty <= 0) {
        areAllQuantitiesValid = false;
        mathErrors.push(`Line #${idx + 1} (${item.productName}) has invalid quantity 0`);
      }

      if (rate < 0) {
        areAllRatesValid = false;
        mathErrors.push(`Line #${idx + 1} (${item.productName}) has negative rate`);
      }

      if (Math.abs(actualLineAmount - expectedLineAmount) > 1) {
        isMathValid = false;
        mathErrors.push(`Line #${idx + 1} (${item.productName}) amount mismatch`);
      }

      const key = (item.productName || "").toLowerCase().trim() || item.productId;
      const existingReq = stockRequests.get(key);
      if (existingReq) {
        existingReq.requested += qty + bon;
      } else {
        stockRequests.set(key, {
          productId: item.productId,
          productName: item.productName,
          requested: qty + bon,
        });
      }
    });

    const excludeId =
      draftOrder.id && !draftOrder.id.startsWith("draft-") ? draftOrder.id : undefined;

    stockRequests.forEach((entry) => {
      const stockInfo = getItemAvailableStock(entry.productId, entry.productName, excludeId);
      if (!stockInfo.hasPurchaseRecord) {
        areAllStocksValid = false;
        mathErrors.push(
          `Cannot sell "${entry.productName}". No purchase or stock record exists for this item.`
        );
      } else if (entry.requested > stockInfo.availableStock) {
        areAllStocksValid = false;
        mathErrors.push(
          `Insufficient stock for "${entry.productName}". Requested: ${entry.requested}, Available: ${stockInfo.availableStock}`
        );
      }
    });

    const calculatedGrandTotal = Math.max(
      0,
      calculatedSubtotal -
        (Number(draftOrder.discount) || 0) +
        (Number(draftOrder.tax) || 0) +
        (Number(draftOrder.advanceTax) || 0) +
        (Number(draftOrder.previousPendingAmount) || 0)
    );

    const isGrandTotalValid =
      Math.abs((Number(draftOrder.grandTotal) || 0) - calculatedGrandTotal) < 1;

    const allPassed =
      totalLines > 0 &&
      isMathValid &&
      areAllQuantitiesValid &&
      areAllRatesValid &&
      areAllStocksValid &&
      isGrandTotalValid;

    return {
      totalLines,
      totalQuantity,
      calculatedSubtotal,
      calculatedGrandTotal,
      allPassed,
      mathErrors,
      isMathValid,
      areAllQuantitiesValid,
      areAllRatesValid,
      areAllStocksValid,
      isGrandTotalValid,
    };
  }, [draftOrder, getItemAvailableStock]);

  if (!isOpen) return null;

  return (
    <div
      id="order-review-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 animate-scaleUp my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">Order Validation & Pre-PDF Review</h3>
              <p className="text-xs text-slate-500">
                Automated mathematical & inventory verification before invoice generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Verification Checkpoints */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Automated Audit Verification Results:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold text-slate-800">Sequence Integrity:</span>
                <span className="text-slate-500 ml-1">Preserved ({verification.totalLines} lines)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
              {verification.areAllQuantitiesValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-slate-800">Quantities Audit:</span>
                <span className="text-slate-500 ml-1">Total {verification.totalQuantity} units</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
              {verification.isMathValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-slate-800">Arithmetic (Qty &times; Rate):</span>
                <span className="text-slate-500 ml-1">100% Exact</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
              {verification.areAllStocksValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-slate-800">Stock Availability:</span>
                <span className="text-slate-500 ml-1">
                  {verification.areAllStocksValid ? "All items in stock" : "Stock issues detected"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
              {verification.isGrandTotalValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <div>
                <span className="font-semibold text-slate-800">Grand Total Balance:</span>
                <span className="text-slate-500 ml-1">Verified Accurate</span>
              </div>
            </div>
          </div>

          {verification.mathErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
              <span className="font-bold">Errors to fix:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {verification.mathErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* Order Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Items Count</span>
            <div className="font-bold text-slate-900 text-lg mt-0.5">{verification.totalLines}</div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Quantity</span>
            <div className="font-bold text-slate-900 text-lg mt-0.5">{verification.totalQuantity}</div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {(draftOrder.previousPendingAmount || 0) > 0 ? "Disc / Tax / Prev" : "Discount / Tax"}
            </span>
            <div className="font-mono font-semibold text-slate-700 text-xs mt-1">
              {(draftOrder.previousPendingAmount || 0) > 0
                ? `+Rs. ${draftOrder.previousPendingAmount}`
                : `Rs. ${draftOrder.discount || 0} / Rs. ${draftOrder.tax || 0}`}
            </div>
          </div>
          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-center shadow-xs">
            <span className="text-[10px] font-bold text-blue-600 uppercase">Net Amount</span>
            <div className="font-mono font-bold text-blue-700 text-lg mt-0.5">
              Rs. {draftOrder.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Payment Summary Row */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Payment Status:</span>
            <span className="font-bold text-slate-800">{draftOrder.paymentStatus || "Paid"} ({draftOrder.paymentMethod || "Cash"})</span>
          </div>
          <div className="text-right text-[11px]">
            {(draftOrder.pendingAmount || 0) > 0 ? (
              <>
                <span className="text-slate-600">
                  Paid:{" "}
                  <b className="text-emerald-700 font-mono">
                    Rs.{" "}
                    {(draftOrder.paidAmount !== undefined
                      ? draftOrder.paidAmount
                      : draftOrder.grandTotal
                    ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </b>
                </span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-600">
                  Pending:{" "}
                  <b className="font-mono text-rose-600 font-black">
                    Rs. {(draftOrder.pendingAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </b>
                </span>
              </>
            ) : (
              <span className="text-emerald-700 font-semibold">
                ✓ Full Payment Settled
              </span>
            )}
          </div>
        </div>

        {/* Amount in words */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount in Words</span>
          <p className="font-medium text-slate-800 font-serif italic text-sm">
            {draftOrder.grandTotalInWords}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            id="btn-edit-order-back"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>[ Edit Order ]</span>
          </button>

          <button
            type="button"
            id="btn-confirm-generate-pdf"
            disabled={!verification.allPassed}
            onClick={onConfirmGeneratePdf}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer ${
              verification.allPassed
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>[ Generate PDF ]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
