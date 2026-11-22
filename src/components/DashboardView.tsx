import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Order } from "../types";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import {
  DateRangePicker,
  DateRangeValue,
  normalizeDateRange,
  isDateWithinRange,
  formatShortDate,
} from "./DateRangePicker";
import {
  TrendingUp,
  TrendingDown,
  Package,
  FileCheck2,
  Users,
  PlusCircle,
  ArrowRight,
  Eye,
  Pill,
  FileSpreadsheet,
  SlidersHorizontal,
  ShoppingBag,
  Coins,
  BarChart3,
} from "lucide-react";

export const DashboardView: React.FC = () => {
  const {
    orders,
    purchases,
    expenses,
    quotations,
    stockAdjustments,
    currentProducts,
    priceListVersions,
    activeVersionId,
    settings,
    setActiveNavTab,
    getStockSummaries,
  } = useApp();

  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState<Order | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    startDate: "",
    endDate: "",
    preset: "all",
  });

  const activeVer = priceListVersions.find((v) => v.id === activeVersionId);
  const currency = settings.currencySymbol || "Rs.";

  const effectiveRange = useMemo(
    () => normalizeDateRange(dateRange.startDate, dateRange.endDate),
    [dateRange.startDate, dateRange.endDate]
  );

  const isDateFiltered = Boolean(effectiveRange.start || effectiveRange.end);

  // Filtered datasets matching selected start & end dates
  const filteredOrders = useMemo(
    () =>
      orders.filter((o) =>
        isDateWithinRange(o.orderDate || o.createdAt, effectiveRange.start, effectiveRange.end)
      ),
    [orders, effectiveRange.start, effectiveRange.end]
  );

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((p) =>
        isDateWithinRange(
          p.purchaseDate || p.createdAt,
          effectiveRange.start,
          effectiveRange.end
        )
      ),
    [purchases, effectiveRange.start, effectiveRange.end]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((e) =>
        isDateWithinRange(e.date || e.createdAt, effectiveRange.start, effectiveRange.end)
      ),
    [expenses, effectiveRange.start, effectiveRange.end]
  );

  // Product cost lookup (same logic as ReportsView: master costPrice + weighted purchase cost)
  const stockSummaries = useMemo(
    () => getStockSummaries(),
    [getStockSummaries, purchases, orders, stockAdjustments]
  );

  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();

    currentProducts.forEach((p) => {
      const cost =
        p.costPrice !== undefined && p.costPrice > 0
          ? Number(p.costPrice)
          : Math.round((Number(p.price) || 0) * 0.78);
      map.set(p.id, cost);
      map.set(p.name.toLowerCase().trim(), cost);
    });

    stockSummaries.forEach((s) => {
      if (s.unitCost > 0) {
        if (s.productId) {
          map.set(s.productId, s.unitCost);
        }
        map.set(s.productName.toLowerCase().trim(), s.unitCost);
      }
    });

    return map;
  }, [currentProducts, stockSummaries]);

  // Financial KPIs for the selected date range
  const financialMetrics = useMemo(() => {
    let totalSales = 0;
    let totalItemsSold = 0;
    let totalSoldCogs = 0;
    let totalSalesPaid = 0;
    let totalSalesPending = 0;

    filteredOrders.forEach((o) => {
      const grandTotal = Number(o.grandTotal) || 0;
      const prevPending = Number(o.previousPendingAmount) || 0;
      totalSales += Math.max(0, grandTotal - prevPending);

      const paid = o.paidAmount !== undefined ? Number(o.paidAmount) : grandTotal;
      const pending =
        o.pendingAmount !== undefined
          ? Number(o.pendingAmount)
          : Math.max(0, grandTotal - paid);
      totalSalesPaid += paid;
      totalSalesPending += pending;

      o.items.forEach((it) => {
        const qty = Number(it.quantity) || 0;
        totalItemsSold += qty;
        const normName = (it.productName || "").toLowerCase().trim();
        const unitCost =
          productCostMap.get(it.productId) ??
          productCostMap.get(normName) ??
          Math.round((Number(it.rate) || 0) * 0.78);
        totalSoldCogs += qty * unitCost;
      });
    });

    let totalPurchases = 0;
    let totalUnitsPurchased = 0;
    filteredPurchases.forEach((p) => {
      totalPurchases += Number(p.grandTotal) || 0;
      p.items.forEach((it) => {
        totalUnitsPurchased += (Number(it.quantity) || 0) + (Number(it.bon) || 0);
      });
    });

    const totalExpenses = filteredExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

    const grossProfit = Math.round(totalSales - totalSoldCogs);
    const netProfit = Math.round(grossProfit - totalExpenses);
    const grossMarginPct = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    return {
      totalSales: Math.round(totalSales),
      totalItemsSold,
      totalSoldCogs: Math.round(totalSoldCogs),
      totalSalesPaid: Math.round(totalSalesPaid),
      totalSalesPending: Math.round(totalSalesPending),
      totalPurchases: Math.round(totalPurchases),
      totalUnitsPurchased,
      totalExpenses: Math.round(totalExpenses),
      grossProfit,
      netProfit,
      grossMarginPct,
    };
  }, [filteredOrders, filteredPurchases, filteredExpenses, productCostMap]);

  // Category counts
  const categoryCounts = currentProducts.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category || "General";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const recentOrders = useMemo(() => {
    return [...filteredOrders]
      .sort(
        (a, b) =>
          new Date(b.orderDate || b.createdAt).getTime() -
          new Date(a.orderDate || a.createdAt).getTime()
      )
      .slice(0, 5);
  }, [filteredOrders]);

  return (
    <div id="dashboard-view" className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-12">
      {/* Top Welcome Banner */}
      <div className="bg-[#1e293b] p-6 sm:p-7 rounded-xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-slate-700/60 text-blue-300 border border-slate-600 rounded text-xs font-semibold">
            <Pill className="w-3.5 h-3.5" />
            <span>PharmaFlow Management</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {settings.pharmacyName || "PharmaFlow"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Create error-free pharmaceutical purchase orders with instant fuzzy matching, strict chronological sequencing, automated mathematical audits, and authentic A4 invoice PDFs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            id="btn-dash-new-order"
            onClick={() => setActiveNavTab("new-order")}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Create Order</span>
          </button>

          <button
            id="btn-dash-quotations"
            onClick={() => setActiveNavTab("quotations")}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Quotations ({quotations.length})</span>
          </button>

          <button
            id="btn-dash-stock-adjust"
            onClick={() => setActiveNavTab("stock-adjustments")}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Adjust Stock ({stockAdjustments.length})</span>
          </button>
        </div>
      </div>

      {/* Date Range Picker Component */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        title="Sales, Purchases & Profit Date Filter"
        subtitle="Select start and end dates to filter dashboard financial performance"
      />

      {/* Date-Filtered Financial KPI Cards: Total Sales, Total Purchases, Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Sales */}
        <div
          id="kpi-card-total-sales"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                Total Sales
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                {effectiveRange.label}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {currency} {financialMetrics.totalSales.toLocaleString("en-PK")}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              <strong className="text-slate-700">{filteredOrders.length}</strong> orders •{" "}
              <strong className="text-slate-700">{financialMetrics.totalItemsSold}</strong> units
            </span>
            <span className="text-emerald-600 font-semibold">
              Paid: {currency} {financialMetrics.totalSalesPaid.toLocaleString("en-PK")}
            </span>
          </div>
        </div>

        {/* Total Purchases */}
        <div
          id="kpi-card-total-purchases"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                Total Purchases
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                {effectiveRange.label}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {currency} {financialMetrics.totalPurchases.toLocaleString("en-PK")}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              <strong className="text-slate-700">{filteredPurchases.length}</strong> bills •{" "}
              <strong className="text-slate-700">{financialMetrics.totalUnitsPurchased}</strong> units
            </span>
            <button
              type="button"
              onClick={() => setActiveNavTab("purchases")}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              View Purchases →
            </button>
          </div>
        </div>

        {/* Profit Metrics */}
        <div
          id="kpi-card-profit"
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                Net Profit
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Gross Profit ({currency} {financialMetrics.grossProfit.toLocaleString("en-PK")}) − Expenses
              </p>
            </div>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                financialMetrics.netProfit >= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {financialMetrics.netProfit >= 0 ? (
                <Coins className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              financialMetrics.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            {financialMetrics.netProfit < 0 ? "-" : ""}
            {currency} {Math.abs(financialMetrics.netProfit).toLocaleString("en-PK")}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              COGS: <strong className="text-slate-700">{currency} {financialMetrics.totalSoldCogs.toLocaleString("en-PK")}</strong>{" "}
              • Exp: <strong className="text-slate-700">{currency} {financialMetrics.totalExpenses.toLocaleString("en-PK")}</strong>
            </span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded ${
                financialMetrics.grossMarginPct >= 0
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {financialMetrics.grossMarginPct.toFixed(1)}% margin
            </span>
          </div>
        </div>
      </div>

      {/* 4 Operational Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {isDateFiltered ? "Filtered Orders" : "Total Orders"}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {filteredOrders.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {isDateFiltered ? `Out of ${orders.length} total invoices` : "Recorded invoices & slips"}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Pending Dues</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
            {currency} {financialMetrics.totalSalesPending.toLocaleString("en-PK")}
          </div>
          <div className="text-[11px] text-slate-400">
            Receivable in {effectiveRange.label}
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Master Products</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">{currentProducts.length}</div>
          <div className="text-[11px] text-slate-400">Active in {activeVer?.versionName || "Inventory"}</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Salesman</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 truncate">
            {settings.defaultSalesman || "Adnan Ahmed"}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Lic: {settings.licenseNo}</div>
        </div>
      </div>

      {/* Main Grid: Recent Orders + Inventory Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders List (2 Cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isDateFiltered ? `Orders (${effectiveRange.label})` : "Recent Orders"}
              </h3>
              <p className="text-xs text-slate-500">Quickly preview, print, or generate invoice PDFs</p>
            </div>
            <button
              onClick={() => setActiveNavTab("orders-history")}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({orders.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              {isDateFiltered
                ? `No orders found between ${effectiveRange.label}.`
                : 'No orders generated yet. Click "Create New Order" to start.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-600">
                        {o.orderNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                        {formatShortDate(o.orderDate || o.createdAt)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {o.customerName || "Counter Sale"}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-600">
                        {o.items.length}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {currency} {o.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setSelectedOrderForPreview(o)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded font-semibold text-[11px] flex items-center gap-1 mx-auto cursor-pointer transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Master Inventory Categories Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Inventory Groups</h3>
              <p className="text-xs text-slate-500">Categories in current master list</p>
            </div>
            <button
              onClick={() => setActiveNavTab("price-list")}
              className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
            >
              Browse
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {Object.entries(categoryCounts).map(([catName, count]) => (
              <div
                key={catName}
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg text-xs transition-colors"
              >
                <span className="font-medium text-slate-800 truncate">{catName}</span>
                <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                  {count} items
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedOrderForPreview && (
        <InvoicePreviewModal
          order={selectedOrderForPreview}
          onClose={() => setSelectedOrderForPreview(null)}
        />
      )}
    </div>
  );
};
