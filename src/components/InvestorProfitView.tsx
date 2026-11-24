import React, { useState, useMemo } from "react";
import {
  Users,
  PieChart,
  Coins,
  TrendingUp,
  TrendingDown,
  Calendar,
  Printer,
  Download,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Wallet,
  FileSpreadsheet,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Scale,
  Percent,
  ShieldCheck,
  RefreshCw,
  Info,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Investor, InvestorPayout, MonthlyProfitDistribution } from "../types";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { downloadTextFileSafely } from "../utils/pdfGenerator";

export const InvestorProfitView: React.FC = () => {
  const {
    settings,
    orders,
    purchases,
    returns,
    expenses,
    investors,
    saveInvestor,
    deleteInvestor,
    resetInvestorsToDefault,
    distributions,
    saveDistribution,
    deleteDistribution,
  } = useApp();

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Active view tab: "distribution" | "investors" | "history"
  const [activeTab, setActiveTab] = useState<"distribution" | "investors" | "history">("distribution");

  // Selected Month for calculation (YYYY-MM)
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default to current month or previous month if current month is new
    return currentMonthStr;
  });

  // Modal States
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showSingleSlipModal, setShowSingleSlipModal] = useState<InvestorPayout | null>(null);

  // Manual Adjustment Overrides for selected month (if the user wants custom values)
  const [enableManualOverride, setEnableManualOverride] = useState(false);
  const [manualSales, setManualSales] = useState<number>(0);
  const [manualPurchases, setManualPurchases] = useState<number>(0);
  const [manualExpenses, setManualExpenses] = useState<number>(0);
  const [retainedReservePercent, setRetainedReservePercent] = useState<number>(10);
  const [distributionNotes, setDistributionNotes] = useState<string>("");

  // Existing saved distribution for this month (if finalized or saved as draft)
  const savedDistForMonth = useMemo(() => {
    return distributions.find((d) => d.month === selectedMonth);
  }, [distributions, selectedMonth]);

  // Operational actual figures for selected month
  const actualMonthFigures = useMemo(() => {
    // Orders in this month
    const monthOrders = orders.filter((o) => o.orderDate && o.orderDate.startsWith(selectedMonth));
    const grossSales = monthOrders.reduce(
      (sum, o) => sum + Math.max(0, (Number(o.grandTotal) || 0) - (Number(o.previousPendingAmount) || 0)),
      0
    );
    const paidSales = monthOrders.reduce((sum, o) => sum + (Number(o.paidAmount) || 0), 0);
    const creditSales = monthOrders.reduce((sum, o) => sum + (Number(o.pendingAmount) || 0), 0);

    // Purchases in this month
    const monthPurchases = purchases.filter(
      (p) => p.purchaseDate && p.purchaseDate.startsWith(selectedMonth)
    );
    const totalPurchases = monthPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);

    // Returns in this month
    const monthSaleReturns = returns
      .filter((r) => r.returnType === "Sale Return" && r.returnDate && r.returnDate.startsWith(selectedMonth))
      .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

    const netSales = Math.max(0, grossSales - monthSaleReturns);

    // Expenses in this month
    const monthExpenses = expenses.filter(
      (e) => e.date && e.date.startsWith(selectedMonth)
    );
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return {
      orderCount: monthOrders.length,
      grossSales,
      monthSaleReturns,
      netSales,
      paidSales,
      creditSales,
      purchaseCount: monthPurchases.length,
      totalPurchases,
      expenseCount: monthExpenses.length,
      totalExpenses,
      calculatedGrossProfit: netSales - totalPurchases,
      calculatedNetProfit: netSales - totalPurchases - totalExpenses,
    };
  }, [orders, purchases, returns, expenses, selectedMonth]);

  // Total Capital of active investors
  const activeInvestors = useMemo(() => {
    return investors.filter((inv) => inv.isActive);
  }, [investors]);

  const totalCapital = useMemo(() => {
    return activeInvestors.reduce((sum, inv) => sum + (Number(inv.investmentAmount) || 0), 0);
  }, [activeInvestors]);

  // Effective Financial Figures for Profit Calculation (either from saved distribution, manual override, or actuals)
  const financialFigures = useMemo(() => {
    if (savedDistForMonth && !enableManualOverride) {
      return {
        sales: savedDistForMonth.totalSales,
        purchases: savedDistForMonth.totalPurchasesCost,
        expenses: savedDistForMonth.totalExpenses,
        grossProfit: savedDistForMonth.grossProfit,
        netProfit: savedDistForMonth.netProfit,
        reservePercent: savedDistForMonth.retainedReservePercent,
        reserveAmount: savedDistForMonth.retainedReserveAmount,
        distributableProfit: savedDistForMonth.distributableProfit,
        isFromSaved: true,
      };
    }

    const sales = enableManualOverride ? Number(manualSales) || 0 : actualMonthFigures.netSales;
    const pur = enableManualOverride ? Number(manualPurchases) || 0 : actualMonthFigures.totalPurchases;
    const exp = enableManualOverride ? Number(manualExpenses) || 0 : actualMonthFigures.totalExpenses;

    const grossProfit = sales - pur;
    const netProfit = grossProfit - exp;

    const reserveAmount = Math.round(Math.max(0, netProfit) * (retainedReservePercent / 100));
    const distributableProfit = Math.max(0, netProfit - reserveAmount);

    return {
      sales,
      purchases: pur,
      expenses: exp,
      grossProfit,
      netProfit,
      reservePercent: retainedReservePercent,
      reserveAmount,
      distributableProfit,
      isFromSaved: false,
    };
  }, [savedDistForMonth, enableManualOverride, manualSales, manualPurchases, manualExpenses, retainedReservePercent, actualMonthFigures]);

  // Payout calculations for each investor for the active distribution
  const currentPayouts: InvestorPayout[] = useMemo(() => {
    if (savedDistForMonth && !enableManualOverride) {
      return savedDistForMonth.payouts;
    }

    if (totalCapital <= 0 || financialFigures.distributableProfit <= 0) {
      return activeInvestors.map((inv) => ({
        investorId: inv.id,
        investorName: inv.name,
        investmentAmount: inv.investmentAmount,
        sharePercentage: inv.sharePercentage || (totalCapital > 0 ? (inv.investmentAmount / totalCapital) * 100 : 0),
        payoutAmount: 0,
        status: "Pending",
        paymentMethod: "Bank Transfer",
      }));
    }

    return activeInvestors.map((inv) => {
      const sharePct =
        inv.sharePercentage !== undefined && inv.sharePercentage > 0
          ? inv.sharePercentage
          : (inv.investmentAmount / totalCapital) * 100;

      const payout = Math.round((financialFigures.distributableProfit * sharePct) / 100);

      return {
        investorId: inv.id,
        investorName: inv.name,
        investmentAmount: inv.investmentAmount,
        sharePercentage: Number(sharePct.toFixed(2)),
        payoutAmount: payout,
        status: "Pending",
        paymentMethod: "Bank Transfer",
      };
    });
  }, [savedDistForMonth, enableManualOverride, activeInvestors, totalCapital, financialFigures.distributableProfit]);

  // Local state for payouts when modifying status/method/reference
  const [localPayouts, setLocalPayouts] = useState<InvestorPayout[]>(currentPayouts);

  // Sync localPayouts when currentPayouts changes
  React.useEffect(() => {
    setLocalPayouts(currentPayouts);
  }, [currentPayouts]);

  // Month Navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 2, 1);
    const prevY = date.getFullYear();
    const prevM = String(date.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${prevY}-${prevM}`);
    setEnableManualOverride(false);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, "0");
    setSelectedMonth(`${nextY}-${nextM}`);
    setEnableManualOverride(false);
  };

  const formatMonthName = (monthStr: string) => {
    try {
      const [y, m] = monthStr.split("-").map(Number);
      const date = new Date(y, m - 1, 1);
      return date.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
    } catch {
      return monthStr;
    }
  };

  // Toggle payout status (Paid / Pending)
  const handleTogglePayoutStatus = (investorId: string) => {
    setLocalPayouts((prev) =>
      prev.map((p) => {
        if (p.investorId === investorId) {
          const nextStatus = p.status === "Paid" ? "Pending" : "Paid";
          return {
            ...p,
            status: nextStatus,
            paidDate: nextStatus === "Paid" ? new Date().toISOString().split("T")[0] : undefined,
          };
        }
        return p;
      })
    );
  };

  // Update specific payout fields
  const handleUpdatePayout = (investorId: string, updates: Partial<InvestorPayout>) => {
    setLocalPayouts((prev) =>
      prev.map((p) => (p.investorId === investorId ? { ...p, ...updates } : p))
    );
  };

  // Save / Finalize Distribution
  const handleSaveDistribution = (status: "Draft" | "Finalized") => {
    const newDist: MonthlyProfitDistribution = {
      id: savedDistForMonth?.id || `dist-${selectedMonth}`,
      month: selectedMonth,
      totalSales: financialFigures.sales,
      totalPurchasesCost: financialFigures.purchases,
      totalExpenses: financialFigures.expenses,
      grossProfit: financialFigures.grossProfit,
      netProfit: financialFigures.netProfit,
      retainedReservePercent: financialFigures.reservePercent,
      retainedReserveAmount: financialFigures.reserveAmount,
      distributableProfit: financialFigures.distributableProfit,
      payouts: localPayouts,
      notes: distributionNotes || savedDistForMonth?.notes || `Profit distribution for ${formatMonthName(selectedMonth)}.`,
      status,
      finalizedAt: status === "Finalized" ? new Date().toISOString() : undefined,
      createdAt: savedDistForMonth?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveDistribution(newDist);
    alert(`Success: Monthly Profit Distribution for ${formatMonthName(selectedMonth)} saved as ${status}!`);
  };

  // Export Distribution to CSV
  const handleExportCSV = async () => {
    const headers = [
      "Month",
      "Investor Name",
      "Capital Investment (PKR)",
      "Share %",
      "Profit Share (PKR)",
      "Status",
      "Payment Method",
      "Paid Date",
      "Reference",
    ];

    const rows = localPayouts.map((p) => [
      selectedMonth,
      `"${p.investorName}"`,
      p.investmentAmount,
      p.sharePercentage,
      p.payoutAmount,
      p.status,
      p.paymentMethod || "N/A",
      p.paidDate || "N/A",
      `"${p.reference || ""}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    await downloadTextFileSafely(
      csvText,
      `Profit_Distribution_${selectedMonth}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  // Investor Form Submissions
  const [investorForm, setInvestorForm] = useState<Partial<Investor>>({
    name: "",
    phone: "",
    cnic: "",
    investmentAmount: 1000000,
    investmentDate: new Date().toISOString().split("T")[0],
    sharePercentage: undefined,
    bankDetails: "",
    notes: "",
    isActive: true,
  });

  const openNewInvestorModal = () => {
    setEditingInvestor(null);
    setInvestorForm({
      name: "",
      phone: "",
      cnic: "",
      investmentAmount: 1000000,
      investmentDate: new Date().toISOString().split("T")[0],
      sharePercentage: undefined,
      bankDetails: "",
      notes: "",
      isActive: true,
    });
    setShowInvestorModal(true);
  };

  const openEditInvestorModal = (inv: Investor) => {
    setEditingInvestor(inv);
    setInvestorForm({ ...inv });
    setShowInvestorModal(true);
  };

  const handleSaveInvestorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorForm.name || !investorForm.name.trim()) {
      alert("Please enter the investor's name.");
      return;
    }
    const invAmount = Number(investorForm.investmentAmount) || 0;
    if (invAmount <= 0) {
      alert("Please enter a valid investment amount.");
      return;
    }

    const finalInvestor: Investor = {
      id: editingInvestor ? editingInvestor.id : `inv-${Date.now()}`,
      name: investorForm.name.trim(),
      phone: investorForm.phone?.trim() || "",
      cnic: investorForm.cnic?.trim() || "",
      investmentAmount: invAmount,
      investmentDate: investorForm.investmentDate || new Date().toISOString().split("T")[0],
      sharePercentage: investorForm.sharePercentage ? Number(investorForm.sharePercentage) : undefined,
      bankDetails: investorForm.bankDetails?.trim() || "",
      notes: investorForm.notes?.trim() || "",
      isActive: investorForm.isActive !== undefined ? investorForm.isActive : true,
      createdAt: editingInvestor ? editingInvestor.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveInvestor(finalInvestor);
    setShowInvestorModal(false);
  };

  // Calculate historical total profit distributed across all investors
  const historicalTotalDistributed = useMemo(() => {
    return distributions.reduce(
      (sum, d) => sum + d.payouts.reduce((pSum, p) => pSum + (Number(p.payoutAmount) || 0), 0),
      0
    );
  }, [distributions]);

  // Calculate each investor's all-time earnings
  const investorEarningsMap = useMemo(() => {
    const map: Record<string, number> = {};
    distributions.forEach((d) => {
      d.payouts.forEach((p) => {
        map[p.investorId] = (map[p.investorId] || 0) + (p.status === "Paid" ? p.payoutAmount : 0);
      });
    });
    return map;
  }, [distributions]);

  return (
    <div id="investor-profit-view" className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-12 text-slate-800">
      {/* Top Banner */}
      <div className="bg-[#1e293b] p-5 sm:p-7 rounded-xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 rounded text-xs font-semibold">
            <Coins className="w-3.5 h-3.5" />
            <span>Partnership & Capital Dividend Management</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Monthly Profit & Investor Sharing</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Calculate store sales, purchase costs, operating expenses, determine net distributable profit, and disburse investor dividend shares based on capital investment ratios.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={openNewInvestorModal}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Investor</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold text-xs sm:text-sm rounded-lg border border-slate-600 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Print Monthly Sheet</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-semibold text-xs sm:text-sm rounded-lg border border-slate-600 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab("distribution")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "distribution"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Monthly Profit & Distribution</span>
          </button>

          <button
            onClick={() => setActiveTab("investors")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "investors"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Investors & Capital ({activeInvestors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === "history"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Distribution History ({distributions.length})</span>
          </button>
        </div>

        {activeTab === "investors" && (
          <button
            onClick={resetInvestorsToDefault}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
            title="Reload default sample investor partners"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Samples</span>
          </button>
        )}
      </div>

      {/* TAB 1: MONTHLY PROFIT & DISTRIBUTION */}
      {activeTab === "distribution" && (
        <div className="space-y-6">
          {/* Month Selector & Controls Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <Calendar className="w-4 h-4 text-blue-600" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setEnableManualOverride(false);
                  }}
                  className="text-sm font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="text-sm font-bold text-slate-700 hidden sm:inline">
                {formatMonthName(selectedMonth)}
              </span>
            </div>

            {/* Mode & Status indicators */}
            <div className="flex items-center gap-3">
              {savedDistForMonth && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${
                    savedDistForMonth.status === "Finalized"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{savedDistForMonth.status === "Finalized" ? "Month Finalized" : "Draft Saved"}</span>
                </span>
              )}

              <button
                onClick={() => {
                  if (!enableManualOverride) {
                    setManualSales(financialFigures.sales);
                    setManualPurchases(financialFigures.purchases);
                    setManualExpenses(financialFigures.expenses);
                  }
                  setEnableManualOverride(!enableManualOverride);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  enableManualOverride
                    ? "bg-amber-500 text-white border-amber-600"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {enableManualOverride ? "Custom Override: ON" : "Custom Adjustments"}
              </button>
            </div>
          </div>

          {/* Manual Overrides Alert (if enabled) */}
          {enableManualOverride && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Custom Manual Figures Mode</span>
              </div>
              <p>
                You can manually adjust total sales, purchases cost, and store operating expenses for this month to match external cash audit books.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Sales Revenue (PKR)</label>
                  <input
                    type="number"
                    value={manualSales}
                    onChange={(e) => setManualSales(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Purchases / Stock Cost (PKR)</label>
                  <input
                    type="number"
                    value={manualPurchases}
                    onChange={(e) => setManualPurchases(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Operating Expenses (PKR)</label>
                  <input
                    type="number"
                    value={manualExpenses}
                    onChange={(e) => setManualExpenses(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4 Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sales */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Net Sales</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-blue-600">
                Rs. {financialFigures.sales.toLocaleString("en-PK")}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>{actualMonthFigures.orderCount} Orders logged</span>
                <span className="font-semibold text-emerald-600">
                  {actualMonthFigures.netSales > 0 ? "100%" : "0%"}
                </span>
              </div>
            </div>

            {/* Purchases */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Purchases / COGS</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-purple-600">
                Rs. {financialFigures.purchases.toLocaleString("en-PK")}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>{actualMonthFigures.purchaseCount} Invoices entered</span>
                <span className="font-semibold text-slate-600">
                  {financialFigures.sales > 0
                    ? `${((financialFigures.purchases / financialFigures.sales) * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Store Expenses</span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-amber-600">
                Rs. {financialFigures.expenses.toLocaleString("en-PK")}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between">
                <span>{actualMonthFigures.expenseCount} Vouchers saved</span>
                <span className="font-semibold text-slate-600">
                  {financialFigures.sales > 0
                    ? `${((financialFigures.expenses / financialFigures.sales) * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
            </div>

            {/* Net Distributable Profit */}
            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Distributable Profit</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-700">
                Rs. {financialFigures.distributableProfit.toLocaleString("en-PK")}
              </div>
              <div className="text-[11px] text-emerald-800 flex items-center justify-between">
                <span>Net: Rs. {financialFigures.netProfit.toLocaleString("en-PK")}</span>
                <span className="font-bold">
                  {financialFigures.sales > 0
                    ? `${((financialFigures.distributableProfit / financialFigures.sales) * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>

          {/* Profit Breakdown & Reserve Allocation Settings */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  <span>Profit & Reserve Fund Allocation</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Gross Profit = Sales - Purchases | Net Profit = Gross Profit - Operating Expenses
                </p>
              </div>

              {/* Retained reserve percentage selector */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span>Retained Reserve:</span>
                <select
                  value={retainedReservePercent}
                  onChange={(e) => setRetainedReservePercent(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value={0}>0% (Distribute 100%)</option>
                  <option value={5}>5% Emergency Reserve</option>
                  <option value={10}>10% Business Reserve (Standard)</option>
                  <option value={15}>15% Re-investment Reserve</option>
                  <option value={20}>20% High Reserve</option>
                </select>
              </div>
            </div>

            {/* Visual Formula Ledger */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">1. Gross Sales</span>
                <div className="font-mono font-bold text-slate-900">
                  Rs. {financialFigures.sales.toLocaleString("en-PK")}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">2. Purchases / COGS</span>
                <div className="font-mono font-bold text-purple-600">
                  - Rs. {financialFigures.purchases.toLocaleString("en-PK")}
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-100 space-y-1">
                <span className="text-[10px] text-blue-700 uppercase font-bold">= Gross Profit</span>
                <div className="font-mono font-bold text-blue-700">
                  Rs. {financialFigures.grossProfit.toLocaleString("en-PK")}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">3. Store Expenses</span>
                <div className="font-mono font-bold text-amber-600">
                  - Rs. {financialFigures.expenses.toLocaleString("en-PK")}
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-100 space-y-1">
                <span className="text-[10px] text-amber-800 uppercase font-bold">4. Retained Reserve ({retainedReservePercent}%)</span>
                <div className="font-mono font-bold text-amber-800">
                  Rs. {financialFigures.reserveAmount.toLocaleString("en-PK")}
                </div>
              </div>

              <div className="p-3 bg-emerald-100 rounded-lg border border-emerald-200 space-y-1">
                <span className="text-[10px] text-emerald-800 uppercase font-bold">= Distributable Pool</span>
                <div className="font-mono font-bold text-emerald-900 text-sm">
                  Rs. {financialFigures.distributableProfit.toLocaleString("en-PK")}
                </div>
              </div>
            </div>
          </div>

          {/* Investor Profit Sharing Distribution Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Investor Dividend Shares ({localPayouts.length} Partners)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Distributing Rs. {financialFigures.distributableProfit.toLocaleString("en-PK")} based on active capital pool of Rs. {totalCapital.toLocaleString("en-PK")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveDistribution("Draft")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition-all cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSaveDistribution("Finalized")}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finalize & Lock Month</span>
                </button>
              </div>
            </div>

            {localPayouts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No active investors found. Click "Add Investor" to register partners.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Investor / Partner</th>
                      <th className="py-3 px-3 text-right">Investment Capital</th>
                      <th className="py-3 px-3 text-center">Share %</th>
                      <th className="py-3 px-3 text-right font-bold text-emerald-700">Profit Share (PKR)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3">Payment Method</th>
                      <th className="py-3 px-3">Txn Ref / Cheque #</th>
                      <th className="py-3 px-3 text-center">Receipt Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {localPayouts.map((p) => {
                      const inv = investors.find((i) => i.id === p.investorId);
                      return (
                        <tr key={p.investorId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{p.investorName}</div>
                            {inv?.phone && (
                              <div className="text-[11px] text-slate-400 font-mono">{inv.phone}</div>
                            )}
                            {inv?.cnic && (
                              <div className="text-[10px] text-slate-400 font-mono">CNIC: {inv.cnic}</div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                            Rs. {p.investmentAmount.toLocaleString("en-PK")}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-xs">
                              {p.sharePercentage.toFixed(1)}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                            Rs. {p.payoutAmount.toLocaleString("en-PK")}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleTogglePayoutStatus(p.investorId)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer ${
                                p.status === "Paid"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                              }`}
                              title="Click to toggle Paid/Pending"
                            >
                              {p.status === "Paid" ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Paid</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Pending</span>
                                </>
                              )}
                            </button>
                            {p.paidDate && (
                              <div className="text-[10px] text-slate-400 mt-0.5">{p.paidDate}</div>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <select
                              value={p.paymentMethod || "Bank Transfer"}
                              onChange={(e) =>
                                handleUpdatePayout(p.investorId, {
                                  paymentMethod: e.target.value as any,
                                })
                              }
                              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none w-32"
                            >
                              <option value="Bank Transfer">Bank Transfer</option>
                              <option value="Cash">Cash</option>
                              <option value="Cheque">Cheque</option>
                              <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                            </select>
                          </td>

                          <td className="py-3 px-3">
                            <input
                              type="text"
                              value={p.reference || ""}
                              onChange={(e) =>
                                handleUpdatePayout(p.investorId, { reference: e.target.value })
                              }
                              placeholder="e.g. HBL-FT-1092"
                              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none w-28 font-mono"
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => setShowSingleSlipModal(p)}
                              className="p-1.5 rounded hover:bg-slate-100 text-blue-600 cursor-pointer"
                              title="Print Individual Dividend Voucher"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold text-slate-800 text-xs">
                    <tr>
                      <td className="py-3 px-3">Total Active Pool</td>
                      <td className="py-3 px-3 text-right font-mono">
                        Rs. {totalCapital.toLocaleString("en-PK")}
                      </td>
                      <td className="py-3 px-3 text-center">100.0%</td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 text-sm">
                        Rs. {financialFigures.distributableProfit.toLocaleString("en-PK")}
                      </td>
                      <td colSpan={4} className="py-3 px-3 text-right text-slate-500 font-normal">
                        Total Payouts: {localPayouts.filter((p) => p.status === "Paid").length} of {localPayouts.length} Paid
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVESTORS DIRECTORY & CAPITAL POOL */}
      {activeTab === "investors" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Capital Pool</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900">
                Rs. {totalCapital.toLocaleString("en-PK")}
              </div>
              <div className="text-[11px] text-slate-500">
                {activeInvestors.length} Active Partners / Financiers
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Profit Distributed</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-blue-600">
                Rs. {historicalTotalDistributed.toLocaleString("en-PK")}
              </div>
              <div className="text-[11px] text-slate-500">
                Cumulative payouts across all finalized months
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Historical Distributions</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-mono font-bold text-slate-900">
                {distributions.length} Months
              </div>
              <div className="text-[11px] text-slate-500">
                Archived financial distribution statements
              </div>
            </div>
          </div>

          {/* Investors Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Registered Investors & Stakeholders</h3>
                <p className="text-xs text-slate-500">
                  Manage partner capital investments, profit share percentages, and banking details
                </p>
              </div>

              <button
                onClick={openNewInvestorModal}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Partner</span>
              </button>
            </div>

            {investors.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No investors registered. Click "Add New Partner" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Investor Name & Contact</th>
                      <th className="py-3 px-3 text-right">Investment Amount</th>
                      <th className="py-3 px-3 text-center">Share Ratio</th>
                      <th className="py-3 px-3">Investment Date</th>
                      <th className="py-3 px-3">Bank Details</th>
                      <th className="py-3 px-3 text-right">All-Time Paid</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {investors.map((inv) => {
                      const sharePct =
                        inv.sharePercentage !== undefined
                          ? inv.sharePercentage
                          : totalCapital > 0
                          ? (inv.investmentAmount / totalCapital) * 100
                          : 0;

                      const allTimeProfit = investorEarningsMap[inv.id] || 0;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 text-sm">{inv.name}</div>
                            {inv.phone && <div className="text-[11px] text-slate-500">{inv.phone}</div>}
                            {inv.cnic && (
                              <div className="text-[10px] text-slate-400 font-mono">CNIC: {inv.cnic}</div>
                            )}
                            {inv.notes && (
                              <div className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1">
                                {inv.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                            Rs. {inv.investmentAmount.toLocaleString("en-PK")}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-xs">
                              {sharePct.toFixed(1)}%
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-600 text-[11px]">
                            {inv.investmentDate}
                          </td>

                          <td className="py-3 px-3 text-slate-700 max-w-xs">
                            <div className="text-xs truncate">{inv.bankDetails || "Not specified"}</div>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                            Rs. {allTimeProfit.toLocaleString("en-PK")}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                inv.isActive
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {inv.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditInvestorModal(inv)}
                                className="p-1 rounded hover:bg-slate-100 text-blue-600 cursor-pointer"
                                title="Edit Partner"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setConfirmDeleteModal({
                                    isOpen: true,
                                    title: "Delete Partner Profile",
                                    message: `Are you sure you want to delete investor / partner "${inv.name}"? This action cannot be reversed.`,
                                    itemDescription: `Partner: ${inv.name} | Share: ${sharePct.toFixed(1)}% | Capital: Rs. ${(Number(inv.investmentAmount) || 0).toLocaleString("en-PK")}`,
                                    confirmButtonText: "Yes, Delete Partner",
                                    onConfirm: () => {
                                      deleteInvestor(inv.id);
                                      setConfirmDeleteModal(null);
                                    },
                                  });
                                }}
                                className="p-1 rounded hover:bg-red-50 text-red-500 cursor-pointer"
                                title="Delete Partner"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DISTRIBUTION HISTORY */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historical Distribution Audits</h3>
              <p className="text-xs text-slate-500">
                Review past monthly profit distribution calculations and payouts
              </p>
            </div>
          </div>

          {distributions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No historical distributions recorded yet. Finalize this month to archive your first distribution audit.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Audit Month</th>
                    <th className="py-3 px-3 text-right">Total Net Sales</th>
                    <th className="py-3 px-3 text-right">Purchases Cost</th>
                    <th className="py-3 px-3 text-right">Expenses</th>
                    <th className="py-3 px-3 text-right">Net Profit</th>
                    <th className="py-3 px-3 text-right">Retained Reserve</th>
                    <th className="py-3 px-3 text-right font-bold text-emerald-700">Distributable</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {distributions.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-blue-600 text-sm">{formatMonthName(d.month)}</div>
                        <div className="text-[10px] text-slate-400">{d.month}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                        Rs. {d.totalSales.toLocaleString("en-PK")}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-purple-600">
                        Rs. {d.totalPurchasesCost.toLocaleString("en-PK")}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-amber-600">
                        Rs. {d.totalExpenses.toLocaleString("en-PK")}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {d.netProfit.toLocaleString("en-PK")}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        Rs. {d.retainedReserveAmount.toLocaleString("en-PK")} ({d.retainedReservePercent}%)
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                        Rs. {d.distributableProfit.toLocaleString("en-PK")}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            d.status === "Finalized"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedMonth(d.month);
                              setActiveTab("distribution");
                            }}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs cursor-pointer"
                          >
                            View & Edit
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDeleteModal({
                                isOpen: true,
                                title: "Delete Distribution Record",
                                message: `Are you sure you want to delete the recorded profit distribution for month ${d.month}?`,
                                itemDescription: `Month: ${formatMonthName(d.month)} (${d.month}) | Distributable: Rs. ${(Number(d.distributableProfit) || 0).toLocaleString("en-PK")}`,
                                confirmButtonText: "Yes, Delete Distribution",
                                onConfirm: () => {
                                  deleteDistribution(d.id);
                                  setConfirmDeleteModal(null);
                                },
                              });
                            }}
                            className="p-1 rounded hover:bg-red-50 text-red-500 cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT INVESTOR */}
      {showInvestorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">
                  {editingInvestor ? "Edit Investor Partner" : "Register New Investor Partner"}
                </h3>
              </div>
              <button
                onClick={() => setShowInvestorModal(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvestorSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name / Partner Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haji Muhammad Aslam"
                  value={investorForm.name}
                  onChange={(e) => setInvestorForm({ ...investorForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-semibold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={investorForm.phone}
                    onChange={(e) => setInvestorForm({ ...investorForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CNIC / ID Number</label>
                  <input
                    type="text"
                    placeholder="36502-XXXXXXX-X"
                    value={investorForm.cnic}
                    onChange={(e) => setInvestorForm({ ...investorForm, cnic: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Investment Capital (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    placeholder="1000000"
                    value={investorForm.investmentAmount}
                    onChange={(e) =>
                      setInvestorForm({ ...investorForm, investmentAmount: Number(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Share % (Optional)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    placeholder="Leave empty for auto %"
                    value={investorForm.sharePercentage || ""}
                    onChange={(e) =>
                      setInvestorForm({
                        ...investorForm,
                        sharePercentage: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400">
                    If empty, share % is auto-calculated from total capital pool.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bank Account / Payment Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. HBL Sahiwal Main Branch - A/C 019283746102"
                  value={investorForm.bankDetails}
                  onChange={(e) => setInvestorForm({ ...investorForm, bankDetails: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Partnership Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Senior sleeping partner / monthly profit transferred via bank..."
                  value={investorForm.notes}
                  onChange={(e) => setInvestorForm({ ...investorForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-investor-active"
                  checked={investorForm.isActive}
                  onChange={(e) => setInvestorForm({ ...investorForm, isActive: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="chk-investor-active" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Active Partner (Included in monthly profit dividend calculation)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInvestorModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT OFFICIAL MONTHLY PROFIT DISTRIBUTION AUDIT STATEMENT (A4) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6">
            {/* Modal action bar (non-printable) */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">
                  Print Official Monthly Profit & Investor Distribution Statement
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 sm:p-10 space-y-6 text-slate-900 bg-white">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    {settings.pharmacyName || "AK PHARMACY & SURGICAL"}
                  </h1>
                  <p className="text-xs text-slate-600 font-semibold">{settings.address || "Main Sahiwal Road"}</p>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 mt-1">
                    <span>Ph: {settings.phone}</span>
                    <span>Lic #: {settings.licenseNo}</span>
                    <span>NTN: {settings.ntn}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
                    Statement of Profit & Loss Distribution
                  </div>
                  <div className="text-lg font-black text-blue-700 font-mono mt-0.5">
                    {formatMonthName(selectedMonth).toUpperCase()}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date of Audit: {new Date().toLocaleDateString("en-PK")}
                  </div>
                </div>
              </div>

              {/* Financial Executive Summary Ledger */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                  1. Operational Financial Statement
                </h3>
                <table className="w-full text-xs divide-y divide-slate-200 border border-slate-200">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">Gross Sales Revenue</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        Rs. {financialFigures.sales.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-700">Less: Purchases & Cost of Goods Sold</td>
                      <td className="py-2 px-3 text-right font-mono text-purple-700">
                        - Rs. {financialFigures.purchases.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-blue-50/50 font-bold">
                      <td className="py-2 px-3 text-blue-900">= Gross Operating Profit</td>
                      <td className="py-2 px-3 text-right font-mono text-blue-900">
                        Rs. {financialFigures.grossProfit.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-700">Less: Store Operating Expenses</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-700">
                        - Rs. {financialFigures.expenses.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-bold">
                      <td className="py-2 px-3 text-slate-900">= Net Profit Before Reserve</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">
                        Rs. {financialFigures.netProfit.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-700">
                        Less: Emergency Reserve / Retained Capital ({financialFigures.reservePercent}%)
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                        - Rs. {financialFigures.reserveAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-emerald-100 text-emerald-950 font-black text-sm">
                      <td className="py-2.5 px-3">= Net Distributable Dividend Pool</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        Rs. {financialFigures.distributableProfit.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Investor Payout Distribution Ledger */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                  2. Partner Capital Shares & Payout Disbursal Ledger
                </h3>
                <table className="w-full text-xs divide-y divide-slate-200 border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-2.5 text-center">Sr.</th>
                      <th className="py-2 px-3">Partner / Investor</th>
                      <th className="py-2 px-3 text-right">Capital Investment</th>
                      <th className="py-2 px-3 text-center">Share %</th>
                      <th className="py-2 px-3 text-right">Profit Amount</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-center">Partner Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {localPayouts.map((p, idx) => (
                      <tr key={p.investorId}>
                        <td className="py-2 px-2.5 text-center font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{p.investorName}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          Rs. {p.investmentAmount.toLocaleString("en-PK")}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold">
                          {p.sharePercentage.toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                          Rs. {p.payoutAmount.toLocaleString("en-PK")}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span
                            className={
                              p.status === "Paid" ? "text-emerald-700" : "text-amber-700"
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="w-28 border-b border-slate-300 mx-auto mt-3"></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black text-xs">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3">Total Active Pool</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        Rs. {totalCapital.toLocaleString("en-PK")}
                      </td>
                      <td className="py-2.5 px-3 text-center">100.0%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-900 text-sm">
                        Rs. {financialFigures.distributableProfit.toLocaleString("en-PK")}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures & Approvals */}
              <div className="pt-10 grid grid-cols-3 gap-8 text-center text-xs text-slate-700">
                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-36 mx-auto h-8"></div>
                  <div className="font-bold">Prepared By</div>
                  <div className="text-[10px] text-slate-500">Store Accounts Manager</div>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-36 mx-auto h-8"></div>
                  <div className="font-bold">Verified By</div>
                  <div className="text-[10px] text-slate-500">Managing Partner / Pharmacist</div>
                </div>

                <div className="space-y-1">
                  <div className="border-b border-slate-400 w-36 mx-auto h-8"></div>
                  <div className="font-bold">Audited & Approved</div>
                  <div className="text-[10px] text-slate-500">Senior Partner / Board</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINT INDIVIDUAL INVESTOR PROFIT SLIP */}
      {showSingleSlipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between print:hidden">
              <span className="font-bold text-sm">Partner Dividend Payout Slip</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setShowSingleSlipModal(null)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-800 bg-white">
              <div className="text-center border-b border-slate-200 pb-3">
                <h3 className="font-black text-base text-slate-900">{settings.pharmacyName}</h3>
                <p className="text-[11px] text-slate-500 font-semibold">{settings.address}</p>
                <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                  Ph: {settings.phone} | Lic: {settings.licenseNo}
                </div>
                <div className="inline-block mt-2 px-3 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                  PARTNER PROFIT DIVIDEND VOUCHER
                </div>
              </div>

              <div className="space-y-2 border border-slate-200 p-3 rounded-lg bg-slate-50">
                <div className="flex justify-between">
                  <span className="text-slate-500">Month / Period:</span>
                  <span className="font-bold text-slate-900">{formatMonthName(selectedMonth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Partner Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{showSingleSlipModal.investorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Investment:</span>
                  <span className="font-mono font-semibold">
                    Rs. {showSingleSlipModal.investmentAmount.toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ownership Share %:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {showSingleSlipModal.sharePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-emerald-900">
                  <span>Dividend Disbursed:</span>
                  <span className="font-mono text-base text-emerald-700">
                    Rs. {showSingleSlipModal.payoutAmount.toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                  <span>Payment Mode:</span>
                  <span className="font-medium text-slate-700">
                    {showSingleSlipModal.paymentMethod || "Cash"}
                  </span>
                </div>
                {showSingleSlipModal.reference && (
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Reference / Cheque:</span>
                    <span className="font-mono text-slate-700">{showSingleSlipModal.reference}</span>
                  </div>
                )}
              </div>

              <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[11px]">
                <div>
                  <div className="border-b border-slate-400 w-24 mx-auto h-6"></div>
                  <div className="font-bold mt-1">Authorized Pharmacist</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-24 mx-auto h-6"></div>
                  <div className="font-bold mt-1">Investor Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
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
