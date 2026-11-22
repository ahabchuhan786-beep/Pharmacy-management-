import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Expense, ExpenseCategory } from "../types";
import { EXPENSE_CATEGORIES } from "../data/defaultData";
import { downloadTextFileSafely } from "../utils/pdfGenerator";
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  DollarSign,
  TrendingDown,
  Filter,
  Download,
  Printer,
  Edit2,
  Trash2,
  FileSpreadsheet,
  PieChart as PieIcon,
  BarChart3,
  Coffee,
  Truck,
  Package,
  Zap,
  Building,
  Users,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  "Shop Rent": "#6366f1", // indigo
  "Electricity & Utilities": "#eab308", // yellow/amber
  "Staff Salaries & Wages": "#3b82f6", // blue
  "Tea & Refreshments": "#f97316", // orange
  "Transport & Delivery": "#06b6d4", // cyan
  "Packaging & Stationery": "#8b5cf6", // purple
  "Generator & Fuel": "#ef4444", // red
  "Cleaning & Maintenance": "#10b981", // emerald
  "Government Taxes & Fees": "#64748b", // slate
  "Marketing & Promotion": "#ec4899", // pink
  "Miscellaneous / Other": "#94a3b8", // slate-400
};

export const ExpensesView: React.FC = () => {
  const {
    expenses,
    saveExpense,
    deleteExpense,
    generateNextExpenseNumber,
    settings,
  } = useApp();

  // Navigation tab within Expenses
  const [activeSubTab, setActiveSubTab] = useState<"daily" | "monthly">("daily");

  // Filter States for Daily Log
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "this-week" | "this-month" | "all" | "custom">("this-month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Month Selector for Monthly Report (Defaults to current YYYY-MM)
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [voucherExpense, setVoucherExpense] = useState<Expense | null>(null);
  const [isPrintMonthlyModalOpen, setIsPrintMonthlyModalOpen] = useState(false);

  // Form Fields State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<ExpenseCategory>("Tea & Refreshments");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formDate, setFormDate] = useState<string>(today.toISOString().split("T")[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<Expense["paymentMethod"]>("Cash");
  const [formPaidBy, setFormPaidBy] = useState<string>(settings.preparedBy || "Adnan");
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");

  // Reset form
  const resetForm = () => {
    setEditingExpense(null);
    setFormTitle("");
    setFormCategory("Tea & Refreshments");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormPaymentMethod("Cash");
    setFormPaidBy(settings.preparedBy || "Adnan");
    setFormReceiptNumber("");
    setFormNotes("");
  };

  const openCreateModal = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormTitle(exp.title);
    setFormCategory((exp.category as ExpenseCategory) || "Miscellaneous / Other");
    setFormAmount(String(exp.amount));
    setFormDate(exp.date);
    setFormPaymentMethod(exp.paymentMethod || "Cash");
    setFormPaidBy(exp.paidBy || "");
    setFormReceiptNumber(exp.receiptNumber || "");
    setFormNotes(exp.notes || "");
    setIsFormModalOpen(true);
  };

  // Quick Preset Helper
  const applyQuickPreset = (preset: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    notes?: string;
  }) => {
    resetForm();
    setFormTitle(preset.title);
    setFormCategory(preset.category);
    setFormAmount(String(preset.amount));
    setFormDate(new Date().toISOString().split("T")[0]);
    if (preset.notes) setFormNotes(preset.notes);
    setIsFormModalOpen(true);
  };

  // Handle Save Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount);
    if (!formTitle.trim()) {
      alert("Please enter a title / description for this expense.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    const nowIso = new Date().toISOString();
    const expenseToSave: Expense = {
      id: editingExpense ? editingExpense.id : `exp-${Date.now()}`,
      expenseNumber: editingExpense ? editingExpense.expenseNumber : generateNextExpenseNumber(),
      title: formTitle.trim(),
      category: formCategory,
      amount: parsedAmount,
      date: formDate || new Date().toISOString().split("T")[0],
      paymentMethod: formPaymentMethod,
      paidBy: formPaidBy.trim() || undefined,
      receiptNumber: formReceiptNumber.trim() || undefined,
      notes: formNotes.trim() || undefined,
      createdAt: editingExpense ? editingExpense.createdAt : nowIso,
      updatedAt: nowIso,
    };

    saveExpense(expenseToSave);
    setIsFormModalOpen(false);
    resetForm();
  };

  // Date filtering logic
  const todayStr = new Date().toISOString().split("T")[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  // Daily Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          exp.title.toLowerCase().includes(q) ||
          exp.expenseNumber.toLowerCase().includes(q) ||
          (exp.paidBy && exp.paidBy.toLowerCase().includes(q)) ||
          (exp.notes && exp.notes.toLowerCase().includes(q)) ||
          (exp.receiptNumber && exp.receiptNumber.toLowerCase().includes(q)) ||
          (exp.category && typeof exp.category === "string" && exp.category.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      // Category filter
      if (categoryFilter !== "all" && exp.category !== categoryFilter) {
        return false;
      }

      // Date timeframe filter
      if (dateFilter === "today") {
        return exp.date === todayStr;
      } else if (dateFilter === "yesterday") {
        return exp.date === yesterdayStr;
      } else if (dateFilter === "this-week") {
        const itemDate = new Date(exp.date);
        const diffTime = Math.abs(today.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      } else if (dateFilter === "this-month") {
        const curYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        return exp.date.startsWith(curYm);
      } else if (dateFilter === "custom") {
        if (customStartDate && exp.date < customStartDate) return false;
        if (customEndDate && exp.date > customEndDate) return false;
        return true;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.expenseNumber.localeCompare(a.expenseNumber));
  }, [expenses, searchQuery, categoryFilter, dateFilter, customStartDate, customEndDate, todayStr, yesterdayStr]);

  // Overall KPI metrics
  const todayTotal = useMemo(() => {
    return expenses
      .filter((e) => e.date === todayStr)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses, todayStr]);

  const thisWeekTotal = useMemo(() => {
    return expenses
      .filter((e) => {
        const itemDate = new Date(e.date);
        const diffTime = Math.abs(today.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const thisMonthTotal = useMemo(() => {
    const curYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return expenses
      .filter((e) => e.date.startsWith(curYm))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  // -------------------------------------------------------------
  // MONTHLY EXPENSES REPORT CALCULATIONS
  // -------------------------------------------------------------
  const [selectedYearNum, selectedMonthNum] = useMemo(() => {
    const parts = selectedMonth.split("-");
    return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
  }, [selectedMonth]);

  const monthName = useMemo(() => {
    const d = new Date(selectedYearNum, selectedMonthNum - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  }, [selectedYearNum, selectedMonthNum]);

  // All expenses belonging strictly to selectedMonth
  const monthlyExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.date.startsWith(selectedMonth))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [expenses, selectedMonth]);

  const totalMonthlySpend = useMemo(() => {
    return monthlyExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [monthlyExpenses]);

  // Days in month calculation
  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYearNum, selectedMonthNum, 0).getDate();
  }, [selectedYearNum, selectedMonthNum]);

  const dailyAverageMonthly = useMemo(() => {
    if (!daysInSelectedMonth) return 0;
    // If it's current month, divide by current day of month for accuracy
    const isCurrentMonth = selectedMonth === currentMonthStr;
    const effectiveDays = isCurrentMonth ? Math.max(1, today.getDate()) : daysInSelectedMonth;
    return totalMonthlySpend / effectiveDays;
  }, [totalMonthlySpend, daysInSelectedMonth, selectedMonth, currentMonthStr]);

  // Day-by-day aggregated data for chart (1st to 28/30/31st)
  const dailyChartData = useMemo(() => {
    const daysMap: Record<number, number> = {};
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      daysMap[d] = 0;
    }

    monthlyExpenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      const dayNum = expDate.getDate();
      if (daysMap[dayNum] !== undefined) {
        daysMap[dayNum] += Number(exp.amount) || 0;
      }
    });

    return Object.entries(daysMap).map(([day, amount]) => ({
      day: `${day}`,
      amount,
      formattedDay: `${day} ${monthName.split(" ")[0].substring(0, 3)}`,
    }));
  }, [monthlyExpenses, daysInSelectedMonth, monthName]);

  // Find highest expense day
  const highestExpenseDay = useMemo(() => {
    let max = 0;
    let day = "";
    dailyChartData.forEach((d) => {
      if (d.amount > max) {
        max = d.amount;
        day = d.formattedDay;
      }
    });
    return { day, amount: max };
  }, [dailyChartData]);

  // Category-wise Breakdown for Selected Month
  const monthlyCategoryBreakdown = useMemo(() => {
    const catMap: Record<string, { total: number; count: number }> = {};
    monthlyExpenses.forEach((exp) => {
      const cat = exp.category || "Miscellaneous / Other";
      if (!catMap[cat]) {
        catMap[cat] = { total: 0, count: 0 };
      }
      catMap[cat].total += Number(exp.amount) || 0;
      catMap[cat].count += 1;
    });

    const list = Object.entries(catMap).map(([name, val]) => ({
      name,
      amount: val.total,
      count: val.count,
      percentage: totalMonthlySpend > 0 ? (val.total / totalMonthlySpend) * 100 : 0,
      color: CATEGORY_COLORS[name] || "#64748b",
    }));

    return list.sort((a, b) => b.amount - a.amount);
  }, [monthlyExpenses, totalMonthlySpend]);

  const topCategory = monthlyCategoryBreakdown[0] || null;

  // Month navigation helpers
  const handlePrevMonth = () => {
    let y = selectedYearNum;
    let m = selectedMonthNum - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    let y = selectedYearNum;
    let m = selectedMonthNum + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  // Export Daily / Monthly to CSV
  const exportToCsv = async (dataToExport: Expense[], filename: string) => {
    const headers = [
      "Expense No",
      "Date",
      "Title / Description",
      "Category",
      "Amount (PKR)",
      "Payment Method",
      "Paid By",
      "Receipt / Bill No",
      "Notes",
    ];

    const rows = dataToExport.map((e) => [
      `"${e.expenseNumber}"`,
      `"${e.date}"`,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      `"${e.paymentMethod || "Cash"}"`,
      `"${(e.paidBy || "").replace(/"/g, '""')}"`,
      `"${(e.receiptNumber || "").replace(/"/g, '""')}"`,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    await downloadTextFileSafely(csvText, filename, "text/csv;charset=utf-8;");
  };

  return (
    <div id="expenses-view" className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold">
            <Receipt className="w-3.5 h-3.5" />
            <span>Pharmacy Expenses &amp; Petty Cash</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Daily Expenses &amp; Monthly Reports
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Record daily pharmacy expenses, track petty cash, and create detailed monthly expense audit reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            id="btn-add-expense"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Daily Expense</span>
          </button>

          {activeSubTab === "monthly" ? (
            <button
              id="btn-print-monthly-report"
              onClick={() => setIsPrintMonthlyModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-lg border border-slate-300 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Monthly Report</span>
            </button>
          ) : (
            <button
              id="btn-export-daily-csv"
              onClick={() => exportToCsv(filteredExpenses, `expenses_log_${todayStr}.csv`)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-lg border border-slate-300 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Expense */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Expenses</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rs. {todayTotal.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total spent today
            </p>
          </div>
        </div>

        {/* This Week's Expense */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">This Week (7 Days)</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rs. {thisWeekTotal.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Last 7 days total
            </p>
          </div>
        </div>

        {/* This Month's Total */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">This Month (Current)</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              Rs. {thisMonthTotal.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Current month total
            </p>
          </div>
        </div>

        {/* Total Expense Entries */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Records</span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {expenses.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registered vouchers &amp; entries
            </p>
          </div>
        </div>
      </div>

      {/* Quick Presets Bar (1-Click Common Pharmacy Expenses) */}
      <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/50 rounded-xl border border-blue-100 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Quick 1-Click Daily Expense Presets</span>
          </div>
          <span className="text-xs text-slate-500">
            Click any button to quickly pre-fill and save daily pharmacy cash spends:
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              applyQuickPreset({
                title: "Daily Staff Tea & Biscuits",
                category: "Tea & Refreshments",
                amount: 300,
                notes: "Morning & evening tea for pharmacy staff",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-orange-50 text-slate-800 hover:text-orange-700 border border-slate-200 hover:border-orange-300 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Coffee className="w-3.5 h-3.5 text-orange-500" />
            <span>+ Staff Tea (Rs. 300)</span>
          </button>

          <button
            onClick={() =>
              applyQuickPreset({
                title: "Delivery Bike Petrol / Fuel",
                category: "Transport & Delivery",
                amount: 500,
                notes: "Petrol for local medicine orders delivery",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-cyan-50 text-slate-800 hover:text-cyan-700 border border-slate-200 hover:border-cyan-300 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5 text-cyan-600" />
            <span>+ Delivery Petrol (Rs. 500)</span>
          </button>

          <button
            onClick={() =>
              applyQuickPreset({
                title: "Medicine Plastic Bags & Packing Tape",
                category: "Packaging & Stationery",
                amount: 1200,
                notes: "Bundles of printed plastic shopper bags",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-slate-800 hover:text-purple-700 border border-slate-200 hover:border-purple-300 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-purple-600" />
            <span>+ Packing Bags (Rs. 1,200)</span>
          </button>

          <button
            onClick={() =>
              applyQuickPreset({
                title: "Generator Petrol (Load Shedding)",
                category: "Generator & Fuel",
                amount: 1500,
                notes: "Petrol for backup generator for refrigerator & AC",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-slate-800 hover:text-red-700 border border-slate-200 hover:border-red-300 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-red-500" />
            <span>+ Generator Petrol (Rs. 1,500)</span>
          </button>

          <button
            onClick={() =>
              applyQuickPreset({
                title: "Store Cleaning Supplies & Phenyl",
                category: "Cleaning & Maintenance",
                amount: 400,
                notes: "Floor cleaner, mop, dusting cloth",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>+ Cleaning Supplies (Rs. 400)</span>
          </button>

          <button
            onClick={() =>
              applyQuickPreset({
                title: "Thermal Billing Paper Rolls",
                category: "Packaging & Stationery",
                amount: 800,
                notes: "10 rolls thermal receipt paper",
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-600" />
            <span>+ Billing Paper (Rs. 800)</span>
          </button>
        </div>
      </div>

      {/* Main Mode Selector: [Daily Expenses Log] vs [Monthly Expense Report] */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveSubTab("daily")}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "daily"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Daily Expenses Log</span>
          <span className="ml-1.5 px-2 py-0.5 text-xs bg-slate-100 rounded-full font-semibold text-slate-600">
            {filteredExpenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("monthly")}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-colors cursor-pointer ${
            activeSubTab === "monthly"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Monthly Expense Report</span>
          <span className="ml-1.5 px-2 py-0.5 text-xs bg-blue-100 rounded-full font-semibold text-blue-700">
            {monthName}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY EXPENSES LOG & TABLE                                         */}
      {/* ========================================================================= */}
      {activeSubTab === "daily" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expense description, paid by, receipt #, notes..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="w-full md:w-56 shrink-0">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Expense Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Timeframe Filter */}
            <div className="w-full md:w-48 shrink-0">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="this-month">This Month</option>
                <option value="today">Today Only</option>
                <option value="yesterday">Yesterday</option>
                <option value="this-week">Past 7 Days</option>
                <option value="all">All Records</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>
          </div>

          {/* Custom Date Inputs if "custom" selected */}
          {dateFilter === "custom" && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">From Date:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50"
              />
              <span className="font-semibold text-slate-700">To Date:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50"
              />
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="text-xs text-red-600 hover:underline cursor-pointer"
                >
                  Clear range
                </button>
              )}
            </div>
          )}

          {/* Daily Expenses Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date &amp; No.</th>
                    <th className="py-3 px-4">Description / Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Method &amp; Paid By</th>
                    <th className="py-3 px-4 text-right">Amount (PKR)</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 text-sm">No expenses found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Try changing the filter or click "+ Add Daily Expense" to record a new expense.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const catColor = CATEGORY_COLORS[exp.category] || "#64748b";
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{exp.date}</div>
                            <div className="text-[11px] font-mono text-slate-400">{exp.expenseNumber}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{exp.title}</div>
                            {exp.notes && (
                              <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{exp.notes}</div>
                            )}
                            {exp.receiptNumber && (
                              <div className="text-[11px] font-mono text-blue-600 mt-0.5">
                                Ref/Bill: {exp.receiptNumber}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                              style={{
                                backgroundColor: `${catColor}15`,
                                color: catColor,
                                borderColor: `${catColor}30`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: catColor }}
                              />
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                              {exp.paymentMethod === "Cash" && (
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              {exp.paymentMethod === "Bank Transfer" && (
                                <Building className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              {exp.paymentMethod === "EasyPaisa / JazzCash" && (
                                <Smartphone className="w-3.5 h-3.5 text-orange-600" />
                              )}
                              {exp.paymentMethod === "Cheque" && (
                                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                              )}
                              <span>{exp.paymentMethod || "Cash"}</span>
                            </div>
                            {exp.paidBy && (
                              <div className="text-[11px] text-slate-500 mt-0.5">By: {exp.paidBy}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-black text-slate-900 font-mono text-sm sm:text-base">
                              Rs. {Number(exp.amount).toLocaleString("en-PK")}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View / Print Voucher */}
                              <button
                                onClick={() => setVoucherExpense(exp)}
                                title="Print / View Expense Voucher"
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => openEditModal(exp)}
                                title="Edit Expense"
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeletingId(exp.id)}
                                title="Delete Expense"
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                {filteredExpenses.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td colSpan={4} className="py-3.5 px-4 text-right uppercase text-xs">
                        Total Filtered Expenses ({filteredExpenses.length} entries):
                      </td>
                      <td className="py-3.5 px-4 text-right font-black font-mono text-base text-blue-700">
                        Rs.{" "}
                        {filteredExpenses
                          .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
                          .toLocaleString("en-PK")}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONTHLY EXPENSES REPORT                                            */}
      {/* ========================================================================= */}
      {activeSubTab === "monthly" && (
        <div className="space-y-6">
          {/* Month Selector Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {monthName}
                </span>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportToCsv(monthlyExpenses, `monthly_expenses_${selectedMonth}.csv`)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Month CSV</span>
              </button>

              <button
                onClick={() => setIsPrintMonthlyModalOpen(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Monthly Report</span>
              </button>
            </div>
          </div>

          {/* Monthly Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Total Monthly Expense
              </span>
              <div className="text-2xl font-black text-blue-700 font-mono tracking-tight">
                Rs. {totalMonthlySpend.toLocaleString("en-PK")}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Total spent this month ({monthlyExpenses.length} entries)
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Daily Average Spend
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                Rs. {Math.round(dailyAverageMonthly).toLocaleString("en-PK")}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Average spend per day
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Peak Expense Day
              </span>
              <div className="text-xl font-bold text-slate-900 tracking-tight">
                {highestExpenseDay.day || "None"}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {highestExpenseDay.amount > 0
                  ? `Rs. ${highestExpenseDay.amount.toLocaleString("en-PK")}`
                  : "No spikes recorded"}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Top Expense Category
              </span>
              <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {topCategory ? topCategory.name : "N/A"}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {topCategory
                  ? `Rs. ${topCategory.amount.toLocaleString("en-PK")} (${topCategory.percentage.toFixed(1)}%)`
                  : "No data"}
              </p>
            </div>
          </div>

          {/* Daily Trend Chart (Day-by-Day Spends in Month) */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Daily Expense Trend — {monthName}
                </h3>
                <p className="text-xs text-slate-500">
                  Day-by-day expenditure breakdown for the entire month (1st to {daysInSelectedMonth}th)
                </p>
              </div>
              <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-md">
                Total Month Days: {daysInSelectedMonth}
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="day" tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                  />
                  <Tooltip
                    formatter={(val: number) => [`Rs. ${val.toLocaleString("en-PK")}`, "Expenses"]}
                    labelFormatter={(label) => `Day ${label} (${monthName.split(" ")[0]})`}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderRadius: "8px",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category-Wise Breakdown Grid (Chart + Detailed Ledger Table) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Category Donut & List (5 cols) */}
            <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                <span>Category Distribution ({monthName})</span>
              </h3>

              {monthlyCategoryBreakdown.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs">
                  No expense records in this month.
                </div>
              ) : (
                <>
                  <div className="h-48 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={monthlyCategoryBreakdown}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {monthlyCategoryBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [`Rs. ${val.toLocaleString("en-PK")}`, "Amount"]}
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            borderRadius: "8px",
                            color: "#fff",
                            border: "none",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2.5 pt-2 max-h-72 overflow-y-auto pr-1">
                    {monthlyCategoryBreakdown.map((cat) => (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name} ({cat.count})
                          </span>
                          <span className="font-bold text-slate-900 font-mono">
                            Rs. {cat.amount.toLocaleString("en-PK")}{" "}
                            <span className="text-slate-400 font-normal">({cat.percentage.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Detailed Monthly Itemized Table (7 cols) */}
            <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Itemized Monthly Ledger ({monthlyExpenses.length} Records)</span>
                </h3>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                  Total: Rs. {totalMonthlySpend.toLocaleString("en-PK")}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr className="text-slate-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Item / Description</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400">
                          No expenses registered in {monthName}.
                        </td>
                      </tr>
                    ) : (
                      monthlyExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {exp.date}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{exp.title}</div>
                            {exp.paidBy && (
                              <div className="text-[10px] text-slate-400">Paid by: {exp.paidBy}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                            Rs. {Number(exp.amount).toLocaleString("en-PK")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {monthlyExpenses.length > 0 && (
                    <tfoot className="sticky bottom-0 bg-slate-100 font-bold border-t border-slate-300">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px]">
                          Grand Total ({monthName}):
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-blue-700">
                          Rs. {totalMonthlySpend.toLocaleString("en-PK")}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT EXPENSE                                              */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  <span>{editingExpense ? "Edit Expense Entry" : "Record Daily Expense"}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {editingExpense ? `Updating ${editingExpense.expenseNumber}` : "Enter cash/bill expense details"}
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-xs sm:text-sm">
              {/* Title / Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expense Description / Item <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staff Evening Tea, Shop Electricity Bill, Delivery Fuel"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Amount & Date in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount (PKR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">Rs.</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Expense Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Category & Payment Method in 2 cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Paid By & Receipt/Bill Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Paid By / Staff</label>
                  <input
                    type="text"
                    placeholder="e.g. Adnan, Malik Sahib"
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill / Receipt / Ref #</label>
                  <input
                    type="text"
                    placeholder="e.g. RCP-1049, MEPCO-001"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional details, item quantity, or voucher notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  {editingExpense ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION                                                */}
      {/* ========================================================================= */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Expense Entry?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete this expense from your records? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteExpense(deletingId);
                  setDeletingId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EXPENSE VOUCHER / RECEIPT VIEWER                                    */}
      {/* ========================================================================= */}
      {voucherExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm">Payment Voucher</span>
              </div>
              <button
                onClick={() => setVoucherExpense(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Voucher Card */}
            <div id="printable-expense-voucher" className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="text-center border-b border-slate-200 pb-2">
                <h4 className="font-black text-slate-900 text-base uppercase tracking-tight">
                  {settings.pharmacyName || "AK Pharmacy"}
                </h4>
                <p className="text-[11px] text-slate-500">{settings.address}</p>
                <p className="text-[11px] text-slate-500">Ph: {settings.phone}</p>
                <div className="inline-block mt-1 px-2 py-0.5 bg-slate-200 text-slate-800 font-bold rounded text-[10px] tracking-wider uppercase">
                  Cash Payment Voucher
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Voucher No:</span>
                  <span className="font-mono font-bold text-slate-900">{voucherExpense.expenseNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Date:</span>
                  <span className="font-bold text-slate-900">{voucherExpense.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Category:</span>
                  <span className="font-semibold text-slate-900">{voucherExpense.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Payment Method:</span>
                  <span className="font-semibold text-slate-900">{voucherExpense.paymentMethod}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px]">Description:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{voucherExpense.title}</p>
                {voucherExpense.notes && (
                  <p className="text-slate-500 text-xs mt-1 italic">{voucherExpense.notes}</p>
                )}
                {voucherExpense.receiptNumber && (
                  <p className="text-blue-600 font-mono text-xs mt-1">Ref/Bill #: {voucherExpense.receiptNumber}</p>
                )}
              </div>

              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-lg">
                <span className="font-bold text-blue-900 uppercase text-xs">Total Amount Paid:</span>
                <span className="font-black font-mono text-base text-blue-700">
                  Rs. {Number(voucherExpense.amount).toLocaleString("en-PK")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500">
                <div>
                  <div className="border-b border-slate-300 pb-1 font-semibold text-slate-800">
                    {voucherExpense.paidBy || settings.preparedBy || "Staff"}
                  </div>
                  <span className="mt-1 block">Paid By / Signature</span>
                </div>
                <div>
                  <div className="border-b border-slate-300 pb-1 font-semibold text-slate-800">
                    {settings.preparedBy || "Manager"}
                  </div>
                  <span className="mt-1 block">Authorized / Approved</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setVoucherExpense(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINTABLE MONTHLY EXPENSES AUDIT REPORT                            */}
      {/* ========================================================================= */}
      {isPrintMonthlyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Top Toolbar (Hidden during actual paper print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-slate-900 text-base">Monthly Expenses Audit Report</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document / Save PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintMonthlyModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Document Body */}
            <div id="printable-monthly-report-document" className="space-y-6 text-slate-800">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {settings.pharmacyName || "AK Pharmacy"}
                </h1>
                <p className="text-xs text-slate-600">{settings.address}</p>
                <p className="text-xs text-slate-600">
                  Tel: {settings.phone} | Drug License: {settings.licenseNo} | NTN: {settings.ntn}
                </p>
                <div className="mt-2 inline-block px-4 py-1 bg-slate-100 border border-slate-300 rounded-md font-bold text-sm text-slate-900 tracking-wider uppercase">
                  Monthly Expenses Summary &amp; Audit Report — {monthName}
                </div>
              </div>

              {/* High-level KPIs */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Spend</span>
                  <span className="text-base font-black font-mono text-blue-700">
                    Rs. {totalMonthlySpend.toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Entries</span>
                  <span className="text-base font-black font-mono text-slate-900">
                    {monthlyExpenses.length}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Daily Average</span>
                  <span className="text-base font-black font-mono text-slate-900">
                    Rs. {Math.round(dailyAverageMonthly).toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Top Category</span>
                  <span className="text-xs font-bold text-slate-900 block truncate mt-1">
                    {topCategory ? topCategory.name : "N/A"}
                  </span>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                  1. Category-Wise Expenditure Breakdown
                </h4>
                <table className="w-full text-left text-xs border-collapse border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2 px-3 border border-slate-200">Category Name</th>
                      <th className="py-2 px-3 border border-slate-200 text-center">Entries</th>
                      <th className="py-2 px-3 border border-slate-200 text-right">% of Total</th>
                      <th className="py-2 px-3 border border-slate-200 text-right">Total Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyCategoryBreakdown.map((c) => (
                      <tr key={c.name} className="border-b border-slate-200">
                        <td className="py-1.5 px-3 border border-slate-200 font-semibold">{c.name}</td>
                        <td className="py-1.5 px-3 border border-slate-200 text-center">{c.count}</td>
                        <td className="py-1.5 px-3 border border-slate-200 text-right">{c.percentage.toFixed(1)}%</td>
                        <td className="py-1.5 px-3 border border-slate-200 text-right font-mono font-bold">
                          Rs. {c.amount.toLocaleString("en-PK")}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={3} className="py-2 px-3 border border-slate-200 text-right uppercase">
                        Total Monthly Expense:
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-right font-mono font-black text-blue-700">
                        Rs. {totalMonthlySpend.toLocaleString("en-PK")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Complete Itemized Ledger */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                  2. Itemized Expenditure Ledger ({monthName})
                </h4>
                <table className="w-full text-left text-xs border-collapse border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2 px-2.5 border border-slate-200">Date</th>
                      <th className="py-2 px-2.5 border border-slate-200">Voucher #</th>
                      <th className="py-2 px-2.5 border border-slate-200">Description</th>
                      <th className="py-2 px-2.5 border border-slate-200">Category</th>
                      <th className="py-2 px-2.5 border border-slate-200">Method</th>
                      <th className="py-2 px-2.5 border border-slate-200">Paid By</th>
                      <th className="py-2 px-2.5 border border-slate-200 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-slate-200">
                        <td className="py-1.5 px-2.5 border border-slate-200 whitespace-nowrap">{e.date}</td>
                        <td className="py-1.5 px-2.5 border border-slate-200 font-mono text-[11px] whitespace-nowrap">
                          {e.expenseNumber}
                        </td>
                        <td className="py-1.5 px-2.5 border border-slate-200 font-medium">
                          {e.title}
                          {e.receiptNumber && (
                            <span className="text-slate-500 font-mono ml-1 text-[10px]">({e.receiptNumber})</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 border border-slate-200 whitespace-nowrap">{e.category}</td>
                        <td className="py-1.5 px-2.5 border border-slate-200 whitespace-nowrap">{e.paymentMethod}</td>
                        <td className="py-1.5 px-2.5 border border-slate-200 whitespace-nowrap">{e.paidBy || "-"}</td>
                        <td className="py-1.5 px-2.5 border border-slate-200 text-right font-mono font-bold whitespace-nowrap">
                          Rs. {Number(e.amount).toLocaleString("en-PK")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black">
                      <td colSpan={6} className="py-2.5 px-3 border border-slate-200 text-right uppercase">
                        Net Total For Month ({monthName}):
                      </td>
                      <td className="py-2.5 px-3 border border-slate-200 text-right font-mono text-blue-800">
                        Rs. {totalMonthlySpend.toLocaleString("en-PK")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures Footer */}
              <div className="grid grid-cols-3 gap-8 pt-8 text-center text-xs text-slate-600">
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-900">
                    {settings.preparedBy || "Accountant / Cashier"}
                  </div>
                  <span className="mt-1 block text-[11px]">Prepared By</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-900">
                    Audit &amp; Accounts
                  </div>
                  <span className="mt-1 block text-[11px]">Verified &amp; Checked By</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-900">
                    Managing Director / Owner
                  </div>
                  <span className="mt-1 block text-[11px]">Authorized Approval</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 text-center pt-2">
                Report generated on {today.toLocaleDateString("en-PK")} {today.toLocaleTimeString()} | {settings.pharmacyName}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
