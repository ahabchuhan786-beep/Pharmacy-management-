import React, { useState, useMemo, useRef } from "react";
import { useApp } from "../context/AppContext";
import { Quotation, QuotationItem, QuotationStatus, Product, Customer, QuotationRateType } from "../types";
import { convertRupeesToWords } from "../utils/numberToWords";
import { findMatchingProducts } from "../utils/fuzzyMatch";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { DuplicateItemAlertModal } from "./DuplicateItemAlertModal";
import { QuotationPrintModal } from "./QuotationPrintModal";
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Share2,
  Trash2,
  Edit3,
  Copy,
  ArrowRightCircle,
  Building,
  Phone,
  Calendar,
  X,
  Sparkles,
  ChevronDown,
  Info,
  DollarSign,
  TrendingUp,
  PackageCheck,
  PackageX,
  Layers,
} from "lucide-react";

export const QuotationsView: React.FC = () => {
  const {
    quotations,
    saveQuotation,
    deleteQuotation,
    deleteMultipleQuotations,
    generateNextQuotationNumber,
    duplicateQuotation,
    convertQuotationToOrder,
    loadQuotationIntoDraft,
    resetQuotationsToDefault,
    currentProducts,
    customers,
    settings,
    getItemAvailableStock,
    setActiveNavTab,
    setSelectedPreviewOrder,
    orders,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rateBasisFilter, setRateBasisFilter] = useState<string>("all");
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<string[]>([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [previewingQuotation, setPreviewingQuotation] = useState<Quotation | null>(null);
  const [convertingQuotation, setConvertingQuotation] = useState<Quotation | null>(null);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Conversion feedback toast/alert
  const [conversionResult, setConversionResult] = useState<{
    success: boolean;
    orderId?: string;
    orderNumber?: string;
    message: string;
  } | null>(null);

  // --- STATS COMPUTATION ---
  const stats = useMemo(() => {
    const total = quotations.length;
    const totalValue = quotations.reduce((s, q) => s + q.grandTotal, 0);
    const converted = quotations.filter((q) => q.status === "Converted to Order");
    const convertedValue = converted.reduce((s, q) => s + q.grandTotal, 0);
    const pending = quotations.filter((q) => q.status === "Draft" || q.status === "Sent" || q.status === "Accepted");
    const pendingValue = pending.reduce((s, q) => s + q.grandTotal, 0);
    const conversionRate = total > 0 ? Math.round((converted.length / total) * 100) : 0;

    return {
      total,
      totalValue,
      convertedCount: converted.length,
      convertedValue,
      pendingCount: pending.length,
      pendingValue,
      conversionRate,
    };
  }, [quotations]);

  // --- FILTERED QUOTATIONS ---
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const qTerm = searchQuery.toLowerCase().trim();
      const matchSearch =
        !qTerm ||
        q.quotationNumber.toLowerCase().includes(qTerm) ||
        q.customerName.toLowerCase().includes(qTerm) ||
        (q.customerCity && q.customerCity.toLowerCase().includes(qTerm)) ||
        (q.subject && q.subject.toLowerCase().includes(qTerm));

      const matchStatus = statusFilter === "all" || q.status === statusFilter;
      const matchRate =
        rateBasisFilter === "all" ||
        q.quotationRateType === rateBasisFilter ||
        (rateBasisFilter === "sell_rate" && !q.quotationRateType);

      return matchSearch && matchStatus && matchRate;
    });
  }, [quotations, searchQuery, statusFilter, rateBasisFilter]);

  // --- BULK SELECTION ---
  const isAllSelected =
    filteredQuotations.length > 0 && selectedQuotationIds.length === filteredQuotations.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedQuotationIds([]);
    } else {
      setSelectedQuotationIds(filteredQuotations.map((q) => q.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedQuotationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedQuotationIds.length === 0) return;
    setConfirmDeleteModal({
      isOpen: true,
      title: "Bulk Delete Quotations",
      message: `Are you sure you want to delete ${selectedQuotationIds.length} selected quotation(s)? This action cannot be reversed.`,
      confirmButtonText: `Delete ${selectedQuotationIds.length} Quotation(s)`,
      onConfirm: () => {
        deleteMultipleQuotations(selectedQuotationIds);
        setSelectedQuotationIds([]);
        setConfirmDeleteModal(null);
      },
    });
  };

  // --- CONVERT QUOTATION TO LIVE SALE ORDER ---
  const handleOpenConvertModal = (quot: Quotation) => {
    setConvertingQuotation(quot);
  };

  const executeConvert = (quot: Quotation) => {
    const res = convertQuotationToOrder(quot.id);
    if (res.success && res.orderId) {
      const generatedOrder = orders.find((o) => o.id === res.orderId);
      setConversionResult({
        success: true,
        orderId: res.orderId,
        orderNumber: generatedOrder?.orderNumber || "ORD-NEW",
        message: `Quotation ${quot.quotationNumber} successfully converted to official Sales Order! Stock has been reserved and deducted.`,
      });
      setConvertingQuotation(null);
    } else {
      setConversionResult({
        success: false,
        message: res.error || "Failed to convert quotation to order due to stock constraints.",
      });
    }
  };

  return (
    <div id="quotations-view-container" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Price Quotations & Estimates</span>
              </h1>
              <p className="text-xs text-slate-500">
                Prepare official hospital & pharmacy price quotes. Track validity, check live stock, and convert
                accepted quotes directly to stock sale orders with one click.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => {
              setConfirmDeleteModal({
                isOpen: true,
                title: "Reset Sample Quotations",
                message: "Are you sure you want to reset quotations to the initial baseline samples?",
                confirmButtonText: "Yes, Reset Samples",
                onConfirm: () => {
                  resetQuotationsToDefault();
                  setConfirmDeleteModal(null);
                },
              });
            }}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Reset Samples
          </button>

          <button
            id="btn-create-new-quotation"
            type="button"
            onClick={() => {
              setEditingQuotation(null);
              setShowCreateModal(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Quotation</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Quotations</span>
            <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            <p className="text-[11px] text-slate-500">Cumulative value: Rs. {stats.totalValue.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200/80 p-4 shadow-xs flex items-center justify-between bg-blue-50/20">
          <div className="space-y-1">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Active Pipeline</span>
            <p className="text-2xl font-black text-blue-800">{stats.pendingCount}</p>
            <p className="text-[11px] text-blue-600">Pending Value: Rs. {stats.pendingValue.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100/60 border border-blue-200 flex items-center justify-center text-blue-700">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-purple-200/80 p-4 shadow-xs flex items-center justify-between bg-purple-50/20">
          <div className="space-y-1">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Converted to Orders</span>
            <p className="text-2xl font-black text-purple-800">{stats.convertedCount}</p>
            <p className="text-[11px] text-purple-600">Order Value: Rs. {stats.convertedValue.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-100/60 border border-purple-200 flex items-center justify-center text-purple-700">
            <ArrowRightCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-xs flex items-center justify-between bg-emerald-50/20">
          <div className="space-y-1">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Conversion Rate</span>
            <p className="text-2xl font-black text-emerald-800">{stats.conversionRate}%</p>
            <p className="text-[11px] text-emerald-600">Accepted quotes converted to stock</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100/60 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Success / Error Conversion Toast */}
      {conversionResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-sm ${
            conversionResult.success
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {conversionResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs sm:text-sm font-bold">{conversionResult.message}</p>
              {conversionResult.success && conversionResult.orderId && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const found = orders.find((o) => o.id === conversionResult.orderId);
                      if (found) setSelectedPreviewOrder(found);
                    }}
                    className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                  >
                    View Sales Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNavTab("orders-history")}
                    className="px-3 py-1 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Go to Sales History
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConversionResult(null)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Controls & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Quotation #, Client, City, or Subject..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {[
                { id: "all", label: "All" },
                { id: "Draft", label: "Draft" },
                { id: "Sent", label: "Sent" },
                { id: "Accepted", label: "Accepted" },
                { id: "Converted to Order", label: "Converted" },
                { id: "Rejected", label: "Rejected" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Rate Basis Filter Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setRateBasisFilter("all")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  rateBasisFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All Rates
              </button>
              <button
                type="button"
                onClick={() => setRateBasisFilter("sell_rate")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  rateBasisFilter === "sell_rate" ? "bg-emerald-600 text-white shadow-2xs" : "text-emerald-700 hover:text-emerald-900"
                }`}
              >
                Sell Rate
              </button>
              <button
                type="button"
                onClick={() => setRateBasisFilter("purchase_rate")}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  rateBasisFilter === "purchase_rate" ? "bg-amber-600 text-white shadow-2xs" : "text-amber-700 hover:text-amber-900"
                }`}
              >
                Purchase Rate
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {selectedQuotationIds.length > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 animate-in fade-in duration-150">
            <span className="font-semibold">
              {selectedQuotationIds.length} quotation(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuotationIds([])}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    title="Select All Quotations"
                  />
                </th>
                <th className="py-3 px-3">Quotation #</th>
                <th className="py-3 px-3">Client / Pharmacy</th>
                <th className="py-3 px-3">Date & Expiry</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3 text-right">Grand Total</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-600">No quotations found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchQuery
                        ? "Try changing your search query or filter"
                        : "Click '+ Create New Quotation' to issue your first price estimate."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((quot) => {
                  const isSelected = selectedQuotationIds.includes(quot.id);
                  const isConverted = quot.status === "Converted to Order";
                  const todayStr = new Date().toISOString().split("T")[0];
                  const isExpired = new Date(quot.validUntil) < new Date(todayStr);

                  return (
                    <tr
                      key={quot.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(quot.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-slate-900">{quot.quotationNumber}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              quot.quotationRateType === "purchase_rate"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            {quot.quotationRateType === "purchase_rate" ? "Purchase Rate" : "Sell Rate"}
                          </span>
                        </div>
                        {quot.subject && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{quot.subject}</div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{quot.customerName}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          {quot.customerCity && <span>{quot.customerCity}</span>}
                          {quot.customerPhone && <span>• {quot.customerPhone}</span>}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-700">{quot.quotationDate}</div>
                        <div
                          className={`text-[11px] font-medium ${
                            isExpired && !isConverted ? "text-red-600 font-bold" : "text-slate-500"
                          }`}
                        >
                          Valid: {quot.validUntil}
                          {isExpired && !isConverted && " (Expired)"}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                          {quot.items.length} items
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          Rs. {quot.grandTotal.toLocaleString()}
                        </div>
                        {quot.discount > 0 && (
                          <div className="text-[10px] text-emerald-600">
                            Disc: Rs. {quot.discount.toLocaleString()}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full border ${
                            isConverted
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : quot.status === "Accepted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : quot.status === "Sent"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : quot.status === "Rejected"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {quot.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Convert to Order Button */}
                          {!isConverted ? (
                            <button
                              type="button"
                              onClick={() => handleOpenConvertModal(quot)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
                              title="Check stock & convert to confirmed sales order"
                            >
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Convert</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (quot.convertedOrderId) {
                                  const ord = orders.find((o) => o.id === quot.convertedOrderId);
                                  if (ord) setSelectedPreviewOrder(ord);
                                }
                              }}
                              className="px-2 py-1 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer"
                              title="View Generated Order"
                            >
                              Order Placed
                            </button>
                          )}

                          {/* Print / View Modal */}
                          <button
                            type="button"
                            onClick={() => setPreviewingQuotation(quot)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View / Print Quotation"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => duplicateQuotation(quot.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Duplicate Quotation"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuotation(quot);
                              setShowCreateModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Quotation"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteModal({
                                isOpen: true,
                                title: "Delete Quotation",
                                message: `Are you sure you want to delete quotation "${quot.quotationNumber}" for "${quot.customerName}"?`,
                                itemDescription: `Date: ${quot.quotationDate} | Items: ${quot.items.length} | Amount: Rs. ${quot.grandTotal.toLocaleString()}`,
                                confirmButtonText: "Yes, Delete Quotation",
                                onConfirm: () => {
                                  deleteQuotation(quot.id);
                                  setConfirmDeleteModal(null);
                                },
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Quotation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- CREATE / EDIT QUOTATION MODAL --- */}
      {showCreateModal && (
        <CreateOrEditQuotationModal
          initialQuotation={editingQuotation}
          onClose={() => {
            setShowCreateModal(false);
            setEditingQuotation(null);
          }}
          onSave={(saved) => {
            saveQuotation(saved);
            setShowCreateModal(false);
            setEditingQuotation(null);
          }}
        />
      )}

      {/* --- LIVE PRINT / PREVIEW MODAL --- */}
      {previewingQuotation && (
        <QuotationPrintModal
          quotation={previewingQuotation}
          onClose={() => setPreviewingQuotation(null)}
          onConvertToOrder={(id) => {
            setPreviewingQuotation(null);
            const found = quotations.find((q) => q.id === id);
            if (found) setConvertingQuotation(found);
          }}
        />
      )}

      {/* --- CONVERT TO SALE ORDER (STOCK AUDIT) MODAL --- */}
      {convertingQuotation && (
        <ConvertQuotationModal
          quotation={convertingQuotation}
          onClose={() => setConvertingQuotation(null)}
          onConfirmConvert={() => executeConvert(convertingQuotation)}
          onLoadDraft={() => {
            loadQuotationIntoDraft(convertingQuotation.id);
            setConvertingQuotation(null);
          }}
        />
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {confirmDeleteModal && (
        <ConfirmDeleteModal
          isOpen={confirmDeleteModal.isOpen}
          title={confirmDeleteModal.title}
          message={confirmDeleteModal.message}
          itemDescription={confirmDeleteModal.itemDescription}
          confirmButtonText={confirmDeleteModal.confirmButtonText}
          onConfirm={confirmDeleteModal.onConfirm}
          onCancel={() => setConfirmDeleteModal(null)}
        />
      )}
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: CREATE OR EDIT QUOTATION MODAL
// ==========================================
interface CreateModalProps {
  initialQuotation: Quotation | null;
  onClose: () => void;
  onSave: (quotation: Quotation) => void;
}

const CreateOrEditQuotationModal: React.FC<CreateModalProps> = ({
  initialQuotation,
  onClose,
  onSave,
}) => {
  const {
    currentProducts,
    customers,
    settings,
    generateNextQuotationNumber,
    getItemAvailableStock,
    getStockSummaries,
    purchases,
  } = useApp();

  // Basic Details State
  const [quotationNumber, setQuotationNumber] = useState(
    initialQuotation?.quotationNumber || generateNextQuotationNumber()
  );
  const [quotationDate, setQuotationDate] = useState(
    initialQuotation?.quotationDate || new Date().toISOString().split("T")[0]
  );
  const [validDays, setValidDays] = useState("15");
  const [validUntil, setValidUntil] = useState(
    initialQuotation?.validUntil ||
      new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<QuotationStatus>(
    initialQuotation?.status || "Draft"
  );
  const [salesman, setSalesman] = useState(
    initialQuotation?.salesman || settings.defaultSalesman || "ADNAN"
  );
  const [subject, setSubject] = useState(
    initialQuotation?.subject || "Wholesale Price Quotation for Surgical & Hospital Supplies"
  );
  const [quotationRateType, setQuotationRateType] = useState<QuotationRateType>(
    initialQuotation?.quotationRateType || "sell_rate"
  );

  // Helper to determine both selling rate and purchase/cost rate for a product
  const getProductRates = (prod: Product) => {
    const sellRate = Number(prod.price) || 0;
    let costRate = 0;
    const summaries = getStockSummaries ? getStockSummaries() : [];
    const foundSummary = summaries.find(
      (s) => s.productId === prod.id || s.productName.toLowerCase().trim() === prod.name.toLowerCase().trim()
    );
    if (foundSummary && foundSummary.unitCost > 0) {
      costRate = foundSummary.unitCost;
    } else if (purchases && purchases.length > 0) {
      for (const pur of purchases) {
        const it = pur.items.find(
          (pItem) => pItem.productId === prod.id || pItem.productName.toLowerCase().trim() === prod.name.toLowerCase().trim()
        );
        if (it && it.costRate > 0) {
          costRate = it.costRate;
          break;
        }
      }
    }
    if (costRate <= 0) {
      costRate = Math.round(sellRate * 0.85);
    }
    return { sellRate, costRate };
  };

  // Customer State
  const [customerName, setCustomerName] = useState(initialQuotation?.customerName || "");
  const [customerCode, setCustomerCode] = useState(initialQuotation?.customerCode || "");
  const [customerCity, setCustomerCity] = useState(initialQuotation?.customerCity || "");
  const [customerAddress, setCustomerAddress] = useState(initialQuotation?.customerAddress || "");
  const [customerPhone, setCustomerPhone] = useState(initialQuotation?.customerPhone || "");
  const [customerLicenseNo, setCustomerLicenseNo] = useState(initialQuotation?.customerLicenseNo || "");
  const [customerNtn, setCustomerNtn] = useState(initialQuotation?.customerNtn || "");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Items State
  const [items, setItems] = useState<QuotationItem[]>(initialQuotation?.items || []);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Item Adder Input State
  const [searchItemText, setSearchItemText] = useState("");
  const [inputQty, setInputQty] = useState("1");
  const [inputRate, setInputRate] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Duplicate item alert modal state
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    productName: string;
    productId?: string;
    rate: number;
    newQty: number;
    existingQuantity: number;
    existingLineNumber: number;
    category?: string;
  } | null>(null);

  // Discount & Remarks
  const [overallDiscount, setOverallDiscount] = useState<string>(
    initialQuotation?.discount ? String(initialQuotation.discount) : "0"
  );
  const [taxPercent, setTaxPercent] = useState<string>(
    initialQuotation?.tax ? String(initialQuotation.tax) : "0"
  );
  const [termsConditions, setTermsConditions] = useState(
    initialQuotation?.termsConditions ||
      "1. Rates quoted are valid for 15 calendar days from the quotation date.\n2. Genuine medical-grade supplies with replacement warranty.\n3. Free door delivery at customer facility within 24 hours of purchase order.\n4. Payment terms: 100% advance or 15 days credit upon invoice submission."
  );
  const [notes, setNotes] = useState(initialQuotation?.notes || "");

  // Update validUntil when validDays changes
  const handleValidDaysChange = (days: string) => {
    setValidDays(days);
    if (days !== "custom") {
      const numDays = Number(days) || 15;
      const targetDate = new Date(Date.now() + numDays * 86400000);
      setValidUntil(targetDate.toISOString().split("T")[0]);
    }
  };

  // Autocomplete customer
  const filteredCustomers = useMemo(() => {
    if (!customerName.trim()) return customers.slice(0, 8);
    const q = customerName.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, customerName]);

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerCode(c.code || "");
    setCustomerCity(c.city || "");
    setCustomerAddress(c.address || "");
    setCustomerPhone(c.phone || "");
    setCustomerLicenseNo(c.licenseNo || "");
    setCustomerNtn(c.ntn || "");
    setShowCustomerDropdown(false);
  };

  // Autocomplete Products
  const matchingCandidates = useMemo(() => {
    if (!searchItemText.trim()) return [];
    return findMatchingProducts(searchItemText, currentProducts, 10);
  }, [searchItemText, currentProducts]);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setSearchItemText(p.name);
    const { sellRate, costRate } = getProductRates(p);
    const chosenRate = quotationRateType === "purchase_rate" ? costRate : sellRate;
    setInputRate(String(chosenRate));
    setShowProductDropdown(false);
  };

  const handleToggleRateType = (newType: QuotationRateType) => {
    setQuotationRateType(newType);
    if (selectedProduct) {
      const { sellRate, costRate } = getProductRates(selectedProduct);
      setInputRate(String(newType === "purchase_rate" ? costRate : sellRate));
    }
  };

  const handleApplyRateToAll = (type: QuotationRateType) => {
    setQuotationRateType(type);
    setItems((prev) =>
      prev.map((it) => {
        const matchedProd = currentProducts.find(
          (p) => p.id === it.productId || p.name.toLowerCase().trim() === it.productName.toLowerCase().trim()
        );
        if (matchedProd) {
          const { sellRate, costRate } = getProductRates(matchedProd);
          const targetRate = type === "purchase_rate" ? costRate : sellRate;
          return {
            ...it,
            rate: targetRate,
            costRate,
            sellRate,
            amount: it.quantity * targetRate,
          };
        }
        return it;
      })
    );
  };

  // Add Item to Quotation
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = searchItemText.trim();
    if (!trimmedName) return;

    const qty = Number(inputQty) || 1;
    const { sellRate, costRate } = selectedProduct
      ? getProductRates(selectedProduct)
      : { sellRate: Number(inputRate) || 0, costRate: Math.round((Number(inputRate) || 0) * 0.85) };

    const rate = inputRate !== "" ? Number(inputRate) || 0 : (quotationRateType === "purchase_rate" ? costRate : sellRate);

    // Duplicate item check
    const existingIndex = items.findIndex(
      (it) => it.productName.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingIndex !== -1) {
      const existing = items[existingIndex];
      setDuplicateModal({
        isOpen: true,
        productName: trimmedName,
        productId: selectedProduct?.id || existing.productId,
        rate,
        newQty: qty,
        existingQuantity: existing.quantity,
        existingLineNumber: existingIndex + 1,
        category: selectedProduct?.category || existing.category,
      });
      return;
    }

    // New item
    const newItem: QuotationItem = {
      id: `qi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: selectedProduct?.id,
      productCode: selectedProduct?.productCode,
      productName: trimmedName,
      category: selectedProduct?.category || "General Supplies",
      quantity: qty,
      rate,
      costRate,
      sellRate,
      amount: qty * rate,
      bon: 0,
      disc1: 0,
      disc2: 0,
      sTax: 0,
    };

    setItems((prev) => [...prev, newItem]);
    setSearchItemText("");
    setInputQty("1");
    setInputRate("");
    setSelectedProduct(null);
  };

  const handleMergeDuplicate = () => {
    if (!duplicateModal) return;
    setItems((prev) =>
      prev.map((it) =>
        it.productName.trim().toLowerCase() === duplicateModal.productName.toLowerCase()
          ? {
              ...it,
              quantity: it.quantity + duplicateModal.newQty,
              amount: (it.quantity + duplicateModal.newQty) * it.rate,
            }
          : it
      )
    );
    setSearchItemText("");
    setInputQty("1");
    setInputRate("");
    setSelectedProduct(null);
    setDuplicateModal(null);
  };

  const handleAddAsSeparate = () => {
    if (!duplicateModal) return;
    const newItem: QuotationItem = {
      id: `qi-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: duplicateModal.productId,
      productName: duplicateModal.productName,
      category: duplicateModal.category || "General Supplies",
      quantity: duplicateModal.newQty,
      rate: duplicateModal.rate,
      amount: duplicateModal.newQty * duplicateModal.rate,
      bon: 0,
      disc1: 0,
      disc2: 0,
      sTax: 0,
    };
    setItems((prev) => [...prev, newItem]);
    setSearchItemText("");
    setInputQty("1");
    setInputRate("");
    setSelectedProduct(null);
    setDuplicateModal(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<QuotationItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const newQty = updates.quantity !== undefined ? Number(updates.quantity) || 0 : it.quantity;
        const newRate = updates.rate !== undefined ? Number(updates.rate) || 0 : it.rate;
        const amount = newQty * newRate;
        return { ...it, ...updates, quantity: newQty, rate: newRate, amount };
      })
    );
  };

  // Bulk actions on quotation items
  const isAllItemsSelected = items.length > 0 && selectedItemIds.length === items.length;
  const toggleSelectAllItems = () => {
    if (isAllItemsSelected) setSelectedItemIds([]);
    else setSelectedItemIds(items.map((i) => i.id));
  };

  const deleteSelectedItems = () => {
    setItems((prev) => prev.filter((i) => !selectedItemIds.includes(i.id)));
    setSelectedItemIds([]);
  };

  // Financial Calculations
  const subtotal = useMemo(() => items.reduce((s, it) => s + it.amount, 0), [items]);
  const numDiscount = Number(overallDiscount) || 0;
  const numTax = Number(taxPercent) || 0;
  const grandTotal = Math.max(0, subtotal - numDiscount + numTax);
  const grandTotalInWords = convertRupeesToWords(grandTotal);

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert("Please provide a Customer / Pharmacy Name for this quotation.");
      return;
    }
    if (items.length === 0) {
      alert("Please add at least 1 item to the quotation.");
      return;
    }

    const quotationToSave: Quotation = {
      id: initialQuotation?.id || `quot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      quotationNumber: quotationNumber.trim() || generateNextQuotationNumber(),
      customerName: customerName.trim(),
      customerCode: customerCode.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      customerCity: customerCity.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerLicenseNo: customerLicenseNo.trim() || undefined,
      customerNtn: customerNtn.trim() || undefined,
      quotationDate,
      validUntil,
      quotationRateType,
      salesman: salesman.trim() || settings.defaultSalesman || "DIRECT",
      subject: subject.trim() || undefined,
      termsConditions: termsConditions.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
      subtotal,
      discount: numDiscount,
      tax: numTax,
      advanceTax: 0,
      grandTotal,
      grandTotalInWords,
      status,
      convertedOrderId: initialQuotation?.convertedOrderId,
      convertedAt: initialQuotation?.convertedAt,
      createdAt: initialQuotation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(quotationToSave);
  };

  return (
    <div
      id="create-quotation-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {initialQuotation ? "Edit Quotation" : "Create New Quotation / Estimate"}
              </h2>
              <p className="text-xs text-slate-400">
                Official price quote for client review. Stock is checked live and will NOT be deducted until converted.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Section 1: Header & Quotation Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            {/* Rate Basis Switcher: Sell Rate vs Purchase Rate */}
            <div className="sm:col-span-2 lg:col-span-4 p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-amber-50/80 border-blue-200/90 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Quotation Rate Basis:
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      quotationRateType === "sell_rate"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {quotationRateType === "sell_rate"
                      ? "* Sell Rate Quotation (Customer Price)"
                      : "* Purchase Rate Quotation (Supplier/Cost Price)"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {quotationRateType === "sell_rate"
                    ? "Rates default to catalog selling prices for retail customers & pharmacy orders."
                    : "Rates default to wholesale purchase/cost rates for supplier inquiries & cost bids."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleToggleRateType("sell_rate")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quotationRateType === "sell_rate"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Sell Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleRateType("purchase_rate")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quotationRateType === "purchase_rate"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Purchase Rate
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleApplyRateToAll("sell_rate")}
                      className="px-2 py-1 bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-300 rounded-md font-bold cursor-pointer"
                      title="Update all existing line items to standard Sell Rates"
                    >
                      All Sell Rates
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyRateToAll("purchase_rate")}
                      className="px-2 py-1 bg-white hover:bg-slate-50 text-amber-800 border border-amber-300 rounded-md font-bold cursor-pointer"
                      title="Update all existing line items to Purchase/Cost Rates"
                    >
                      All Purchase Rates
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Number *</label>
              <input
                type="text"
                required
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Date *</label>
              <input
                type="date"
                required
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Validity Period</label>
              <select
                value={validDays}
                onChange={(e) => handleValidDaysChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">7 Days Validity</option>
                <option value="15">15 Days Validity (Standard)</option>
                <option value="30">30 Days Validity (1 Month)</option>
                <option value="60">60 Days (Tender)</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Valid Until (Expiry) *</label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => {
                  setValidUntil(e.target.value);
                  setValidDays("custom");
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-blue-700 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Tender Title</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Quotation for Surgical Disposables & OT Supplies"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sales Representative</label>
              <input
                type="text"
                value={salesman}
                onChange={(e) => setSalesman(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuotationStatus)}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent to Client</option>
                <option value="Accepted">Accepted by Client</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Section 2: Customer / Hospital Directory & Autofill */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>Client & Destination Details</span>
              </span>
              <span className="text-[11px] text-slate-500">Auto-suggest from Customer Profiles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Pharmacy / Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder="Type name or search existing..."
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />

                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 cursor-pointer text-xs"
                      >
                        <div className="font-bold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {c.city} • {c.phone || "No phone"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="e.g. Sahiwal, Chichawatni, Lahore"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Hospital Road, Medical Market..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NTN / Drug License</label>
                <input
                  type="text"
                  value={customerNtn}
                  onChange={(e) => setCustomerNtn(e.target.value)}
                  placeholder="NTN or Drug Lic #"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Add Items to Quotation with LIVE STOCK BADGES */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Add Quotation Items (Master Catalog)</span>
              </span>
              <span className="text-[11px] text-slate-500">Live physical stock status displayed</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
              <div className="relative flex-1">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  value={searchItemText}
                  onChange={(e) => {
                    setSearchItemText(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Type product name to search catalog..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />

                {showProductDropdown && matchingCandidates.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                    {matchingCandidates.map((cand) => {
                      const stockInfo = getItemAvailableStock(cand.product.id, cand.product.name);
                      return (
                        <button
                          key={cand.product.id}
                          type="button"
                          onClick={() => selectProduct(cand.product)}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900">{cand.product.name}</div>
                            <div className="text-[10px] text-slate-500">
                              {cand.product.category} • Master Rate: Rs. {cand.product.price.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                stockInfo.availableStock > 10
                                  ? "bg-emerald-100 text-emerald-800"
                                  : stockInfo.availableStock > 0
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              Stock: {stockInfo.availableStock} pkts
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="w-24">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-center focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="w-36 sm:w-44">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-600">Unit Rate (Rs.) *</label>
                  {selectedProduct && (
                    <span className="text-[10px] text-blue-600 font-semibold">
                      {quotationRateType === "purchase_rate" ? "Purchase" : "Sell"}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputRate}
                  onChange={(e) => setInputRate(e.target.value)}
                  placeholder="Rate"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-right focus:ring-2 focus:ring-blue-500"
                />
                {selectedProduct && (
                  <div className="flex items-center gap-1 mt-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        const { sellRate } = getProductRates(selectedProduct);
                        setInputRate(String(sellRate));
                      }}
                      className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold cursor-pointer"
                      title="Use catalog selling rate"
                    >
                      Sell: {selectedProduct.price}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const { costRate } = getProductRates(selectedProduct);
                        setInputRate(String(costRate));
                      }}
                      className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-semibold cursor-pointer"
                      title="Use purchase/cost rate"
                    >
                      Cost: {getProductRates(selectedProduct).costRate}
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 h-[38px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Section 4: Items Table with Bulk Select */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Quotation Line Items ({items.length})</span>
                {selectedItemIds.length > 0 && (
                  <span className="text-[11px] text-blue-600 font-semibold">
                    ({selectedItemIds.length} selected)
                  </span>
                )}
              </div>
              {selectedItemIds.length > 0 && (
                <button
                  type="button"
                  onClick={deleteSelectedItems}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-red-600 text-white rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete Selected</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllItemsSelected}
                        onChange={toggleSelectAllItems}
                        className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-2 w-10 text-center">#</th>
                    <th className="py-2.5 px-2.5 w-24">Code</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3">Live Stock</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Unit Rate (Rs.)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount (Rs.)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No items added yet. Use the product input above to add items to this quotation.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const stockInfo = getItemAvailableStock(it.productId, it.productName);
                      const isShortage = stockInfo.availableStock < it.quantity;
                      const isSelected = selectedItemIds.includes(it.id);

                      return (
                        <tr
                          key={it.id}
                          className={`hover:bg-slate-50/50 ${isSelected ? "bg-blue-50/30" : ""}`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedItemIds((prev) =>
                                  prev.includes(it.id)
                                    ? prev.filter((i) => i !== it.id)
                                    : [...prev, it.id]
                                )
                              }
                              className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-[11px] text-blue-700">
                            {it.productCode || it.productId || `PRD-${String(idx + 1).padStart(3, "0")}`}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900">{it.productName}</div>
                            <div className="text-[10px] text-slate-400">{it.category || "General"}</div>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                !isShortage
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : stockInfo.availableStock > 0
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {!isShortage ? (
                                <PackageCheck className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <PackageX className="w-3 h-3 text-red-600" />
                              )}
                              <span>Avail: {stockInfo.availableStock}</span>
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { quantity: Number(e.target.value) || 1 })
                              }
                              className="w-16 px-1.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded text-center"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.rate}
                              onChange={(e) =>
                                handleUpdateItem(it.id, { rate: Number(e.target.value) || 0 })
                              }
                              className="w-24 px-1.5 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded text-right"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            Rs. {it.amount.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(it.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Totals, Discounts, Terms & Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  rows={4}
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes or specific hospital instructions..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                Quotation Financial Summary
              </span>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Subtotal ({items.length} items):</span>
                <span className="font-mono font-bold text-slate-900">
                  Rs. {subtotal.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Special Discount (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  value={overallDiscount}
                  onChange={(e) => setOverallDiscount(e.target.value)}
                  className="w-28 px-2 py-1 text-xs font-mono font-bold text-right bg-white border border-slate-300 rounded-lg text-emerald-700"
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Sales Tax / GST (Rs.):</span>
                <input
                  type="number"
                  min="0"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  className="w-28 px-2 py-1 text-xs font-mono font-bold text-right bg-white border border-slate-300 rounded-lg text-slate-700"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-lg text-blue-700">
                  Rs. {grandTotal.toLocaleString()}
                </span>
              </div>

              <div className="pt-1 text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700">In Words:</span> {grandTotalInWords}
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              {initialQuotation ? "Save Changes" : "Save Quotation"}
            </button>
          </div>
        </form>
      </div>

      {/* Duplicate Alert Modal inside Create/Edit */}
      {duplicateModal && (
        <DuplicateItemAlertModal
          isOpen={duplicateModal.isOpen}
          productName={duplicateModal.productName}
          category={duplicateModal.category}
          existingQuantity={duplicateModal.existingQuantity}
          newQuantity={duplicateModal.newQty}
          existingLineNumber={duplicateModal.existingLineNumber}
          rate={duplicateModal.rate}
          currencySymbol="Rs."
          onMergeQuantity={handleMergeDuplicate}
          onAddAsSeparate={handleAddAsSeparate}
          onCancel={() => setDuplicateModal(null)}
        />
      )}
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: CONVERT QUOTATION (STOCK CHECK) MODAL
// ==========================================
interface ConvertModalProps {
  quotation: Quotation;
  onClose: () => void;
  onConfirmConvert: () => void;
  onLoadDraft: () => void;
}

const ConvertQuotationModal: React.FC<ConvertModalProps> = ({
  quotation,
  onClose,
  onConfirmConvert,
  onLoadDraft,
}) => {
  const { getItemAvailableStock, setActiveNavTab } = useApp();

  // Audit all items
  const audit = useMemo(() => {
    let hasAnyShortage = false;
    const itemsAudit = quotation.items.map((it) => {
      const stock = getItemAvailableStock(it.productId, it.productName);
      const isShortage = !stock.hasPurchaseRecord || stock.availableStock < it.quantity;
      if (isShortage) hasAnyShortage = true;

      return {
        item: it,
        stock,
        isShortage,
      };
    });

    return {
      itemsAudit,
      hasAnyShortage,
    };
  }, [quotation, getItemAvailableStock]);

  return (
    <div
      id="convert-quotation-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ArrowRightCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Convert Quotation to Official Sales Order</h3>
              <p className="text-xs text-slate-400">
                {quotation.quotationNumber} • {quotation.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-3.5 rounded-xl border text-xs flex items-start gap-3 bg-blue-50/50 border-blue-200 text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Next Stage: Stock Reservation & Sale Order Creation</p>
              <p className="text-blue-700 mt-0.5">
                Converting this quotation will create an official Sales Order, allocate and deduct inventory stock,
                record customer pending balance, and generate an official printable A4 invoice.
              </p>
            </div>
          </div>

          {/* Stock Audit Table */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Inventory Stock Audit ({quotation.items.length} items):
            </span>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-2 text-center">Req. Qty</th>
                    <th className="py-2 px-2 text-center">Available Stock</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.itemsAudit.map(({ item, stock, isShortage }) => (
                    <tr key={item.id} className={isShortage ? "bg-red-50/40" : ""}>
                      <td className="py-2 px-3 font-semibold text-slate-800">{item.productName}</td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-semibold">
                        <span
                          className={
                            stock.availableStock >= item.quantity ? "text-emerald-700" : "text-red-700"
                          }
                        >
                          {stock.availableStock}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {!isShortage ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>In Stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Shortage</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shortage Warning */}
          {audit.hasAnyShortage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Cannot convert directly due to insufficient physical stock</span>
              </p>
              <p className="text-[11px] text-red-700 leading-relaxed">
                Some items have zero or less available stock than requested. You can either purchase stock first
                via the <strong>Purchases</strong> tab, or click <strong>"Load into Order Draft"</strong> to adjust
                quantities or sell available portions.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onLoadDraft}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Load into Order Draft (Edit Items)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={audit.hasAnyShortage}
              onClick={onConfirmConvert}
              className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                !audit.hasAnyShortage
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>Confirm & Deduct Stock</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
