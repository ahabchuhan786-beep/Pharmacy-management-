import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { StockAdjustment, StockAdjustmentType } from "../types";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import * as XLSX from "xlsx";
import { downloadBinaryBase64Safely } from "../utils/pdfGenerator";
import {
  SlidersHorizontal,
  PlusCircle,
  MinusCircle,
  Search,
  Filter,
  Download,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Printer,
  FileText,
  AlertCircle,
  CheckCircle2,
  User,
  Package,
} from "lucide-react";

export const StockAdjustmentsView: React.FC = () => {
  const {
    stockAdjustments,
    deleteStockAdjustment,
    deleteMultipleStockAdjustments,
    resetStockAdjustmentsToDefault,
    currentProducts,
    getItemAvailableStock,
    settings,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"All" | "Increase" | "Decrease">("All");
  const [selectedReason, setSelectedReason] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<StockAdjustmentType>("Increase");
  const [viewVoucher, setViewVoucher] = useState<StockAdjustment | null>(null);

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    onConfirm: () => void;
  } | null>(null);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalIncreases = 0;
    let totalDecreases = 0;
    let totalIncreaseValue = 0;
    let totalDecreaseValue = 0;

    stockAdjustments.forEach((adj) => {
      const q = Number(adj.quantity) || 0;
      const val = Number(adj.totalValue) || 0;
      if (adj.type === "Increase") {
        totalIncreases += q;
        totalIncreaseValue += val;
      } else {
        totalDecreases += q;
        totalDecreaseValue += val;
      }
    });

    return {
      totalCount: stockAdjustments.length,
      totalIncreases,
      totalDecreases,
      netUnits: totalIncreases - totalDecreases,
      totalIncreaseValue,
      totalDecreaseValue,
      netValue: totalIncreaseValue - totalDecreaseValue,
    };
  }, [stockAdjustments]);

  // Distinct reasons for filter
  const distinctReasons = useMemo(() => {
    const set = new Set<string>();
    stockAdjustments.forEach((adj) => {
      if (adj.reason) set.add(adj.reason);
    });
    return Array.from(set);
  }, [stockAdjustments]);

  // Filtered adjustments
  const filteredAdjustments = useMemo(() => {
    return stockAdjustments.filter((adj) => {
      if (selectedType !== "All" && adj.type !== selectedType) return false;
      if (selectedReason !== "All" && adj.reason !== selectedReason) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = adj.productName.toLowerCase().includes(q);
        const matchesNum = adj.adjustmentNumber.toLowerCase().includes(q);
        const matchesStaff = adj.adjustedBy?.toLowerCase().includes(q);
        const matchesNotes = adj.notes?.toLowerCase().includes(q);
        const matchesReason = adj.reason.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesStaff && !matchesNotes && !matchesReason) {
          return false;
        }
      }
      return true;
    });
  }, [stockAdjustments, selectedType, selectedReason, searchQuery]);

  // Select all checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredAdjustments.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSingle = (adj: StockAdjustment) => {
    setConfirmDelete({
      isOpen: true,
      title: "Delete Stock Adjustment",
      message: `Are you sure you want to remove this adjustment record (${adj.adjustmentNumber})? Your current inventory stock balance will be preserved and will NOT be automatically re-added.`,
      itemDescription: `${adj.productName} — ${adj.type === "Increase" ? "+" : "-"}${adj.quantity} units (${adj.reason})`,
      onConfirm: () => {
        deleteStockAdjustment(adj.id, false);
        fetch(`/api/stock-adjustments/${adj.id}`, { method: "DELETE" }).catch(() => {});
        setSelectedIds((prev) => prev.filter((i) => i !== adj.id));
        setConfirmDelete(null);
      },
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmDelete({
      isOpen: true,
      title: `Delete ${selectedIds.length} Stock Adjustments`,
      message: `Are you sure you want to remove ${selectedIds.length} selected stock adjustment records? All current inventory stock balances will be preserved without unwanted stock re-additions.`,
      onConfirm: () => {
        deleteMultipleStockAdjustments(selectedIds, false);
        selectedIds.forEach((id) => {
          fetch(`/api/stock-adjustments/${id}`, { method: "DELETE" }).catch(() => {});
        });
        setSelectedIds([]);
        setConfirmDelete(null);
      },
    });
  };

  // Export to Excel
  const handleExportExcel = async () => {
    const dataToExport = filteredAdjustments.map((adj, idx) => ({
      "S#": idx + 1,
      "Adj Number": adj.adjustmentNumber,
      Date: adj.date,
      "Product Name": adj.productName,
      Category: adj.category || "-",
      Type: adj.type,
      "Quantity Adjusted": adj.quantity,
      "Previous Stock": adj.previousStock,
      "New Stock": adj.newStock,
      "Unit Cost (Rs.)": adj.unitCost,
      "Total Value (Rs.)": adj.totalValue,
      Reason: adj.reason,
      "Adjusted By": adj.adjustedBy,
      "Batch #": adj.batch || "-",
      "Expiry Date": adj.exp || "-",
      Notes: adj.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Adjustments");
    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
    await downloadBinaryBase64Safely(base64, `Stock_Adjustments_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div id="stock-adjustments-view" className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-12 text-slate-900">
      {/* Top Header & Actions Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Inventory Ledger
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Stock Adjustments & Recounts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            Record manual stock increases (physical surplus, unrecorded deliveries) or decreases (damage, breakage, expired items) to maintain 100% accurate physical inventory balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="btn-stock-increase"
            onClick={() => {
              setModalDefaultType("Increase");
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Increase Stock</span>
          </button>

          <button
            id="btn-stock-decrease"
            onClick={() => {
              setModalDefaultType("Decrease");
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <MinusCircle className="w-4 h-4" />
            <span>- Decrease Stock</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
            title="Export filtered records to Excel spreadsheet"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Increases */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Stock Added (+)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">
                +{metrics.totalIncreases}
              </span>
              <span className="text-xs text-slate-500">units</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-mono font-medium">
              Rs. {metrics.totalIncreaseValue.toLocaleString()} value
            </span>
          </div>
        </div>

        {/* Total Decreases */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Stock Deducted (-)
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono text-rose-700">
                -{metrics.totalDecreases}
              </span>
              <span className="text-xs text-slate-500">units</span>
            </div>
            <span className="text-[10px] text-rose-600 font-mono font-medium">
              Rs. {metrics.totalDecreaseValue.toLocaleString()} written off
            </span>
          </div>
        </div>

        {/* Net Unit Movement */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Net Units Change
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`text-xl sm:text-2xl font-bold font-mono ${
                  metrics.netUnits >= 0 ? "text-blue-700" : "text-amber-700"
                }`}
              >
                {metrics.netUnits >= 0 ? `+${metrics.netUnits}` : metrics.netUnits}
              </span>
              <span className="text-xs text-slate-500">net</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Across {metrics.totalCount} adjustment records
            </span>
          </div>
        </div>

        {/* Valuation Impact */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Net Value Impact
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xs font-bold text-purple-600">Rs.</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                {metrics.netValue.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Book inventory valuation</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, adjustment #, staff..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {/* Type Filter Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setSelectedType("All")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedType === "All"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({stockAdjustments.length})
              </button>
              <button
                onClick={() => setSelectedType("Increase")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedType === "Increase"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                + Increase
              </button>
              <button
                onClick={() => setSelectedType("Decrease")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  selectedType === "Decrease"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-rose-700"
                }`}
              >
                - Decrease
              </button>
            </div>

            {/* Reason Dropdown */}
            {distinctReasons.length > 0 && (
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shrink-0"
              >
                <option value="All">All Reasons</option>
                {distinctReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}

            {/* Reset to Default Sample Data */}
            <button
              onClick={resetStockAdjustmentsToDefault}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Reset stock adjustments to default sample audit records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bulk Action Strip */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
              <span>{selectedIds.length} records selected</span>
            </div>
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        )}
      </div>

      {/* Adjustments Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredAdjustments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No Stock Adjustments Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedType !== "All" || selectedReason !== "All"
                ? "No adjustment records matched your search filters."
                : "You haven't recorded any stock adjustments yet. Click '+ Increase Stock' or '- Decrease Stock' to reconcile your inventory."}
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setModalDefaultType("Increase");
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                + New Adjustment
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.length === filteredAdjustments.length &&
                          filteredAdjustments.length > 0
                        }
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Adj # / Date</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3 text-center">Type</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3 text-center">Stock Movement</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-3 text-right">Value (Rs.)</th>
                    <th className="py-3 px-3">Adjusted By</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdjustments.map((adj) => {
                    const isSelected = selectedIds.includes(adj.id);
                    return (
                      <tr
                        key={adj.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(adj.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-900 block">
                            {adj.adjustmentNumber}
                          </span>
                          <span className="text-[11px] text-slate-500">{adj.date}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {adj.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span>{adj.category || "General"}</span>
                            {adj.batch && <span>• Batch: {adj.batch}</span>}
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              adj.type === "Increase"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {adj.type === "Increase" ? (
                              <>
                                <PlusCircle className="w-3 h-3 text-emerald-600" />
                                <span>+ Increase</span>
                              </>
                            ) : (
                              <>
                                <MinusCircle className="w-3 h-3 text-rose-600" />
                                <span>- Decrease</span>
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-sm whitespace-nowrap">
                          <span
                            className={
                              adj.type === "Increase" ? "text-emerald-700" : "text-rose-700"
                            }
                          >
                            {adj.type === "Increase" ? `+${adj.quantity}` : `-${adj.quantity}`}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            <span className="text-slate-600 font-semibold">{adj.previousStock}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span
                              className={`font-bold ${
                                adj.newStock > 0 ? "text-slate-900" : "text-rose-600"
                              }`}
                            >
                              {adj.newStock}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="font-medium text-slate-800 block line-clamp-1">
                            {adj.reason}
                          </span>
                          {adj.notes && (
                            <span className="text-[11px] text-slate-500 line-clamp-1 italic">
                              "{adj.notes}"
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          Rs. {adj.totalValue.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-700 text-xs">
                          {adj.adjustedBy}
                        </td>

                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewVoucher(adj)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="View Voucher"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingle(adj)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete adjustment record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredAdjustments.map((adj) => {
                const isSelected = selectedIds.includes(adj.id);
                return (
                  <div
                    key={adj.id}
                    className={`p-4 space-y-2.5 transition-colors ${
                      isSelected ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(adj.id)}
                          className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-sm text-slate-900 leading-snug">
                            {adj.productName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{adj.adjustmentNumber}</span>
                            <span>•</span>
                            <span>{adj.date}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          adj.type === "Increase"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {adj.type === "Increase" ? `+${adj.quantity}` : `-${adj.quantity}`} units
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Movement</span>
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold">
                          <span className="text-slate-600">{adj.previousStock}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className={adj.newStock > 0 ? "text-slate-900 font-bold" : "text-rose-600 font-bold"}>
                            {adj.newStock}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Valuation</span>
                        <span className="font-mono font-bold text-slate-900">
                          Rs. {adj.totalValue.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center justify-between pt-1">
                      <span className="font-medium truncate max-w-[200px]" title={adj.reason}>
                        {adj.reason}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewVoucher(adj)}
                          className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-lg cursor-pointer"
                        >
                          Voucher
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(adj)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Stock Adjustment Creation Modal */}
      <StockAdjustmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultType={modalDefaultType}
      />

      {/* Single Adjustment Voucher Preview Modal */}
      {viewVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden text-slate-900">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">Stock Adjustment Voucher</h3>
              </div>
              <button
                onClick={() => setViewVoucher(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase block font-bold">Voucher #</span>
                  <span className="font-mono font-bold text-slate-900">{viewVoucher.adjustmentNumber}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 uppercase block font-bold">Date</span>
                  <span className="font-mono text-slate-800">{viewVoucher.date}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="font-bold text-sm text-slate-900">{viewVoucher.productName}</div>
                <div className="text-xs text-slate-500">{viewVoucher.category || "General Supplies"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Adjustment Type</span>
                  <span
                    className={`font-bold ${
                      viewVoucher.type === "Increase" ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {viewVoucher.type === "Increase" ? "+ Stock Increase" : "- Stock Decrease"}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Quantity</span>
                  <span className="font-mono font-bold text-base text-slate-900">
                    {viewVoucher.quantity} units
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Stock Movement</span>
                  <span className="font-mono text-xs font-semibold text-slate-700">
                    {viewVoucher.previousStock} ➔ {viewVoucher.newStock} units
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Valuation</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rs. {viewVoucher.totalValue.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Reason</span>
                <p className="p-2.5 bg-slate-50 rounded-xl text-slate-800 font-medium">
                  {viewVoucher.reason}
                </p>
              </div>

              {viewVoucher.notes && (
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-bold block mb-1">Remarks & Notes</span>
                  <p className="p-2.5 bg-slate-50 rounded-xl text-slate-700 italic">
                    "{viewVoucher.notes}"
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>Authorized by: <strong className="text-slate-800">{viewVoucher.adjustedBy}</strong></span>
                <span>{settings.pharmacyName}</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewVoucher(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <ConfirmDeleteModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete(null)}
          onConfirm={confirmDelete.onConfirm}
          title={confirmDelete.title}
          message={confirmDelete.message}
          itemDescription={confirmDelete.itemDescription}
          confirmButtonText="Yes, Delete Record"
        />
      )}
    </div>
  );
};
