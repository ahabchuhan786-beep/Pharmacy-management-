import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { RecoveryPaymentMethod, RecoveryRecord } from "../types";
import { convertRupeesToWords } from "../utils/numberToWords";
import {
  generateRecoveryReceiptPdf,
  downloadPdfSafely,
  downloadTextFileSafely,
} from "../utils/pdfGenerator";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { RecoveryReceiptModal } from "./RecoveryReceiptModal";
import {
  HandCoins,
  Plus,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Download,
  Printer,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Banknote,
  Building2,
  Smartphone,
  CreditCard,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  ArrowRight,
  Wallet,
} from "lucide-react";

const PAYMENT_METHODS: RecoveryPaymentMethod[] = [
  "Cash",
  "Bank Transfer",
  "EasyPaisa / JazzCash",
  "Cheque",
  "Online / Card",
];

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function shiftDateStr(dateStr: string, deltaDays: number): string {
  const parts = dateStr.split("-").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return getTodayStr();
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatReadableDate(dateStr: string): string {
  const parts = dateStr.split("-").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCurrentTimeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const DailyRecoveryView: React.FC = () => {
  const {
    recoveries,
    saveRecovery,
    deleteRecovery,
    generateNextReceiptNumber,
    customers,
    orders,
    getCustomerPendingDues,
    settings,
    preselectedRecoveryCustomer,
    setPreselectedRecoveryCustomer,
  } = useApp();

  const currency = settings.currencySymbol || "Rs.";
  const todayStr = getTodayStr();
  const currentMonthPrefix = todayStr.slice(0, 7);

  // Day-by-Day Navigation & Filters
  const [viewScope, setViewScope] = useState<"day" | "all-days" | "this-month" | "custom">("day");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  // Modal & Receipt Preview States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<RecoveryRecord | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<RecoveryRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<RecoveryRecord | null>(null);

  // Form State
  const [formCustomerName, setFormCustomerName] = useState<string>("");
  const [formCustomerDropdownOpen, setFormCustomerDropdownOpen] = useState<boolean>(false);
  const [formRecoveryDate, setFormRecoveryDate] = useState<string>(todayStr);
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>("");
  const [formLinkedOrderId, setFormLinkedOrderId] = useState<string>("");
  const [formPreviousDue, setFormPreviousDue] = useState<string>("0");
  const [formRecoveredAmount, setFormRecoveredAmount] = useState<string>("");
  const [formDiscountAdj, setFormDiscountAdj] = useState<string>("0");
  const [formPaymentMethod, setFormPaymentMethod] = useState<RecoveryPaymentMethod>("Cash");
  const [formReferenceNo, setFormReferenceNo] = useState<string>("");
  const [formCollectedBy, setFormCollectedBy] = useState<string>(
    settings.defaultSalesman || "ADNAN"
  );
  const [formReceivedBy, setFormReceivedBy] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  // Build unified customer list (directory + any order customer names) with live pending dues
  const customerDirectoryWithDues = useMemo(() => {
    const map = new Map<
      string,
      {
        id?: string;
        name: string;
        code?: string;
        phone?: string;
        address?: string;
        city?: string;
        pendingDues: number;
      }
    >();

    customers.forEach((c) => {
      if (!c.name) return;
      const key = c.name.trim().toLowerCase();
      map.set(key, {
        id: c.id,
        name: c.name.trim(),
        code: c.code,
        phone: c.phone,
        address: c.address,
        city: c.city,
        pendingDues: getCustomerPendingDues(c.name),
      });
    });

    orders.forEach((o) => {
      if (!o.customerName) return;
      const key = o.customerName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: o.customerName.trim(),
          code: o.customerCode,
          phone: o.customerPhone,
          address: o.customerAddress,
          city: o.customerCity,
          pendingDues: getCustomerPendingDues(o.customerName),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.pendingDues - a.pendingDues || a.name.localeCompare(b.name));
  }, [customers, orders, recoveries, getCustomerPendingDues]);

  const customersWithPendingDues = useMemo(
    () => customerDirectoryWithDues.filter((c) => c.pendingDues > 0),
    [customerDirectoryWithDues]
  );

  // Matching dropdown suggestions for the form's customer input
  const matchingFormCustomers = useMemo(() => {
    const q = formCustomerName.trim().toLowerCase();
    if (!q) return customerDirectoryWithDues.slice(0, 12);
    return customerDirectoryWithDues
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.city && c.city.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [formCustomerName, customerDirectoryWithDues]);

  // Customer's unpaid/partial orders for linking
  const customerPendingOrders = useMemo(() => {
    const target = formCustomerName.trim().toLowerCase();
    if (!target) return [];
    return orders.filter((o) => {
      if (!o.customerName || o.customerName.trim().toLowerCase() !== target) return false;
      const pend =
        o.pendingAmount !== undefined
          ? Number(o.pendingAmount)
          : Math.max(0, Number(o.grandTotal) - (Number(o.paidAmount) || 0));
      // When editing a recovery already linked to this order, still show it
      return pend > 0 || (editingRecord && editingRecord.linkedOrderId === o.id);
    });
  }, [formCustomerName, orders, editingRecord]);

  const openCreateModal = (prefillCustomerName?: string) => {
    setEditingRecord(null);
    setFormError(null);
    setFormReceiptNumber(generateNextReceiptNumber());
    setFormRecoveryDate(viewScope === "day" ? selectedDate : todayStr);
    setFormLinkedOrderId("");
    setFormDiscountAdj("0");
    setFormPaymentMethod("Cash");
    setFormReferenceNo("");
    setFormCollectedBy(settings.defaultSalesman || "ADNAN");
    setFormReceivedBy("");
    setFormNotes("");

    if (prefillCustomerName) {
      const dues = getCustomerPendingDues(prefillCustomerName);
      setFormCustomerName(prefillCustomerName);
      setFormPreviousDue(String(dues));
      setFormRecoveredAmount(dues > 0 ? String(dues) : "");
    } else {
      setFormCustomerName("");
      setFormPreviousDue("0");
      setFormRecoveredAmount("");
    }
    setIsFormOpen(true);
  };

  // Support launching from CustomersView ("Collect Recovery")
  useEffect(() => {
    if (preselectedRecoveryCustomer) {
      openCreateModal(preselectedRecoveryCustomer);
      setPreselectedRecoveryCustomer(null);
    }
  }, [preselectedRecoveryCustomer]);

  const openEditModal = (rec: RecoveryRecord) => {
    setEditingRecord(rec);
    setFormError(null);
    setFormCustomerName(rec.customerName);
    setFormRecoveryDate(rec.recoveryDate);
    setFormReceiptNumber(rec.receiptNumber);
    setFormLinkedOrderId(rec.linkedOrderId || "");
    setFormPreviousDue(String(rec.previousDue ?? 0));
    setFormRecoveredAmount(String(rec.recoveredAmount ?? 0));
    setFormDiscountAdj(String(rec.discountOrAdjustment ?? 0));
    setFormPaymentMethod(rec.paymentMethod || "Cash");
    setFormReferenceNo(rec.referenceNo || "");
    setFormCollectedBy(rec.collectedBy || settings.defaultSalesman || "ADNAN");
    setFormReceivedBy(rec.receivedBy || "");
    setFormNotes(rec.notes || "");
    setIsFormOpen(true);
  };

  const handleSelectCustomerInForm = (customerName: string) => {
    setFormCustomerName(customerName);
    setFormCustomerDropdownOpen(false);
    setFormLinkedOrderId("");
    const dues = getCustomerPendingDues(customerName);
    setFormPreviousDue(String(dues));
    if (!editingRecord && dues > 0 && !formRecoveredAmount) {
      setFormRecoveredAmount(String(dues));
    }
  };

  const handleLinkedOrderChange = (orderId: string) => {
    setFormLinkedOrderId(orderId);
    if (!orderId) {
      const totalDues = getCustomerPendingDues(formCustomerName);
      setFormPreviousDue(String(totalDues));
      return;
    }
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      const pend =
        ord.pendingAmount !== undefined
          ? Number(ord.pendingAmount)
          : Math.max(0, Number(ord.grandTotal) - (Number(ord.paidAmount) || 0));
      // If editing and same order, add back prior deduction for preview accuracy
      const priorDed =
        editingRecord?.appliedOrderDeductions?.find((d) => d.orderId === ord.id)?.amount || 0;
      const effectivePending = pend + priorDed;
      setFormPreviousDue(String(effectivePending));
      if (!editingRecord && effectivePending > 0) {
        setFormRecoveredAmount(String(effectivePending));
      }
    }
  };

  // Live form calculation values
  const numericPrevDue = Math.max(0, parseFloat(formPreviousDue) || 0);
  const numericRecovered = Math.max(0, parseFloat(formRecoveredAmount) || 0);
  const numericAdj = Math.max(0, parseFloat(formDiscountAdj) || 0);
  const computedRemainingDue = Math.max(0, numericPrevDue - numericRecovered - numericAdj);
  const liveAmountWords = convertRupeesToWords(numericRecovered);

  const handleSubmitRecovery = (openReceiptAfterSave: boolean) => {
    setFormError(null);
    const trimmedCust = formCustomerName.trim();
    if (!trimmedCust) {
      setFormError("Please enter or select a customer / party name.");
      return;
    }
    if (numericRecovered <= 0) {
      setFormError("Please enter a valid received recovery amount greater than zero.");
      return;
    }
    if (!formRecoveryDate) {
      setFormError("Please select a recovery date.");
      return;
    }

    const matchedCust = customerDirectoryWithDues.find(
      (c) => c.name.toLowerCase() === trimmedCust.toLowerCase()
    );
    const linkedOrd = formLinkedOrderId
      ? orders.find((o) => o.id === formLinkedOrderId)
      : undefined;

    const nowIso = new Date().toISOString();
    const recordToSave: RecoveryRecord = {
      id: editingRecord
        ? editingRecord.id
        : `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      receiptNumber: formReceiptNumber.trim() || generateNextReceiptNumber(),
      recoveryDate: formRecoveryDate,
      recoveryTime: editingRecord?.recoveryTime || getCurrentTimeLabel(),
      customerId: matchedCust?.id,
      customerName: matchedCust?.name || trimmedCust,
      customerCode: matchedCust?.code,
      customerPhone: matchedCust?.phone,
      customerAddress: matchedCust?.address,
      customerCity: matchedCust?.city,
      previousDue: numericPrevDue,
      recoveredAmount: numericRecovered,
      discountOrAdjustment: numericAdj,
      remainingDue: computedRemainingDue,
      paymentMethod: formPaymentMethod,
      referenceNo: formReferenceNo.trim() || undefined,
      linkedOrderId: linkedOrd?.id,
      linkedOrderNumber: linkedOrd?.orderNumber,
      collectedBy: formCollectedBy.trim() || settings.defaultSalesman || "ADNAN",
      receivedBy: formReceivedBy.trim() || undefined,
      notes: formNotes.trim() || undefined,
      amountInWords: convertRupeesToWords(numericRecovered),
      createdAt: editingRecord ? editingRecord.createdAt : nowIso,
      updatedAt: nowIso,
    };

    const saved = saveRecovery(recordToSave, true);
    setSelectedDate(saved.recoveryDate);
    setIsFormOpen(false);
    setEditingRecord(null);

    if (openReceiptAfterSave) {
      setReceiptPreview(saved);
    }
  };

  // Filtered recoveries according to scope, search, and payment method
  const filteredRecoveries = useMemo(() => {
    return recoveries
      .filter((r) => {
        if (viewScope === "day") {
          if (r.recoveryDate !== selectedDate) return false;
        } else if (viewScope === "this-month") {
          if (!r.recoveryDate.startsWith(currentMonthPrefix)) return false;
        } else if (viewScope === "custom") {
          if (customStartDate && r.recoveryDate < customStartDate) return false;
          if (customEndDate && r.recoveryDate > customEndDate) return false;
        }

        if (methodFilter !== "all" && r.paymentMethod !== methodFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            r.customerName.toLowerCase().includes(q) ||
            r.receiptNumber.toLowerCase().includes(q) ||
            (r.linkedOrderNumber && r.linkedOrderNumber.toLowerCase().includes(q)) ||
            (r.collectedBy && r.collectedBy.toLowerCase().includes(q)) ||
            (r.referenceNo && r.referenceNo.toLowerCase().includes(q)) ||
            (r.notes && r.notes.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          b.recoveryDate.localeCompare(a.recoveryDate) ||
          b.createdAt.localeCompare(a.createdAt)
      );
  }, [
    recoveries,
    viewScope,
    selectedDate,
    currentMonthPrefix,
    customStartDate,
    customEndDate,
    methodFilter,
    searchQuery,
  ]);

  // Day-by-Day Grouped Structure
  const groupedByDay = useMemo(() => {
    const groups: Record<
      string,
      {
        date: string;
        records: RecoveryRecord[];
        totalAmount: number;
        cashAmount: number;
        digitalAmount: number;
      }
    > = {};

    filteredRecoveries.forEach((r) => {
      const d = r.recoveryDate || todayStr;
      if (!groups[d]) {
        groups[d] = {
          date: d,
          records: [],
          totalAmount: 0,
          cashAmount: 0,
          digitalAmount: 0,
        };
      }
      groups[d].records.push(r);
      const amt = Number(r.recoveredAmount) || 0;
      groups[d].totalAmount += amt;
      if (r.paymentMethod === "Cash") {
        groups[d].cashAmount += amt;
      } else {
        groups[d].digitalAmount += amt;
      }
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecoveries, todayStr]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const activeDayRecords = recoveries.filter((r) => r.recoveryDate === selectedDate);
    const activeDayTotal = activeDayRecords.reduce(
      (s, r) => s + (Number(r.recoveredAmount) || 0),
      0
    );

    const monthRecords = recoveries.filter((r) =>
      r.recoveryDate.startsWith(currentMonthPrefix)
    );
    const monthTotal = monthRecords.reduce(
      (s, r) => s + (Number(r.recoveredAmount) || 0),
      0
    );

    const filteredCash = filteredRecoveries
      .filter((r) => r.paymentMethod === "Cash")
      .reduce((s, r) => s + (Number(r.recoveredAmount) || 0), 0);
    const filteredDigital = filteredRecoveries
      .filter((r) => r.paymentMethod !== "Cash")
      .reduce((s, r) => s + (Number(r.recoveredAmount) || 0), 0);

    const totalMarketPending = customersWithPendingDues.reduce(
      (s, c) => s + c.pendingDues,
      0
    );

    return {
      activeDayTotal,
      activeDayCount: activeDayRecords.length,
      monthTotal,
      monthCount: monthRecords.length,
      filteredCash,
      filteredDigital,
      filteredTotal: filteredCash + filteredDigital,
      totalMarketPending,
      pendingPartiesCount: customersWithPendingDues.length,
    };
  }, [recoveries, selectedDate, currentMonthPrefix, filteredRecoveries, customersWithPendingDues]);

  const handleQuickDownloadPdf = async (rec: RecoveryRecord) => {
    const doc = generateRecoveryReceiptPdf(rec, settings);
    const safeName = (rec.customerName || "Customer")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 30);
    await downloadPdfSafely(doc, `${rec.receiptNumber}_${safeName}.pdf`);
  };

  const handleExportCsv = async () => {
    const headers = [
      "Receipt No",
      "Date",
      "Time",
      "Customer Name",
      "Customer Code",
      "Linked Invoice",
      "Previous Due",
      "Amount Received",
      "Discount/Adjustment",
      "Remaining Due",
      "Payment Method",
      "Reference No",
      "Collected By",
      "Notes",
    ];
    const rows = filteredRecoveries.map((r) => [
      `"${r.receiptNumber}"`,
      `"${r.recoveryDate}"`,
      `"${r.recoveryTime || ""}"`,
      `"${(r.customerName || "").replace(/"/g, '""')}"`,
      `"${r.customerCode || ""}"`,
      `"${r.linkedOrderNumber || ""}"`,
      r.previousDue || 0,
      r.recoveredAmount || 0,
      r.discountOrAdjustment || 0,
      r.remainingDue || 0,
      `"${r.paymentMethod}"`,
      `"${(r.referenceNo || "").replace(/"/g, '""')}"`,
      `"${(r.collectedBy || "").replace(/"/g, '""')}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    await downloadTextFileSafely(
      csvText,
      `daily_recovery_${viewScope === "day" ? selectedDate : todayStr}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const renderMethodIcon = (method: RecoveryPaymentMethod) => {
    switch (method) {
      case "Cash":
        return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
      case "Bank Transfer":
        return <Building2 className="w-3.5 h-3.5 text-blue-600" />;
      case "EasyPaisa / JazzCash":
        return <Smartphone className="w-3.5 h-3.5 text-orange-600" />;
      default:
        return <CreditCard className="w-3.5 h-3.5 text-purple-600" />;
    }
  };

  return (
    <div id="daily-recovery-view" className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold">
            <HandCoins className="w-3.5 h-3.5" />
            <span>Daily Recovery &amp; Receiving Receipts</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Day-by-Day Recovery Ledger &amp; Receipts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Record daily customer recoveries day by day, track remaining party balances, and issue printable receiving receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Recovery &amp; Receipt</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRecoveries.length === 0}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-semibold text-xs sm:text-sm rounded-lg border border-slate-300 flex items-center gap-2 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {selectedDate === todayStr ? "Today's Recovery" : `Recovery (${selectedDate})`}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <HandCoins className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight font-mono">
              {currency} {kpis.activeDayTotal.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {kpis.activeDayCount} {kpis.activeDayCount === 1 ? "receipt" : "receipts"} on {formatReadableDate(selectedDate)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">This Month Total</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
              {currency} {kpis.monthTotal.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total collected this month ({kpis.monthCount} {kpis.monthCount === 1 ? "receipt" : "receipts"})
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash vs Bank / Wallet</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-sm sm:text-base font-black text-slate-900 font-mono">
              Cash: {currency} {kpis.filteredCash.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-indigo-700 font-semibold font-mono mt-1">
              Bank/Online: {currency} {kpis.filteredDigital.toLocaleString("en-PK")}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Market Dues</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-700 tracking-tight font-mono">
              {currency} {kpis.totalMarketPending.toLocaleString("en-PK")}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Across {kpis.pendingPartiesCount} pending {kpis.pendingPartiesCount === 1 ? "party" : "parties"}
            </p>
          </div>
        </div>
      </div>

      {/* Pending Customers Quick-Collect Strip */}
      {customersWithPendingDues.length > 0 && (
        <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Customers With Pending Balance</span>
            </div>
            <span className="text-xs text-amber-800">
              Click any party to record today&apos;s recovery &amp; print receipt
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {customersWithPendingDues.slice(0, 8).map((cust) => (
              <button
                key={cust.name}
                type="button"
                onClick={() => openCreateModal(cust.name)}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-emerald-50 border border-amber-200 hover:border-emerald-400 rounded-lg text-xs transition-all shadow-2xs cursor-pointer group"
              >
                <span className="font-bold text-slate-800 group-hover:text-emerald-800">
                  {cust.name}
                </span>
                <span className="font-mono font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                  {currency} {cust.pendingDues.toLocaleString("en-PK")}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day-by-Day Date Navigator + Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Scope Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setViewScope("day")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                viewScope === "day"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Day-by-Day
            </button>
            <button
              type="button"
              onClick={() => setViewScope("all-days")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                viewScope === "all-days"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Days Ledger
            </button>
            <button
              type="button"
              onClick={() => setViewScope("this-month")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                viewScope === "this-month"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setViewScope("custom")}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                viewScope === "custom"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Day Stepper when in Day-by-Day mode */}
          {viewScope === "day" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate((d) => shiftDateStr(d, -1))}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 bg-slate-50 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              />

              <button
                type="button"
                onClick={() => setSelectedDate((d) => shiftDateStr(d, 1))}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Jump to Today
                </button>
              )}
            </div>
          )}

          {/* Custom Range Picker */}
          {viewScope === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
              />
              <span className="font-semibold text-slate-600">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          )}
        </div>

        {/* Search & Payment Method Filters */}
        <div className="flex flex-col md:flex-row gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, receipt #, invoice #, collector, or TXN ref..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="w-full md:w-56 shrink-0">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Payment Modes</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Day-by-Day Grouped Recovery Cards & Tables */}
      {groupedByDay.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
          <Receipt className="w-12 h-12 mx-auto text-slate-300" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {viewScope === "day"
                ? `No recovery entries recorded for ${formatReadableDate(selectedDate)}`
                : "No recovery records match your current filter"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Add a customer payment recovery to log the day&apos;s collection and generate a printable receiving receipt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Recovery for {viewScope === "day" ? selectedDate : "Today"}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map((dayGroup) => (
            <div
              key={dayGroup.date}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
            >
              {/* Day Group Summary Header */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                      <span>{formatReadableDate(dayGroup.date)}</span>
                      {dayGroup.date === todayStr && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-600 text-white rounded">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {dayGroup.records.length}{" "}
                      {dayGroup.records.length === 1 ? "Receiving Receipt" : "Receiving Receipts"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono text-slate-700">
                    Cash: <span className="font-bold">{currency} {dayGroup.cashAmount.toLocaleString("en-PK")}</span>
                  </div>
                  <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-mono text-slate-700">
                    Bank/Wallet: <span className="font-bold">{currency} {dayGroup.digitalAmount.toLocaleString("en-PK")}</span>
                  </div>
                  <div className="px-3 py-1 bg-emerald-600 text-white rounded-md font-mono font-black text-sm">
                    Day Total: {currency} {dayGroup.totalAmount.toLocaleString("en-PK")}
                  </div>
                </div>
              </div>

              {/* Day's Recovery Rows */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-4">Receipt # &amp; Time</th>
                      <th className="py-2.5 px-4">Customer / Party</th>
                      <th className="py-2.5 px-4">Payment Mode &amp; Collector</th>
                      <th className="py-2.5 px-4 text-right">Previous Due</th>
                      <th className="py-2.5 px-4 text-right">Received</th>
                      <th className="py-2.5 px-4 text-right">Remaining</th>
                      <th className="py-2.5 px-4 text-center">Receipt &amp; Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dayGroup.records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setReceiptPreview(rec)}
                            className="font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                          >
                            {rec.receiptNumber}
                          </button>
                          <div className="text-[11px] text-slate-400">
                            {rec.recoveryTime || rec.recoveryDate}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{rec.customerName}</div>
                          <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 mt-0.5">
                            {rec.customerPhone && <span className="font-mono">{rec.customerPhone}</span>}
                            {rec.linkedOrderNumber && (
                              <span className="text-blue-600 font-semibold font-mono">
                                Inv: {rec.linkedOrderNumber}
                              </span>
                            )}
                          </div>
                          {rec.notes && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {rec.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            {renderMethodIcon(rec.paymentMethod)}
                            <span>{rec.paymentMethod}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            By: {rec.collectedBy || "Staff"}
                            {rec.referenceNo ? ` • Ref: ${rec.referenceNo}` : ""}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-600">
                          {currency} {Number(rec.previousDue || 0).toLocaleString("en-PK")}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-black font-mono text-emerald-700 text-sm sm:text-base">
                            + {currency} {Number(rec.recoveredAmount || 0).toLocaleString("en-PK")}
                          </div>
                          {(rec.discountOrAdjustment || 0) > 0 && (
                            <div className="text-[10px] font-mono text-amber-700">
                              Adj: {currency} {Number(rec.discountOrAdjustment).toLocaleString("en-PK")}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              rec.remainingDue > 0
                                ? "bg-rose-50 text-rose-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {rec.remainingDue > 0
                              ? `${currency} ${Number(rec.remainingDue).toLocaleString("en-PK")}`
                              : "Settled (0)"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setReceiptPreview(rec)}
                              title="View / Print Receiving Receipt"
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Receipt</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickDownloadPdf(rec)}
                              title="Download Receipt PDF"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              title="Edit Recovery"
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingRecord(rec)}
                              title="Delete Recovery"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD / EDIT RECOVERY MODAL                                           */}
      {/* =================================================================== */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleUp my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {editingRecord
                      ? `Edit Recovery (${editingRecord.receiptNumber})`
                      : "Record Daily Recovery & Create Receipt"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Record daily customer payment recovery and generate a printable receipt
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Date & Receipt # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Recovery Date *
                  </label>
                  <input
                    type="date"
                    value={formRecoveryDate}
                    onChange={(e) => setFormRecoveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    placeholder="RCV-2026-0001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Row 2: Customer Selector with Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Pharmacy Name *
                </label>
                <input
                  type="text"
                  value={formCustomerName}
                  onFocus={() => setFormCustomerDropdownOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCustomerName(val);
                    setFormCustomerDropdownOpen(true);
                    const dues = getCustomerPendingDues(val);
                    if (dues > 0) {
                      setFormPreviousDue(String(dues));
                    }
                  }}
                  placeholder="Type or select customer name..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />

                {formCustomerDropdownOpen && matchingFormCustomers.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {matchingFormCustomers.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleSelectCustomerInForm(c.name)}
                        className="w-full px-3.5 py-2 text-left hover:bg-emerald-50 flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {[c.code, c.city, c.phone].filter(Boolean).join(" • ")}
                          </div>
                        </div>
                        {c.pendingDues > 0 ? (
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded shrink-0">
                            Due: {currency} {c.pendingDues.toLocaleString("en-PK")}
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-semibold shrink-0">
                            Settled
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Linked Invoice Selector if customer has pending invoices */}
              {customerPendingOrders.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Link to Specific Pending Invoice (Optional)
                  </label>
                  <select
                    value={formLinkedOrderId}
                    onChange={(e) => handleLinkedOrderChange(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">General Account Recovery (All Pending Dues)</option>
                    {customerPendingOrders.map((ord) => {
                      const pend =
                        ord.pendingAmount !== undefined
                          ? Number(ord.pendingAmount)
                          : Math.max(0, Number(ord.grandTotal) - (Number(ord.paidAmount) || 0));
                      return (
                        <option key={ord.id} value={ord.id}>
                          {ord.orderNumber} ({ord.orderDate}) — Pending: {currency}{" "}
                          {pend.toLocaleString("en-PK")}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Row 3: Financial Breakdown */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Previous Pending ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formPreviousDue}
                      onChange={(e) => setFormPreviousDue(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-800 mb-1">
                      Amount Received ({currency}) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formRecoveredAmount}
                      onChange={(e) => setFormRecoveredAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white border-2 border-emerald-400 rounded-lg text-sm font-mono font-black text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {numericPrevDue > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setFormRecoveredAmount(String(numericPrevDue))}
                          className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Full ({numericPrevDue.toLocaleString("en-PK")})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormRecoveredAmount(String(Math.round(numericPrevDue / 2)))
                          }
                          className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                        >
                          50%
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Discount / Adj ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formDiscountAdj}
                      onChange={(e) => setFormDiscountAdj(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Live Balance & Words Preview */}
                <div className="pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600">
                    <span className="font-semibold">In Words: </span>
                    <span className="italic font-serif font-semibold text-slate-800">
                      {liveAmountWords}
                    </span>
                  </div>
                  <div className="font-bold">
                    <span className="text-slate-500 mr-1.5">Remaining Balance:</span>
                    <span
                      className={`font-mono text-sm font-black ${
                        computedRemainingDue > 0 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {currency} {computedRemainingDue.toLocaleString("en-PK")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 4: Payment Mode, Reference, Collector, Paid By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) =>
                      setFormPaymentMethod(e.target.value as RecoveryPaymentMethod)
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reference / Cheque / TXN #
                  </label>
                  <input
                    type="text"
                    value={formReferenceNo}
                    onChange={(e) => setFormReferenceNo(e.target.value)}
                    placeholder="Optional Cheque # or Bank TID"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Collected By
                  </label>
                  <input
                    type="text"
                    value={formCollectedBy}
                    onChange={(e) => setFormCollectedBy(e.target.value)}
                    placeholder="Salesman / Staff name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paid By / Representative
                  </label>
                  <input
                    type="text"
                    value={formReceivedBy}
                    onChange={(e) => setFormReceivedBy(e.target.value)}
                    placeholder="Optional payer / counter staff name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional details about this daily recovery..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSubmitRecovery(false)}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Save Recovery</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmitRecovery(true)}
                className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Save &amp; Create Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receiving Receipt Preview & Print/PDF Modal */}
      {receiptPreview && (
        <RecoveryReceiptModal
          recovery={receiptPreview}
          onClose={() => setReceiptPreview(null)}
        />
      )}

      {/* Confirm Delete Modal */}
      {deletingRecord && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete Recovery Receipt"
          message="Are you sure you want to delete this recovery entry? Any linked invoice payment deduction will automatically be reversed."
          itemDescription={
            <div className="space-y-1">
              <div className="font-bold text-slate-900">
                {deletingRecord.receiptNumber} &bull; {deletingRecord.customerName}
              </div>
              <div className="text-slate-600">
                Date: {deletingRecord.recoveryDate} | Amount: {currency}{" "}
                {Number(deletingRecord.recoveredAmount).toLocaleString("en-PK")}
              </div>
            </div>
          }
          onConfirm={() => {
            deleteRecovery(deletingRecord.id);
            setDeletingRecord(null);
          }}
          onClose={() => setDeletingRecord(null)}
        />
      )}
    </div>
  );
};
