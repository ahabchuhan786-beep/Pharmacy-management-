import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { ReportTimeframe } from "../types";
import { downloadTextFileSafely } from "../utils/pdfGenerator";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Package,
  RotateCcw,
  Calendar,
  Download,
  Printer,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  PieChart as PieIcon,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Receipt,
  Coins,
  Scale,
  Percent,
  Search,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  Tag,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type ExtendedTimeframe = ReportTimeframe | "custom" | "all";

const formatDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "";
  const parts = isoDate.slice(0, 10).split("-");
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mName = months[Math.max(0, Math.min(11, Number(m) - 1))] || m;
  return `${d} ${mName} ${y}`;
};

export const ReportsView: React.FC = () => {
  const {
    orders,
    purchases,
    returns,
    expenses,
    stockAdjustments,
    currentProducts,
    setActiveNavTab,
    getStockSummaries,
    settings,
  } = useApp();

  const now = new Date();
  const toIsoDateLocal = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const todayStr = toIsoDateLocal(now);
  const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thirtyDaysAgoStr = toIsoDateLocal(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const [timeframe, setTimeframe] = useState<ExtendedTimeframe>("monthly");
  const [customStartDate, setCustomStartDate] = useState<string>(firstOfMonthStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const [activeLedgerTab, setActiveLedgerTab] = useState<"profit" | "daily" | "stock">("profit");
  const [profitSearchQuery, setProfitSearchQuery] = useState<string>("");
  const [profitCategoryFilter, setProfitCategoryFilter] = useState<string>("all");
  const [profitStatusFilter, setProfitStatusFilter] = useState<string>("all");

  const [stockSearchQuery, setStockSearchQuery] = useState<string>("");
  const [selectedStockCategory, setSelectedStockCategory] = useState<string>("all");

  const [activeChartType, setActiveChartType] = useState<"profit" | "financial" | "units">("profit");

  // Resolve effective [startDate, endDate] range for the active timeframe
  const effectiveDateRange = useMemo((): { start: string; end: string; label: string } => {
    if (timeframe === "all") {
      return { start: "", end: "", label: "All Time" };
    }
    if (timeframe === "daily") {
      return { start: todayStr, end: todayStr, label: `Today (${formatDisplayDate(todayStr)})` };
    }
    if (timeframe === "weekly") {
      const weekStart = toIsoDateLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      return { start: weekStart, end: todayStr, label: `${formatDisplayDate(weekStart)} – ${formatDisplayDate(todayStr)}` };
    }
    if (timeframe === "monthly") {
      return { start: firstOfMonthStr, end: todayStr, label: `${formatDisplayDate(firstOfMonthStr)} – ${formatDisplayDate(todayStr)}` };
    }
    if (timeframe === "yearly") {
      const yearStart = `${now.getFullYear()}-01-01`;
      return { start: yearStart, end: todayStr, label: `Year ${now.getFullYear()}` };
    }
    // custom range (auto-normalize if user picked end before start)
    const s = customStartDate ? customStartDate.slice(0, 10) : "";
    const e = customEndDate ? customEndDate.slice(0, 10) : "";
    const start = s && e && s > e ? e : s;
    const end = s && e && s > e ? s : e;
    if (start && end) {
      return { start, end, label: `${formatDisplayDate(start)} – ${formatDisplayDate(end)}` };
    }
    if (start) {
      return { start, end: "", label: `From ${formatDisplayDate(start)}` };
    }
    if (end) {
      return { start: "", end, label: `Up to ${formatDisplayDate(end)}` };
    }
    return { start: "", end: "", label: "Custom Range" };
  }, [timeframe, customStartDate, customEndDate, todayStr, firstOfMonthStr]);

  const applyTimeframePreset = (tf: ExtendedTimeframe) => {
    setTimeframe(tf);
    if (tf === "daily") {
      setCustomStartDate(todayStr);
      setCustomEndDate(todayStr);
    } else if (tf === "weekly") {
      setCustomStartDate(toIsoDateLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)));
      setCustomEndDate(todayStr);
    } else if (tf === "monthly") {
      setCustomStartDate(firstOfMonthStr);
      setCustomEndDate(todayStr);
    } else if (tf === "yearly") {
      setCustomStartDate(`${now.getFullYear()}-01-01`);
      setCustomEndDate(todayStr);
    } else if (tf === "all") {
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  // Date filtering logic based on normalized YYYY-MM-DD
  const isWithinTimeframe = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const dateKey = dateStr.slice(0, 10);
    if (timeframe === "all") return true;
    const { start, end } = effectiveDateRange;
    if (start && dateKey < start) return false;
    if (end && dateKey > end) return false;
    return true;
  };

  // Filtered datasets based on selected timeframe / date range
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => isWithinTimeframe(ord.orderDate));
  }, [orders, timeframe, effectiveDateRange]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((pur) => isWithinTimeframe(pur.purchaseDate));
  }, [purchases, timeframe, effectiveDateRange]);

  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => isWithinTimeframe(ret.returnDate));
  }, [returns, timeframe, effectiveDateRange]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => isWithinTimeframe(exp.date));
  }, [expenses, timeframe, effectiveDateRange]);

  // Stock inventory ledger
  const allStockSummaries = useMemo(() => {
    return getStockSummaries();
  }, [getStockSummaries, purchases, orders, returns, stockAdjustments]);

  // Product Purchase Cost & Rate mapping from master inventory & purchase batches
  const productCostMap = useMemo(() => {
    const map = new Map<string, { costPrice: number; salePrice: number; category: string; code?: string }>();
    
    currentProducts.forEach((p) => {
      const cost = p.costPrice !== undefined && p.costPrice > 0 
        ? Number(p.costPrice) 
        : Math.round((Number(p.price) || 0) * 0.78);
      
      map.set(p.id, { costPrice: cost, salePrice: p.price, category: p.category, code: p.productCode });
      map.set(p.name.toLowerCase().trim(), { costPrice: cost, salePrice: p.price, category: p.category, code: p.productCode });
    });

    // Overlay actual inward purchase bills weighted average unit cost if available
    allStockSummaries.forEach((s) => {
      if (s.unitCost > 0) {
        if (s.productId && map.has(s.productId)) {
          const existing = map.get(s.productId)!;
          map.set(s.productId, { ...existing, costPrice: s.unitCost });
        }
        const norm = s.productName.toLowerCase().trim();
        if (map.has(norm)) {
          const existing = map.get(norm)!;
          map.set(norm, { ...existing, costPrice: s.unitCost });
        }
      }
    });

    return map;
  }, [currentProducts, allStockSummaries]);

  // Product-wise Sales, Original Purchase Cost (COGS), and Realized Profit Analysis
  const productSalesProfitReport = useMemo(() => {
    const prodMap = new Map<string, {
      productId: string;
      productName: string;
      productCode: string;
      category: string;
      unitsSold: number;
      totalRevenue: number;
      unitCost: number;
    }>();

    filteredOrders.forEach((ord) => {
      ord.items.forEach((it) => {
        const pId = it.productId || it.productName.toLowerCase().trim();
        const normName = (it.productName || "").toLowerCase().trim();
        const info = productCostMap.get(it.productId) || productCostMap.get(normName);

        const unitCost = info?.costPrice ?? Math.round((Number(it.rate) || 0) * 0.78);
        const category = info?.category || "General Supplies";
        const code = info?.code || "";
        const qty = Number(it.quantity) || 0;
        const amt = Number(it.amount) || (qty * (Number(it.rate) || 0));

        const existing = prodMap.get(pId) || {
          productId: it.productId || pId,
          productName: it.productName,
          productCode: code,
          category,
          unitsSold: 0,
          totalRevenue: 0,
          unitCost,
        };

        existing.unitsSold += qty;
        existing.totalRevenue += amt;
        prodMap.set(pId, existing);
      });
    });

    const list: Array<{
      productId: string;
      productName: string;
      productCode: string;
      category: string;
      unitsSold: number;
      unitCost: number; // Purchase Rate
      avgSaleRate: number; // Average Sale Rate
      totalCost: number; // Total Purchase Cost of sold units
      totalRevenue: number; // Total Sale Revenue
      profit: number; // Profit in Rupees
      marginPct: number; // Margin %
      profitStatus: "High Profit" | "Normal" | "Low Margin" | "Loss";
    }> = [];

    prodMap.forEach((val) => {
      const totalCost = Math.round(val.unitsSold * val.unitCost);
      const profit = Math.round(val.totalRevenue - totalCost);
      const marginPct = val.totalRevenue > 0 ? (profit / val.totalRevenue) * 100 : 0;
      const avgSaleRate = val.unitsSold > 0 ? Math.round(val.totalRevenue / val.unitsSold) : 0;

      let profitStatus: "High Profit" | "Normal" | "Low Margin" | "Loss" = "Normal";
      if (profit < 0) {
        profitStatus = "Loss";
      } else if (marginPct >= 28) {
        profitStatus = "High Profit";
      } else if (marginPct < 15) {
        profitStatus = "Low Margin";
      }

      list.push({
        productId: val.productId,
        productName: val.productName,
        productCode: val.productCode,
        category: val.category,
        unitsSold: val.unitsSold,
        unitCost: val.unitCost,
        avgSaleRate,
        totalCost,
        totalRevenue: Math.round(val.totalRevenue),
        profit,
        marginPct,
        profitStatus,
      });
    });

    // Sort by profit descending by default
    list.sort((a, b) => b.profit - a.profit);
    return list;
  }, [filteredOrders, productCostMap]);

  // Actual current-invoice Sale Revenue excludes any carried-forward previousPendingAmount
  // so old customer pending dues added onto a new invoice are NEVER counted as new sales or profit.
  const getOrderNetSaleRevenue = (o: { grandTotal?: number; previousPendingAmount?: number }) => {
    const prevPending = Number(o.previousPendingAmount) || 0;
    const grandTotal = Number(o.grandTotal) || 0;
    return Math.max(0, grandTotal - prevPending);
  };

  // Aggregate Metrics for Timeframe
  const totalSalesAmount = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + getOrderNetSaleRevenue(o), 0);
  }, [filteredOrders]);

  const totalPreviousPendingExcluded = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (Number(o.previousPendingAmount) || 0), 0);
  }, [filteredOrders]);

  const totalSalesUnits = useMemo(() => {
    return filteredOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      0
    );
  }, [filteredOrders]);

  const totalSoldProductsCost = useMemo(() => {
    return productSalesProfitReport.reduce((sum, p) => sum + p.totalCost, 0);
  }, [productSalesProfitReport]);

  const totalSalesGrossProfit = Math.round(totalSalesAmount - totalSoldProductsCost);
  const overallSalesMarginPct = totalSalesAmount > 0 
    ? ((totalSalesGrossProfit / totalSalesAmount) * 100) 
    : 0;

  const totalPurchasesAmount = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0);
  }, [filteredPurchases]);

  const totalPurchasesUnits = useMemo(() => {
    return filteredPurchases.reduce(
      (sum, p) => sum + p.items.reduce((s, it) => s + (Number(it.quantity) || 0) + (Number(it.bon) || 0), 0),
      0
    );
  }, [filteredPurchases]);

  const totalExpensesAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const totalReturnsAmount = useMemo(() => {
    return filteredReturns.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  }, [filteredReturns]);

  const totalReturnsUnits = useMemo(() => {
    return filteredReturns.reduce(
      (sum, r) => sum + r.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
      0
    );
  }, [filteredReturns]);

  const totalSalesPaid = useMemo(() => {
    return filteredOrders.reduce(
      (sum, o) => sum + (o.paidAmount !== undefined ? Number(o.paidAmount) : Number(o.grandTotal)),
      0
    );
  }, [filteredOrders]);

  const totalSalesPending = useMemo(() => {
    return filteredOrders.reduce(
      (sum, o) =>
        sum +
        (o.pendingAmount !== undefined
          ? Number(o.pendingAmount)
          : Math.max(0, Number(o.grandTotal) - (o.paidAmount || 0))),
      0
    );
  }, [filteredOrders]);

  // Final Net Business Profit = Gross Profit on Sales - Operating Expenses
  const netBusinessProfit = Math.round(totalSalesGrossProfit - totalExpensesAmount);

  // Period Cash Flow Balance = Sales Revenue - Inward Purchases - Expenses
  const periodCashDifference = Math.round(totalSalesAmount - totalPurchasesAmount - totalExpensesAmount);

  // Filtered Profit Table
  const filteredProfitReport = useMemo(() => {
    return productSalesProfitReport.filter((p) => {
      const matchesCat = profitCategoryFilter === "all" || p.category === profitCategoryFilter;
      const q = profitSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q);
      const matchesStatus = profitStatusFilter === "all" || p.profitStatus === profitStatusFilter;
      return matchesCat && matchesSearch && matchesStatus;
    });
  }, [productSalesProfitReport, profitCategoryFilter, profitSearchQuery, profitStatusFilter]);

  // Filtered Stock Table
  const filteredStockSummaries = useMemo(() => {
    return allStockSummaries.filter((stk) => {
      const matchesCat = selectedStockCategory === "all" || stk.category === selectedStockCategory;
      const q = stockSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        stk.productName.toLowerCase().includes(q) ||
        (stk.productCode && stk.productCode.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [allStockSummaries, selectedStockCategory, stockSearchQuery]);

  const totalStockOnHandUnits = allStockSummaries.reduce((sum, s) => sum + s.currentStock, 0);
  const totalStockCostValuation = allStockSummaries.reduce((sum, s) => sum + s.stockValueCost, 0);
  const totalStockRetailValuation = allStockSummaries.reduce((sum, s) => sum + s.stockValueRetail, 0);

  // Categories list
  const categoriesList = useMemo(() => {
    const cats = new Set(allStockSummaries.map((s) => s.category));
    return Array.from(cats).filter(Boolean);
  }, [allStockSummaries]);

  // Date-wise aggregated ledger for exact day-by-day reporting across the selected date range
  const dailyBreakdownReport = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        date: string;
        ordersCount: number;
        unitsSold: number;
        salesRevenue: number;
        productCost: number;
        grossProfit: number;
        purchasesCount: number;
        purchasesAmount: number;
        expensesAmount: number;
        returnsAmount: number;
      }
    >();

    const ensureDay = (dateKey: string) => {
      const key = dateKey.slice(0, 10);
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          date: key,
          ordersCount: 0,
          unitsSold: 0,
          salesRevenue: 0,
          productCost: 0,
          grossProfit: 0,
          purchasesCount: 0,
          purchasesAmount: 0,
          expensesAmount: 0,
          returnsAmount: 0,
        });
      }
      return dayMap.get(key)!;
    };

    filteredOrders.forEach((ord) => {
      if (!ord.orderDate) return;
      const entry = ensureDay(ord.orderDate);
      entry.ordersCount += 1;
      entry.salesRevenue += getOrderNetSaleRevenue(ord);
      ord.items.forEach((it) => {
        const qty = Number(it.quantity) || 0;
        const normName = (it.productName || "").toLowerCase().trim();
        const info = productCostMap.get(it.productId) || productCostMap.get(normName);
        const unitCost = info?.costPrice ?? Math.round((Number(it.rate) || 0) * 0.78);
        entry.unitsSold += qty;
        entry.productCost += Math.round(qty * unitCost);
      });
    });

    filteredPurchases.forEach((pur) => {
      if (!pur.purchaseDate) return;
      const entry = ensureDay(pur.purchaseDate);
      entry.purchasesCount += 1;
      entry.purchasesAmount += Number(pur.grandTotal) || 0;
    });

    filteredExpenses.forEach((exp) => {
      if (!exp.date) return;
      const entry = ensureDay(exp.date);
      entry.expensesAmount += Number(exp.amount) || 0;
    });

    filteredReturns.forEach((ret) => {
      if (!ret.returnDate) return;
      const entry = ensureDay(ret.returnDate);
      entry.returnsAmount += Number(ret.totalAmount) || 0;
    });

    const rows = Array.from(dayMap.values()).map((r) => ({
      ...r,
      salesRevenue: Math.round(r.salesRevenue),
      grossProfit: Math.round(r.salesRevenue - r.productCost),
      purchasesAmount: Math.round(r.purchasesAmount),
      expensesAmount: Math.round(r.expensesAmount),
      returnsAmount: Math.round(r.returnsAmount),
    }));

    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [filteredOrders, filteredPurchases, filteredExpenses, filteredReturns, productCostMap]);

  // Real Date-driven Chart Data Generation
  const chartData = useMemo(() => {
    if (dailyBreakdownReport.length === 0) {
      return [
        {
          label: effectiveDateRange.label,
          sales: 0,
          cost: 0,
          profit: 0,
          purchases: 0,
          returns: 0,
        },
      ];
    }

    // Group by month when span is yearly/all or exceeds 45 days; otherwise plot chronological dates
    const ascending = [...dailyBreakdownReport].sort((a, b) => a.date.localeCompare(b.date));
    const useMonthlyBuckets = timeframe === "yearly" || ascending.length > 45;

    if (useMonthlyBuckets) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthMap = new Map<
        string,
        { label: string; sales: number; cost: number; profit: number; purchases: number; returns: number }
      >();

      ascending.forEach((d) => {
        const ym = d.date.slice(0, 7);
        const [y, m] = ym.split("-");
        const mLabel = `${monthNames[Math.max(0, Number(m) - 1)] || m} ${y.slice(2)}`;
        const cur = monthMap.get(ym) || { label: mLabel, sales: 0, cost: 0, profit: 0, purchases: 0, returns: 0 };
        cur.sales += d.salesRevenue;
        cur.cost += d.productCost;
        cur.profit += d.grossProfit;
        cur.purchases += d.purchasesAmount;
        cur.returns += d.returnsAmount;
        monthMap.set(ym, cur);
      });

      return Array.from(monthMap.values());
    }

    return ascending.map((d) => {
      const parts = d.date.split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const shortLabel = parts.length === 3 ? `${parts[2]} ${months[Math.max(0, Number(parts[1]) - 1)]}` : d.date;
      return {
        label: shortLabel,
        sales: d.salesRevenue,
        cost: d.productCost,
        profit: d.grossProfit,
        purchases: d.purchasesAmount,
        returns: d.returnsAmount,
      };
    });
  }, [dailyBreakdownReport, timeframe, effectiveDateRange.label]);

  // Category Sales Distribution Pie Data
  const categoryPieData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    productSalesProfitReport.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + p.totalRevenue;
    });
    const list = Object.keys(counts).map((cat) => ({
      name: cat,
      value: counts[cat],
    }));
    return list.length > 0 ? list : [{ name: "General Supplies", value: 1000 }];
  }, [productSalesProfitReport]);

  const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#64748b"];

  // Export to CSV Functionality
  const handleExportProfitCsv = async () => {
    const headers = [
      "Product Code",
      "Product Name",
      "Category",
      "Units Sold",
      "Unit Purchase Rate (PKR)",
      "Avg Sale Rate (PKR)",
      "Total Purchase Cost (PKR)",
      "Total Sale Revenue (PKR)",
      "Net Profit Earned (PKR)",
      "Margin (%)",
      "Status",
    ];

    const rows = filteredProfitReport.map((p) => [
      `"${p.productCode || "-"}"`,
      `"${p.productName.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.unitsSold,
      p.unitCost,
      p.avgSaleRate,
      p.totalCost,
      p.totalRevenue,
      p.profit,
      `${p.marginPct.toFixed(1)}%`,
      `"${p.profitStatus}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    await downloadTextFileSafely(
      csvText,
      `PharmaFlow_Sales_Profit_Report_${timeframe}_${todayStr}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const handleExportStockCsv = async () => {
    const headers = [
      "Product Code",
      "Product Name",
      "Category",
      "Purchased Inward (Units)",
      "Sold Outward (Units)",
      "Returned (Units)",
      "Adjusted (+/-)",
      "Current Stock On Hand",
      "Avg Unit Cost (PKR)",
      "Sale Rate (PKR)",
      "Total Cost Valuation",
      "Total Retail Valuation",
      "Status",
    ];

    const rows = filteredStockSummaries.map((s) => [
      `"${s.productCode || "-"}"`,
      `"${s.productName.replace(/"/g, '""')}"`,
      `"${s.category}"`,
      s.totalPurchased,
      s.totalSold,
      s.totalReturned,
      s.totalAdjusted ?? 0,
      s.currentStock,
      s.unitCost,
      s.salePrice,
      s.stockValueCost,
      s.stockValueRetail,
      `"${s.status}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    await downloadTextFileSafely(
      csvText,
      `PharmaFlow_Stock_Inventory_${todayStr}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const handleExportDailyCsv = async () => {
    const headers = [
      "Date",
      "Orders Count",
      "Units Sold",
      "Sale Revenue (PKR)",
      "Product Purchase Cost (PKR)",
      "Gross Sales Profit (PKR)",
      "Purchases Bills",
      "Inward Purchases (PKR)",
      "Expenses (PKR)",
      "Returns (PKR)",
      "Net Profit After Expenses (PKR)",
    ];

    const rows = dailyBreakdownReport.map((d) => [
      `"${d.date}"`,
      d.ordersCount,
      d.unitsSold,
      d.salesRevenue,
      d.productCost,
      d.grossProfit,
      d.purchasesCount,
      d.purchasesAmount,
      d.expensesAmount,
      d.returnsAmount,
      d.grossProfit - d.expensesAmount,
    ]);

    const csvText = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    await downloadTextFileSafely(
      csvText,
      `PharmaFlow_Daily_Date_Report_${todayStr}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const setCustomRangePreset = (start: string, end: string) => {
    setTimeframe("custom");
    setCustomStartDate(start);
    setCustomEndDate(end);
  };

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = toIsoDateLocal(prevMonthDate);
  const prevMonthEnd = toIsoDateLocal(new Date(now.getFullYear(), now.getMonth(), 0));

  return (
    <div id="reports-view" className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner & Timeframe Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Sales, Purchase &amp; Profit Analytics
              </h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Profit &amp; Margin Report
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Original product purchase costs, sale revenue, gross profits and net margins for {settings.pharmacyName || "AK Pharmacy"}.
            </p>
          </div>
        </div>

        {/* Timeframe selector tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center flex-wrap border border-slate-200 text-xs font-semibold">
            {(["daily", "weekly", "monthly", "yearly", "all", "custom"] as ExtendedTimeframe[]).map((tf) => (
              <button
                key={tf}
                id={`btn-timeframe-${tf}`}
                onClick={() => applyTimeframePreset(tf)}
                className={`px-3 py-1.5 rounded-lg transition-all capitalize cursor-pointer ${
                  timeframe === tf
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tf === "daily"
                  ? "Today"
                  : tf === "all"
                  ? "All Time"
                  : tf === "custom"
                  ? "Custom Dates"
                  : tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-export-csv-report"
              onClick={
                activeLedgerTab === "profit"
                  ? handleExportProfitCsv
                  : activeLedgerTab === "daily"
                  ? handleExportDailyCsv
                  : handleExportStockCsv
              }
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Download detailed Excel/CSV report"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              id="btn-print-report"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Always-Accessible Date Range Filter Bar (From Date – To Date + Quick Presets) */}
      <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-bold text-slate-800">Report Date Range:</span>
          <span className="px-2.5 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded-md font-mono font-bold">
            {effectiveDateRange.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
            <span className="text-slate-500 font-bold uppercase text-[10px]">From:</span>
            <input
              id="input-report-start-date"
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setTimeframe("custom");
              }}
              className="bg-transparent font-mono text-slate-900 font-bold outline-none cursor-pointer"
            />
          </div>

          <span className="text-slate-400 font-bold">&rarr;</span>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs">
            <span className="text-slate-500 font-bold uppercase text-[10px]">To:</span>
            <input
              id="input-report-end-date"
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setTimeframe("custom");
              }}
              className="bg-transparent font-mono text-slate-900 font-bold outline-none cursor-pointer"
            />
          </div>

          {/* Quick Range Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setCustomRangePreset(thirtyDaysAgoStr, todayStr)}
              className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 border border-slate-200 hover:border-emerald-300 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setCustomRangePreset(prevMonthStart, prevMonthEnd)}
              className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 border border-slate-200 hover:border-emerald-300 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => applyTimeframePreset("all")}
              className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 border border-slate-200 hover:border-emerald-300 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
            >
              All Dates
            </button>
          </div>
        </div>
      </div>

      {/* Primary Financial Equation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 rounded-2xl shadow-sm border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Realized Sale &amp; Purchase Profit Equation ({effectiveDateRange.label})
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Sales Revenue, Cost of Goods &amp; Net Profit Summary
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full font-mono font-bold">
              {overallSalesMarginPct.toFixed(1)}% Realized Margin
            </span>
          </div>
        </div>

        {/* Financial Flow Step Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Total Sale Revenue */}
          <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span>1. Total Sale Revenue</span>
              <span className="text-blue-300 font-semibold">Sales</span>
            </div>
            <div className="text-xl font-black font-mono text-white mt-1">
              Rs. {totalSalesAmount.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {totalSalesUnits} units sold ({filteredOrders.length} orders)
              {totalPreviousPendingExcluded > 0 && (
                <span className="block text-[10px] text-amber-300/90 mt-0.5">
                  Excl. Rs. {totalPreviousPendingExcluded.toLocaleString()} prev. pending dues
                </span>
              )}
            </span>
          </div>

          {/* 2. Original Purchase Cost (COGS) */}
          <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span>2. Product Purchase Cost</span>
              <span className="text-amber-300 font-semibold">Cost</span>
            </div>
            <div className="text-xl font-black font-mono text-amber-300 mt-1">
              Rs. {totalSoldProductsCost.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Cost of Goods Sold (COGS)
            </span>
          </div>

          {/* 3. Realized Gross Profit */}
          <div className="bg-emerald-500/10 border border-emerald-400/30 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-emerald-300 text-[11px] font-bold">
              <span>3. Gross Sales Profit</span>
              <span className="text-emerald-200 font-semibold">Gross</span>
            </div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-1">
              Rs. {totalSalesGrossProfit.toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-300/80 block mt-0.5">
              Sale - Purchase Cost ({overallSalesMarginPct.toFixed(1)}%)
            </span>
          </div>

          {/* 4. Net Profit After Operating Expenses */}
          <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl">
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span>4. Net Business Profit</span>
              <span className="text-purple-300 font-semibold">Net</span>
            </div>
            <div className={`text-xl font-black font-mono mt-1 ${netBusinessProfit >= 0 ? "text-white" : "text-rose-400"}`}>
              Rs. {netBusinessProfit.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              After Rs. {totalExpensesAmount.toLocaleString()} expenses
            </span>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Cards (6-Card Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Total Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Sales
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1.5 font-mono">
            {settings.currencySymbol} {totalSalesAmount.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{totalSalesUnits} units</span>
            <span className="font-semibold text-blue-600">{filteredOrders.length} orders</span>
          </div>
        </div>

        {/* Cost of Sold Products */}
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/15 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Products Cost
            </span>
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-amber-800 mt-1.5 font-mono">
            {settings.currencySymbol} {totalSoldProductsCost.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-amber-700 mt-1 font-medium">
            <span>Purchase Cost</span>
            <span>COGS</span>
          </div>
        </div>

        {/* Realized Gross Profit */}
        <div className="bg-white p-4 rounded-xl border border-emerald-300 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Gross Profit
            </span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-emerald-800 mt-1.5 font-mono">
            {settings.currencySymbol} {totalSalesGrossProfit.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-emerald-700 mt-1 font-bold">
            <span>{overallSalesMarginPct.toFixed(1)}% Margin</span>
            <span>Profit</span>
          </div>
        </div>

        {/* Total Inward Purchases */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              New Purchases
            </span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1.5 font-mono">
            {settings.currencySymbol} {totalPurchasesAmount.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{totalPurchasesUnits} units</span>
            <span className="font-semibold text-indigo-600">{filteredPurchases.length} bills</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Expenses
            </span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-rose-700 mt-1.5 font-mono">
            {settings.currencySymbol} {totalExpensesAmount.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{filteredExpenses.length} records</span>
            <button
              onClick={() => setActiveNavTab("expenses")}
              className="text-blue-600 hover:underline font-semibold text-[10px] cursor-pointer"
            >
              Manage &rarr;
            </button>
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Stock on Hand
            </span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-purple-900 mt-1.5 font-mono">
            {settings.currencySymbol} {totalStockCostValuation.toLocaleString()}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>{totalStockOnHandUnits} units</span>
            <span className="font-semibold text-purple-700">Cost Value</span>
          </div>
        </div>
      </div>

      {/* Payment Collections & Outstanding Receivables Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between p-3.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                Collected Sales Revenue ({effectiveDateRange.label})
              </span>
              <span className="text-lg font-bold text-emerald-800 font-mono">
                {settings.currencySymbol} {totalSalesPaid.toLocaleString()}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {totalSalesPaid + totalSalesPending > 0
              ? `${Math.min(100, Math.round((totalSalesPaid / (totalSalesPaid + totalSalesPending)) * 100))}% Realized`
              : "100%"}
          </span>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-white rounded-lg border border-rose-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
              ⏳
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">
                Pending Receivables / Outstanding ({effectiveDateRange.label})
              </span>
              <span className="text-lg font-bold text-rose-700 font-mono">
                {settings.currencySymbol} {totalSalesPending.toLocaleString()}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            {filteredOrders.filter((o) => (o.pendingAmount ?? 0) > 0).length} Pending Orders
          </span>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar / Trend Chart */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sales, Product Cost &amp; Profit Flow ({effectiveDateRange.label})
              </h3>
              <p className="text-xs text-slate-500">
                Direct financial comparison: Sale Revenue vs Product Cost vs Net Profit Earned.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActiveChartType("profit")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeChartType === "profit" ? "bg-white text-emerald-700 shadow-xs font-bold" : "text-slate-600"
                }`}
              >
                Profit Analysis
              </button>
              <button
                onClick={() => setActiveChartType("financial")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeChartType === "financial" ? "bg-white text-blue-700 shadow-xs font-bold" : "text-slate-600"
                }`}
              >
                Revenue vs Purchases
              </button>
              <button
                onClick={() => setActiveChartType("units")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  activeChartType === "units" ? "bg-white text-slate-800 shadow-xs font-bold" : "text-slate-600"
                }`}
              >
                Trends
              </button>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartType === "profit" ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, ""]}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey="sales" name="Sale Revenue (PKR)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Product Purchase Cost (PKR)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit (PKR)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : activeChartType === "financial" ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, ""]}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey="sales" name="Sales (PKR)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases (PKR)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="returns" name="Returns (PKR)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, ""]}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      color: "#fff",
                      borderRadius: "8px",
                      fontSize: "12px",
                      border: "none",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Sales Curve"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Profit Curve"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Sales Distribution */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-emerald-600" />
              Category Sales Share
            </h3>
            <p className="text-xs text-slate-500">
              Contribution of major surgical & pharmaceutical categories to total sales.
            </p>
          </div>

          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryPieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [`Rs. ${val.toLocaleString()}`, "Sales"]}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    color: "#fff",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {categoryPieData.slice(0, 4).map((cat, idx) => (
              <div key={cat.name} className="flex items-center justify-between text-slate-600">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="truncate max-w-[140px] font-medium">{cat.name}</span>
                </div>
                <span className="font-mono font-semibold text-slate-900">
                  Rs. {cat.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product-wise Sale & Purchase Profit Ledger VS Stock Balance Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Ledger Header & Switcher Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {activeLedgerTab === "profit"
                  ? "Product-wise Sale & Purchase Profit Ledger"
                  : activeLedgerTab === "daily"
                  ? "Date-by-Date Report Breakdown"
                  : "Master Stock Balance & Inventory Valuation"}
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {activeLedgerTab === "profit"
                  ? `${filteredProfitReport.length} Items Sold`
                  : activeLedgerTab === "daily"
                  ? `${dailyBreakdownReport.length} Active Dates`
                  : `${filteredStockSummaries.length} Catalog Items`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeLedgerTab === "profit"
                ? `Itemized product purchase cost, sale revenue, and net profit earned (${effectiveDateRange.label})`
                : activeLedgerTab === "daily"
                ? `Day-by-day summary of Sales, Product Costs, Purchases, Expenses & Net Profit (${effectiveDateRange.label})`
                : "Live stock balance on hand, inward purchases, outward sales, returns, adjustments, and inventory value."}
            </p>
          </div>

          {/* Ledger Tab Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center flex-wrap border border-slate-200 text-xs font-semibold">
              <button
                id="btn-tab-profit-ledger"
                onClick={() => setActiveLedgerTab("profit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeLedgerTab === "profit"
                    ? "bg-white text-emerald-800 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Product Profit Report</span>
              </button>

              <button
                id="btn-tab-daily-ledger"
                onClick={() => setActiveLedgerTab("daily")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeLedgerTab === "daily"
                    ? "bg-white text-indigo-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Date-by-Date Report</span>
              </button>

              <button
                id="btn-tab-stock-ledger"
                onClick={() => setActiveLedgerTab("stock")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeLedgerTab === "stock"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Stock Balance Ledger</span>
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: PRODUCT-WISE SALE & PURCHASE PROFIT REPORT */}
        {activeLedgerTab === "profit" && (
          <div className="space-y-4">
            {/* Filter Bar for Profit Ledger */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div className="w-full sm:w-72 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search sold product name or code..."
                  value={profitSearchQuery}
                  onChange={(e) => setProfitSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={profitCategoryFilter}
                  onChange={(e) => setProfitCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  value={profitStatusFilter}
                  onChange={(e) => setProfitStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Profit Tiers</option>
                  <option value="High Profit">High Profit (≥ 28%)</option>
                  <option value="Normal">Normal Margin (15% - 27%)</option>
                  <option value="Low Margin">Low Margin (&lt; 15%)</option>
                  <option value="Loss">Loss / Negative Margin</option>
                </select>

                <button
                  onClick={handleExportProfitCsv}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Export this profit report to Excel/CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Profit CSV</span>
                </button>
              </div>
            </div>

            {/* Profit Ledger Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-bold uppercase text-[11px] text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[170px]">Product Description</th>
                    <th className="py-3 px-2.5 w-28">Category</th>
                    <th className="py-3 px-2.5 text-right w-20">Units Sold</th>
                    <th className="py-2.5 px-2.5 text-right w-24 bg-amber-50/50 text-amber-900 border-x border-amber-100">
                      <div>Purchase Rate</div>
                      <span className="text-[9px] font-normal text-amber-700">Unit Cost</span>
                    </th>
                    <th className="py-2.5 px-2.5 text-right w-24 bg-blue-50/40 text-blue-900 border-r border-blue-100">
                      <div>Sale Rate</div>
                      <span className="text-[9px] font-normal text-blue-700">Avg Rate</span>
                    </th>
                    <th className="py-3 px-3 text-right w-28 bg-amber-50/70 text-amber-900 border-r border-amber-100">
                      <div>Total Product Cost</div>
                      <span className="text-[9px] font-normal text-amber-700">COGS</span>
                    </th>
                    <th className="py-3 px-3 text-right w-28 bg-blue-50/60 text-blue-900 border-r border-blue-100">
                      <div>Total Sale Amount</div>
                      <span className="text-[9px] font-normal text-blue-700">Revenue</span>
                    </th>
                    <th className="py-3 px-3 text-right w-28 bg-emerald-50/70 text-emerald-900 border-r border-emerald-100">
                      <div>Net Profit</div>
                      <span className="text-[9px] font-normal text-emerald-700">Earned</span>
                    </th>
                    <th className="py-3 px-2.5 text-right w-20">Margin</th>
                    <th className="py-3 px-2.5 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProfitReport.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-10 text-slate-400">
                        No sales records found for the selected timeframe or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProfitReport.map((p, idx) => (
                      <tr key={p.productId || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{p.productName}</div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {p.productCode || `PRD-${String(idx + 1).padStart(3, "0")}`}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-500 text-xs">
                          {p.category}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-800">
                          {p.unitsSold.toLocaleString()}
                        </td>

                        {/* Unit Purchase Rate */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-amber-800 bg-amber-50/30 border-x border-amber-100/60 font-semibold">
                          Rs. {p.unitCost.toLocaleString()}
                        </td>

                        {/* Average Sale Rate */}
                        <td className="py-2.5 px-2.5 text-right font-mono text-blue-800 bg-blue-50/20 border-r border-blue-100/60 font-semibold">
                          Rs. {p.avgSaleRate.toLocaleString()}
                        </td>

                        {/* Total Product Cost */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900 bg-amber-50/40 border-r border-amber-100/60">
                          Rs. {p.totalCost.toLocaleString()}
                        </td>

                        {/* Total Sale Revenue */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900 bg-blue-50/30 border-r border-blue-100/60">
                          Rs. {p.totalRevenue.toLocaleString()}
                        </td>

                        {/* Net Profit Earned */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold bg-emerald-50/40 border-r border-emerald-100/60">
                          <span className={p.profit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                            {p.profit >= 0 ? "+" : ""}Rs. {p.profit.toLocaleString()}
                          </span>
                        </td>

                        {/* Margin % */}
                        <td className="py-2.5 px-2.5 text-right font-mono font-semibold">
                          <span className={p.profit >= 0 ? "text-emerald-700" : "text-rose-600"}>
                            {p.marginPct.toFixed(1)}%
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.profitStatus === "High Profit"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : p.profitStatus === "Normal"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : p.profitStatus === "Low Margin"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {p.profitStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <tr>
                    <td colSpan={3} className="py-3.5 px-3 text-right uppercase tracking-wider text-[11px] text-slate-500">
                      Total Summary ({filteredProfitReport.length} Products):
                    </td>
                    <td className="py-3.5 px-2.5 text-right font-mono text-slate-900">
                      {filteredProfitReport.reduce((s, p) => s + p.unitsSold, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="border-x border-slate-200" />
                    {/* Total Product Cost */}
                    <td className="py-3.5 px-3 text-right font-mono text-amber-900 bg-amber-100/60 border-r border-amber-200">
                      Rs. {filteredProfitReport.reduce((s, p) => s + p.totalCost, 0).toLocaleString()}
                    </td>
                    {/* Total Sale Revenue */}
                    <td className="py-3.5 px-3 text-right font-mono text-blue-900 bg-blue-100/60 border-r border-blue-200">
                      Rs. {filteredProfitReport.reduce((s, p) => s + p.totalRevenue, 0).toLocaleString()}
                    </td>
                    {/* Total Profit Earned */}
                    <td className="py-3.5 px-3 text-right font-mono text-emerald-800 bg-emerald-100/70 border-r border-emerald-200 text-sm">
                      Rs. {filteredProfitReport.reduce((s, p) => s + p.profit, 0).toLocaleString()}
                    </td>
                    {/* Average Margin % */}
                    <td className="py-3.5 px-2.5 text-right font-mono text-emerald-800">
                      {totalSalesAmount > 0 ? `${overallSalesMarginPct.toFixed(1)}%` : "0%"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DATE-BY-DATE REPORT */}
        {activeLedgerTab === "daily" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div className="font-semibold text-slate-700">
                Showing day-wise totals for <span className="font-mono font-bold text-emerald-800">{effectiveDateRange.label}</span>
              </div>
              <button
                onClick={handleExportDailyCsv}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Date-wise CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-bold uppercase text-[11px] text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3 text-right">Orders</th>
                    <th className="py-3 px-3 text-right">Units Sold</th>
                    <th className="py-3 px-3 text-right">Sale Revenue</th>
                    <th className="py-3 px-3 text-right">Product Cost</th>
                    <th className="py-3 px-3 text-right">Gross Profit</th>
                    <th className="py-3 px-3 text-right">Purchases</th>
                    <th className="py-3 px-3 text-right">Expenses</th>
                    <th className="py-3 px-3 text-right">Returns</th>
                    <th className="py-3 px-3 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dailyBreakdownReport.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-slate-400">
                        No transactions recorded between {effectiveDateRange.label}.
                      </td>
                    </tr>
                  ) : (
                    dailyBreakdownReport.map((day) => {
                      const netDay = day.grossProfit - day.expensesAmount;
                      return (
                        <tr key={day.date} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatDisplayDate(day.date)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{day.ordersCount}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{day.unitsSold.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-900">
                            Rs. {day.salesRevenue.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-800">
                            Rs. {day.productCost.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            {day.grossProfit >= 0 ? "+" : ""}Rs. {day.grossProfit.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-indigo-700">
                            Rs. {day.purchasesAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                            Rs. {day.expensesAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            Rs. {day.returnsAmount.toLocaleString()}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold ${netDay >= 0 ? "text-emerald-800" : "text-rose-700"}`}>
                            {netDay >= 0 ? "+" : ""}Rs. {netDay.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                  <tr>
                    <td className="py-3 px-3">Total ({dailyBreakdownReport.length} Days)</td>
                    <td className="py-3 px-3 text-right font-mono">
                      {dailyBreakdownReport.reduce((s, d) => s + d.ordersCount, 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {dailyBreakdownReport.reduce((s, d) => s + d.unitsSold, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-900">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + d.salesRevenue, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-900">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + d.productCost, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-800">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + d.grossProfit, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-indigo-800">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + d.purchasesAmount, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-700">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + d.expensesAmount, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + d.returnsAmount, 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-900">
                      Rs. {dailyBreakdownReport.reduce((s, d) => s + (d.grossProfit - d.expensesAmount), 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: STOCK BALANCE & INVENTORY VALUATION LEDGER */}
        {activeLedgerTab === "stock" && (
          <div className="space-y-4">
            {/* Filters for Stock Table */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div className="w-full sm:w-72 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search catalog product code or name..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedStockCategory}
                  onChange={(e) => setSelectedStockCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">All Categories ({allStockSummaries.length})</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleExportStockCsv}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                  title="Export stock inventory to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Stock CSV</span>
                </button>
              </div>
            </div>

            {/* Stock Ledger Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-bold uppercase text-[11px] text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Item Details</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Purchased</th>
                    <th className="py-3 px-3 text-right">Sold</th>
                    <th className="py-3 px-3 text-right">Returned</th>
                    <th className="py-3 px-3 text-right">Adjusted (+/-)</th>
                    <th className="py-3 px-3 text-right">Available</th>
                    <th className="py-3 px-3 text-right">Unit Cost</th>
                    <th className="py-3 px-3 text-right">Sale Price</th>
                    <th className="py-3 px-3 text-right">Stock Cost Value</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredStockSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-slate-400">
                        No matching stock items found.
                      </td>
                    </tr>
                  ) : (
                    filteredStockSummaries.map((stk) => {
                      const adjNet = stk.totalAdjusted ?? 0;
                      return (
                      <tr key={stk.productId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{stk.productName}</div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {stk.productCode || "-"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{stk.category}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                          +{stk.totalPurchased}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-700">
                          -{stk.totalSold}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {stk.totalReturned > 0 ? `±${stk.totalReturned}` : "0"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          {adjNet > 0 ? (
                            <span className="text-emerald-700">+{adjNet}</span>
                          ) : adjNet < 0 ? (
                            <span className="text-rose-600">{adjNet}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                          {stk.currentStock}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          Rs. {stk.unitCost.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          Rs. {stk.salePrice.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-900">
                          Rs. {stk.stockValueCost.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              stk.status === "In Stock"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : stk.status === "Low Stock"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {stk.status}
                          </span>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900 text-xs">
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-right">
                      Total Inventory Valuation On Hand:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-700">
                      {totalStockOnHandUnits} units
                    </td>
                    <td colSpan={2} />
                    <td className="py-3 px-3 text-right font-mono text-purple-700">
                      Rs. {totalStockCostValuation.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
