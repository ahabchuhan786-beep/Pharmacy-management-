import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Order } from "../types";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import * as XLSX from "xlsx";
import { downloadBinaryBase64Safely } from "../utils/pdfGenerator";
import {
  Search,
  FileText,
  Edit,
  Copy,
  Trash2,
  Download,
  Calendar,
  Building2,
  Clock,
  PlusCircle,
  Eye,
  CheckCircle2,
  Wallet,
  AlertCircle,
  CreditCard,
  Filter,
  DollarSign,
  X,
  CheckSquare,
  Square,
  RotateCcw,
} from "lucide-react";

export const OrdersHistoryView: React.FC = () => {
  const {
    orders,
    returns,
    deleteOrder,
    deleteMultipleOrders,
    duplicateOrder,
    loadOrderIntoDraft,
    recordOrderPayment,
    updateOrderPayment,
    setActiveNavTab,
    setPreselectedReturnOrderNumber,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState<Order | null>(null);

  // Selection state for bulk operations
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Quick Payment Recording Modal State
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editPendingAmount, setEditPendingAmount] = useState<number>(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<"Paid" | "Partial" | "Unpaid">("Paid");
  const [editPaymentMethod, setEditPaymentMethod] = useState<
    "Cash" | "Bank Transfer" | "Cheque" | "Credit / Pay Later" | "Online / Card"
  >("Cash");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editPaymentNotes, setEditPaymentNotes] = useState<string>("");

  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.salesman.toLowerCase().includes(q) ||
          (o.paymentMethod && o.paymentMethod.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }

    if (paymentFilter !== "all") {
      list = list.filter((o) => {
        const pStatus = o.paymentStatus || ((o.pendingAmount || 0) === 0 ? "Paid" : (o.paidAmount || 0) > 0 ? "Partial" : "Unpaid");
        return pStatus === paymentFilter;
      });
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  }, [orders, searchQuery, statusFilter, paymentFilter]);

  // Aggregate Metrics
  const summaryMetrics = useMemo(() => {
    let totalSales = 0;
    let totalPaid = 0;
    let totalPending = 0;

    orders.forEach((o) => {
      const grandTotal = Number(o.grandTotal) || 0;
      const prevPending = Number(o.previousPendingAmount) || 0;
      totalSales += Math.max(0, grandTotal - prevPending);
      const paid = o.paidAmount !== undefined ? Number(o.paidAmount) : Number(o.grandTotal) || 0;
      const pending = o.pendingAmount !== undefined ? Number(o.pendingAmount) : Math.max(0, (Number(o.grandTotal) || 0) - paid);
      totalPaid += paid;
      totalPending += pending;
    });

    return { totalSales, totalPaid, totalPending, count: orders.length };
  }, [orders]);

  const handleOpenPaymentModal = (order: Order) => {
    const paid = order.paidAmount !== undefined ? Number(order.paidAmount) : Number(order.grandTotal);
    const pending = order.pendingAmount !== undefined ? Number(order.pendingAmount) : Math.max(0, Number(order.grandTotal) - paid);
    const status = order.paymentStatus || (pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");

    setPaymentModalOrder(order);
    setEditPaidAmount(paid);
    setEditPendingAmount(pending);
    setEditPaymentStatus(status);
    setEditPaymentMethod((order.paymentMethod as any) || "Cash");
    setEditDueDate(order.dueDate || "");
    setEditPaymentNotes(order.paymentNotes || "");
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;

    updateOrderPayment(paymentModalOrder.id, {
      paidAmount: editPaidAmount,
      pendingAmount: editPendingAmount,
      paymentStatus: editPaymentStatus,
      paymentMethod: editPaymentMethod,
      dueDate: editDueDate,
      paymentNotes: editPaymentNotes,
    });
    setPaymentModalOrder(null);
  };

  const handleExportOrdersToExcel = async () => {
    const data = filteredOrders.map((o) => {
      const paid = o.paidAmount !== undefined ? o.paidAmount : o.grandTotal;
      const pending = o.pendingAmount !== undefined ? o.pendingAmount : Math.max(0, o.grandTotal - paid);
      return {
        "Order Number": o.orderNumber,
        Date: o.orderDate,
        "Customer Name": o.customerName,
        Salesman: o.salesman,
        "Items Count": o.items.length,
        "Total Qty": o.items.reduce((s, it) => s + it.quantity, 0),
        "Grand Total (PKR)": o.grandTotal,
        "Paid Amount (PKR)": paid,
        "Pending Balance (PKR)": pending,
        "Payment Status": o.paymentStatus || (pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid"),
        "Payment Method": o.paymentMethod || "Cash",
        "Due Date": o.dueDate || "",
        Status: o.status,
        "Price List": o.priceListVersion,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders History");
    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    await downloadBinaryBase64Safely(base64, `Pharmacy_Orders_History_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div id="orders-history-view" className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-12">
      {/* Header & KPI Summary */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                Sales & Purchase Orders History
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                {orders.length} Orders
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Track invoices, settlement balances, pending collections, and locked price list snapshots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveNavTab("new-order")}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Create New Order</span>
            </button>

            <button
              onClick={handleExportOrdersToExcel}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Export Orders to Excel"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sales Volume</span>
            <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
              Rs. {summaryMetrics.totalSales.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-500">{summaryMetrics.count} recorded transactions</span>
          </div>

          <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200/80">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Received / Paid</span>
            <div className="text-base font-bold font-mono text-emerald-700 mt-0.5">
              Rs. {summaryMetrics.totalPaid.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-emerald-600">Settled revenue</span>
          </div>

          <div className="bg-rose-50/60 p-3 rounded-lg border border-rose-200/80">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Total Pending Payments</span>
            <div className="text-base font-bold font-mono text-rose-600 mt-0.5">
              Rs. {summaryMetrics.totalPending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-rose-500">Outstanding receivables to collect</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search order #, customer, salesman, payment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          {/* Payment Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase font-bold text-[10px]">Payment:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="all">All Payments</option>
              <option value="Paid">Paid Only (Cleared)</option>
              <option value="Partial">Partial (Advance)</option>
              <option value="Unpaid">Unpaid / Pending</option>
            </select>
          </div>

          {/* Document Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 uppercase font-bold text-[10px]">Doc Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-800 font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="Generated">Generated (PDF Ready)</option>
              <option value="Draft">Draft</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar for Orders */}
      {filteredOrders.length > 0 && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={selectedOrderIds.length > 0 && selectedOrderIds.length === filteredOrders.length}
                onChange={() => {
                  if (selectedOrderIds.length === filteredOrders.length) {
                    setSelectedOrderIds([]);
                  } else {
                    setSelectedOrderIds(filteredOrders.map((o) => o.id));
                  }
                }}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span>Select All Orders ({filteredOrders.length})</span>
            </label>

            {selectedOrderIds.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">
                {selectedOrderIds.length} of {filteredOrders.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedOrderIds.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="px-2.5 py-1 text-slate-500 hover:text-slate-800 rounded font-medium hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDeleteModal({
                      isOpen: true,
                      title: "Delete Selected Orders",
                      message: `Are you sure you want to permanently delete these ${selectedOrderIds.length} order(s)? This action cannot be reversed.`,
                      confirmButtonText: `Delete ${selectedOrderIds.length} Orders`,
                      onConfirm: () => {
                        deleteMultipleOrders(selectedOrderIds);
                        setSelectedOrderIds([]);
                        setConfirmDeleteModal(null);
                      },
                    });
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedOrderIds.length})</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedOrderIds(filteredOrders.map((o) => o.id))}
                className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium cursor-pointer"
              >
                Select All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Orders Grid / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="text-slate-700 font-bold">No orders found.</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search filters or create a new order.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const totalQty = order.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
            const paid = order.paidAmount !== undefined ? order.paidAmount : order.grandTotal;
            const pending = order.pendingAmount !== undefined ? order.pendingAmount : Math.max(0, order.grandTotal - paid);
            const paymentStatus = order.paymentStatus || (pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");
            const isSelected = selectedOrderIds.includes(order.id);
            const hasSaleReturn = returns.some(
              (r) =>
                r.returnType === "Sale Return" &&
                r.referenceNumber.trim().toLowerCase() === order.orderNumber.trim().toLowerCase()
            );

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between space-y-3 ${
                  isSelected ? "border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/20" : "border-slate-200"
                }`}
              >
                <div>
                  {/* Order Top Line */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedOrderIds((prev) =>
                            prev.includes(order.id)
                              ? prev.filter((id) => id !== order.id)
                              : [...prev, order.id]
                          );
                        }}
                        className="w-4 h-4 mt-0.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Select order ${order.orderNumber}`}
                      />
                      <div>
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {order.orderNumber}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base mt-1 leading-snug">
                          {order.customerName || "Counter Sale"}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                          paymentStatus === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : paymentStatus === "Partial"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {paymentStatus}
                      </span>

                      <span
                        className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                          order.status === "Generated"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {order.status}
                      </span>

                      {hasSaleReturn && (
                        <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          Returned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Stats */}
                  <div className="grid grid-cols-2 gap-2 my-2.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Date</span>
                      <span className="font-medium text-slate-800">{order.orderDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Salesman</span>
                      <span className="font-medium text-slate-800">{order.salesman || "Adnan"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Items / Qty</span>
                      <span className="font-bold text-slate-800">
                        {order.items.length} lines ({totalQty} pcs)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Method</span>
                      <span className="font-medium text-slate-800">{order.paymentMethod || "Cash"}</span>
                    </div>
                  </div>

                  {/* Financial & Pending Breakdown */}
                  <div className="space-y-1 pt-1 border-t border-slate-100 text-xs">
                    {(order.previousPendingAmount || 0) > 0 && (
                      <>
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>Net Amount:</span>
                          <span className="font-mono font-semibold">
                            Rs. {Math.max(0, Number(order.grandTotal) - (Number(order.previousPendingAmount) || 0)).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-amber-800 font-semibold">
                          <span>+ Prev Pending:</span>
                          <span className="font-mono">
                            Rs. {(order.previousPendingAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold text-slate-500 uppercase text-[10px]">Total Balance</span>
                      <span className="font-mono font-bold text-slate-900 text-base">
                        Rs. {order.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {pending > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Paid:</span>
                          <span className="font-mono font-semibold text-emerald-700">
                            Rs. {paid.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-rose-700 font-bold">Pending:</span>
                          <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded font-black">
                            Rs. {pending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                        <span>Payment:</span>
                        <span className="font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase">
                          ✓ Fully Paid
                        </span>
                      </div>
                    )}

                    {order.dueDate && pending > 0 && (
                      <div className="text-[10px] text-amber-700 bg-amber-50/60 px-2 py-0.5 rounded flex items-center justify-between mt-1">
                        <span>Payment Due:</span>
                        <span className="font-bold">{order.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Price List Version used */}
                  <div className="text-[10px] text-slate-400 mt-2">
                    Price List: <span className="text-slate-600 font-medium">{order.priceListVersion}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                  <button
                    onClick={() => setSelectedOrderForPreview(order)}
                    className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View / PDF</span>
                  </button>

                  <button
                    onClick={() => handleOpenPaymentModal(order)}
                    className={`py-1.5 px-2.5 font-bold rounded-lg border flex items-center gap-1 transition-colors cursor-pointer text-xs ${
                      pending > 0
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                    }`}
                    title="Edit Payment / Settle Pending Balance"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{pending > 0 ? "Settle" : "Payment"}</span>
                  </button>

                  <button
                    onClick={() => loadOrderIntoDraft(order)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Order in Draft Mode"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => duplicateOrder(order.id)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Duplicate into New Order"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setPreselectedReturnOrderNumber(order.orderNumber);
                      setActiveNavTab("returns");
                    }}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Return Full Invoice by Invoice #"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setConfirmDeleteModal({
                        isOpen: true,
                        title: "Delete Order",
                        message: `Are you sure you want to permanently delete order "${order.orderNumber}"?`,
                        itemDescription: `Customer: ${order.customerName || "Counter Sale"} | Date: ${order.orderDate} | Total: Rs. ${order.grandTotal.toLocaleString("en-PK")}`,
                        confirmButtonText: "Yes, Delete Order",
                        onConfirm: () => {
                          deleteOrder(order.id);
                          setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id));
                          setConfirmDeleteModal(null);
                        },
                      });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Order"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settle / Edit Payment Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Payment & Settle Balance</h3>
                  <p className="text-xs text-slate-500">Order #{paymentModalOrder.orderNumber} • {paymentModalOrder.customerName || "Counter Sale"}</p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-4 space-y-4">
              {/* Order Info Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Bill Amount</span>
                  <span className="font-mono font-bold text-slate-900 text-base">
                    Rs. {paymentModalOrder.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Current Status</span>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      editPaymentStatus === "Paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : editPaymentStatus === "Partial"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {editPaymentStatus}
                  </span>
                </div>
              </div>

              {/* Status Selector Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setEditPaymentStatus("Paid");
                    setEditPaidAmount(paymentModalOrder.grandTotal);
                    setEditPendingAmount(0);
                  }}
                  className={`py-1.5 rounded text-center transition-colors cursor-pointer ${
                    editPaymentStatus === "Paid"
                      ? "bg-emerald-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Paid (Full)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const half = Math.round(paymentModalOrder.grandTotal / 2);
                    setEditPaymentStatus("Partial");
                    setEditPaidAmount(half);
                    setEditPendingAmount(paymentModalOrder.grandTotal - half);
                  }}
                  className={`py-1.5 rounded text-center transition-colors cursor-pointer ${
                    editPaymentStatus === "Partial"
                      ? "bg-amber-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Partial
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditPaymentStatus("Unpaid");
                    setEditPaidAmount(0);
                    setEditPendingAmount(paymentModalOrder.grandTotal);
                  }}
                  className={`py-1.5 rounded text-center transition-colors cursor-pointer ${
                    editPaymentStatus === "Unpaid"
                      ? "bg-rose-600 text-white shadow-xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Unpaid (Full Pending)
                </button>
              </div>

              {/* DUAL EDITABLE INPUTS: Paid Amount & Pending Amount */}
              <div className="grid grid-cols-2 gap-3">
                {/* Paid Amount */}
                <div className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-emerald-800">
                      Paid Amount (PKR)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditPaidAmount(paymentModalOrder.grandTotal);
                        setEditPendingAmount(0);
                        setEditPaymentStatus("Paid");
                      }}
                      className="text-[9px] text-emerald-700 hover:underline font-semibold"
                    >
                      Set Full
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={paymentModalOrder.grandTotal}
                    step="any"
                    value={editPaidAmount}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(paymentModalOrder.grandTotal, Number(e.target.value) || 0));
                      const pending = Math.max(0, paymentModalOrder.grandTotal - val);
                      setEditPaidAmount(val);
                      setEditPendingAmount(pending);
                      setEditPaymentStatus(pending === 0 ? "Paid" : val > 0 ? "Partial" : "Unpaid");
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-md text-emerald-950 font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Pending Amount - FULLY EDITABLE */}
                <div className="bg-rose-50/40 p-2.5 rounded-lg border border-rose-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-rose-800">
                      Pending Balance (PKR)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditPendingAmount(paymentModalOrder.grandTotal);
                        setEditPaidAmount(0);
                        setEditPaymentStatus("Unpaid");
                      }}
                      className="text-[9px] text-rose-700 hover:underline font-semibold"
                    >
                      Set Full
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={paymentModalOrder.grandTotal}
                    step="any"
                    value={editPendingAmount}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(paymentModalOrder.grandTotal, Number(e.target.value) || 0));
                      const paid = Math.max(0, paymentModalOrder.grandTotal - val);
                      setEditPendingAmount(val);
                      setEditPaidAmount(paid);
                      setEditPaymentStatus(val === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-md text-rose-950 font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Payment Method & Due Date */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Payment Method</label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs outline-none bg-slate-50 focus:bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit / Pay Later">Credit / Pay Later</option>
                    <option value="Online / Card">Online / Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 text-xs bg-slate-50 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Payment Notes / Cheque Reference */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Reference / Payment Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received via Cheque #49219 or Bank Deposit"
                  value={editPaymentNotes}
                  onChange={(e) => setEditPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save & Update Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview & Download Modal */}
      {selectedOrderForPreview && (
        <InvoicePreviewModal
          order={selectedOrderForPreview}
          onClose={() => setSelectedOrderForPreview(null)}
        />
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
