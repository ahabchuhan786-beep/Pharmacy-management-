import React, { useState, useMemo } from "react";
import { Product, ProductHistoryEntry } from "../types";
import { useApp } from "../context/AppContext";
import * as XLSX from "xlsx";
import { downloadBinaryBase64Safely } from "../utils/pdfGenerator";
import {
  Clock,
  X,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  SlidersHorizontal,
  Download,
  Calendar,
  Building,
  User,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
} from "lucide-react";

interface ProductHistoryModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAdjustStock?: (product: Product) => void;
}

export const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({
  product,
  isOpen,
  onClose,
  onOpenAdjustStock,
}) => {
  const { getProductMovementHistory, getItemAvailableStock, settings, setActiveNavTab } = useApp();
  const [filterType, setFilterType] = useState<string>("all");

  const stockInfo = useMemo(() => {
    if (!product) return null;
    return getItemAvailableStock(product.id, product.name);
  }, [product, getItemAvailableStock]);

  const history = useMemo(() => {
    if (!product) return [];
    return getProductMovementHistory(product.id || product.name);
  }, [product, getProductMovementHistory]);

  const filteredHistory = useMemo(() => {
    if (filterType === "all") return history;
    if (filterType === "Purchase") return history.filter((h) => h.type === "Purchase");
    if (filterType === "Sale") return history.filter((h) => h.type === "Sale");
    if (filterType === "Return") return history.filter((h) => h.type.includes("Return"));
    if (filterType === "Adjustment") return history.filter((h) => h.type === "Stock Adjustment");
    return history;
  }, [history, filterType]);

  // Aggregate stats
  const totalPurchasedUnits = history
    .filter((h) => h.type === "Purchase")
    .reduce((sum, h) => sum + h.quantity, 0);

  const totalSoldUnits = history
    .filter((h) => h.type === "Sale")
    .reduce((sum, h) => sum + h.quantity, 0);

  const totalReturnedUnits = history
    .filter((h) => h.type.includes("Return"))
    .reduce((sum, h) => sum + (h.type === "Sale Return" ? h.quantity : -h.quantity), 0);

  const totalAdjustedUnits = history
    .filter((h) => h.type === "Stock Adjustment")
    .reduce((sum, h) => sum + h.quantityChange, 0);

  if (!isOpen || !product) return null;

  const handleExportExcel = async () => {
    const exportData = filteredHistory.map((h, idx) => ({
      "#": idx + 1,
      Date: h.date,
      "Movement Type": h.type,
      "Document / Reference #": h.referenceNumber,
      "Party (Customer / Supplier)": h.partyName,
      "Qty Change": h.quantityChange > 0 ? `+${h.quantityChange}` : `${h.quantityChange}`,
      "Unit Rate (PKR)": h.rate,
      "Total Amount (PKR)": h.amount,
      Batch: h.batch || "",
      Expiry: h.exp || "",
      "Notes / Reason": h.reason || h.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Movement");
    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    await downloadBinaryBase64Safely(
      base64,
      `${product.productCode || "Product"}_${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_History.xlsx`
    );
  };

  return (
    <div
      id="product-history-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                  {product.productCode || "PRD-000"}
                </span>
                <span className="text-xs text-slate-300 font-medium">{product.category}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5">
                {product.name}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="text-emerald-300 font-mono font-semibold">
                  Purchase Rate: Rs. {(product.costPrice !== undefined ? product.costPrice : Math.round(product.price * 0.78)).toLocaleString()}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-blue-300 font-mono font-semibold">
                  Master Sale: Rs. {Number(product.price || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Stock & Movement KPI Summary Banner */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Available Stock */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Available Stock</span>
                <Package className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {(stockInfo?.availableStock ?? 0).toLocaleString()}
              </div>
              <span
                className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  (stockInfo?.availableStock ?? 0) <= 0
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {stockInfo?.status || "Stock Active"}
              </span>
            </div>

            {/* Total Purchases Inward */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Purchases Inward</span>
                <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-lg font-bold text-amber-700 mt-1">
                +{totalPurchasedUnits.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Total received units</span>
            </div>

            {/* Total Sales Outward */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Sales Outward</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-blue-700 mt-1">
                -{totalSoldUnits.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Sold to customers</span>
            </div>

            {/* Returns */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Net Returns</span>
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-lg font-bold text-rose-700 mt-1">
                {totalReturnedUnits >= 0 ? `+${totalReturnedUnits}` : totalReturnedUnits}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Restocked / Returned</span>
            </div>

            {/* Stock Adjustments */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Adjustments</span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-emerald-700 mt-1">
                {totalAdjustedUnits >= 0 ? `+${totalAdjustedUnits}` : totalAdjustedUnits}
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Audit reconciliation</span>
            </div>
          </div>
        </div>

        {/* Filter Bar & Export Actions */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-white shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-400 font-semibold mr-1 text-[11px]">Filter:</span>
            {[
              { id: "all", label: `All (${history.length})` },
              { id: "Purchase", label: `Purchases (${history.filter((h) => h.type === "Purchase").length})` },
              { id: "Sale", label: `Sales (${history.filter((h) => h.type === "Sale").length})` },
              { id: "Return", label: `Returns (${history.filter((h) => h.type.includes("Return")).length})` },
              { id: "Adjustment", label: `Adjustments (${history.filter((h) => h.type === "Stock Adjustment").length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterType === tab.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Export complete history to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export History</span>
            </button>

            {onOpenAdjustStock && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAdjustStock(product);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Adjust Stock (+/-)</span>
              </button>
            )}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No transaction records found for this filter</p>
              <p className="text-xs text-slate-400 mt-1">
                Any future purchases, sales, returns, or adjustments will be automatically recorded here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-white uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Activity Type</th>
                    <th className="py-2.5 px-3 font-semibold">Document #</th>
                    <th className="py-2.5 px-3 font-semibold">Party Name</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Qty Change</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Rate (PKR)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Batch / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((entry) => {
                    const isPositive = entry.quantityChange > 0;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              entry.type === "Purchase"
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : entry.type === "Sale"
                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                : entry.type === "Sale Return"
                                ? "bg-purple-50 text-purple-800 border border-purple-200"
                                : entry.type === "Purchase Return"
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3 text-blue-600" />
                            )}
                            <span>{entry.type}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {entry.referenceNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {entry.partyName || "Direct / Internal"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={
                              isPositive ? "text-emerald-700" : "text-rose-600 font-bold"
                            }
                          >
                            {isPositive ? `+${entry.quantityChange}` : `${entry.quantityChange}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          Rs. {entry.rate.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          Rs. {entry.amount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title={entry.notes || entry.reason}>
                          {entry.batch ? `Batch: ${entry.batch}` : ""}
                          {entry.notes || entry.reason ? ` • ${entry.notes || entry.reason}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500">
            Total records: <strong>{filteredHistory.length}</strong> transactions
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
