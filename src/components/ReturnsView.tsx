import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { ReturnRecord, ReturnItem, ReturnReason, Order, PurchaseOrder } from "../types";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Eye,
  AlertTriangle,
  FileText,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Receipt,
  RefreshCw,
  Truck,
} from "lucide-react";
import { findMatchingProducts } from "../utils/fuzzyMatch";

const RETURN_REASONS: ReturnReason[] = [
  "Customer Cancellation",
  "Damaged / Broken",
  "Near Expiry / Expired",
  "Excess Stock",
  "Shortage / Quantity Discrepancy",
  "Quality Defect",
  "Wrong Item Supplied",
  "Wrong Item Received",
  "Other",
];

export const ReturnsView: React.FC = () => {
  const {
    returns,
    saveReturn,
    deleteReturn,
    generateNextReturnNumber,
    currentProducts,
    orders,
    purchases,
    settings,
    preselectedReturnOrderNumber,
    setPreselectedReturnOrderNumber,
    preselectedReturnPurchaseRef,
    setPreselectedReturnPurchaseRef,
    getItemAvailableStock,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Entry mode: "full_invoice" (load entire invoice by Invoice #) vs "manual" (one-by-one)
  const defaultFullInvoiceMode = settings.fullInvoiceReturnByDefault !== false;
  const defaultSaleCondition: "Restockable" | "Damaged / Quarantine" =
    settings.defaultSaleReturnCondition || "Restockable";

  const [returnEntryMode, setReturnEntryMode] = useState<"full_invoice" | "manual">(
    defaultFullInvoiceMode ? "full_invoice" : "manual"
  );

  // Form state
  const [returnType, setReturnType] = useState<"Sale Return" | "Purchase Return">("Sale Return");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyContact, setPartyContact] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [actionTaken, setActionTaken] = useState<
    "Credit Note / Ledger Adjustment" | "Stock Replacement" | "Cash Refund"
  >("Credit Note / Ledger Adjustment");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Full Invoice Lookup state
  const [invoiceLookupQuery, setInvoiceLookupQuery] = useState("");
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [loadedOrder, setLoadedOrder] = useState<Order | null>(null);
  const [loadedPurchase, setLoadedPurchase] = useState<PurchaseOrder | null>(null);
  const [bulkReason, setBulkReason] = useState<ReturnReason>("Customer Cancellation");
  const [bulkCondition, setBulkCondition] = useState<
    "Restockable" | "Damaged / Quarantine" | "Returned to Supplier"
  >(defaultSaleCondition);

  // Manual item row input
  const [productInput, setProductInput] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [batch, setBatch] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitRate, setUnitRate] = useState<number>(0);
  const [reason, setReason] = useState<ReturnReason>("Damaged / Broken");
  const [condition, setCondition] = useState<
    "Restockable" | "Damaged / Quarantine" | "Returned to Supplier"
  >(defaultSaleCondition);

  const [productSuggestions, setProductSuggestions] = useState<
    Array<{ name: string; price: number; id: string }>
  >([]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders]);

  const matchingInvoices = useMemo(() => {
    const q = invoiceLookupQuery.trim().toLowerCase();
    if (!q) return sortedOrders.slice(0, 12);
    return sortedOrders
      .filter(
        (ord) =>
          ord.orderNumber.toLowerCase().includes(q) ||
          (ord.customerName || "").toLowerCase().includes(q) ||
          (ord.customerPhone || "").toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [sortedOrders, invoiceLookupQuery]);

  const sortedPurchases = useMemo(() => {
    return [...purchases].sort(
      (a, b) =>
        new Date(b.createdAt || b.purchaseDate).getTime() -
        new Date(a.createdAt || a.purchaseDate).getTime()
    );
  }, [purchases]);

  const matchingPurchases = useMemo(() => {
    const q = invoiceLookupQuery.trim().toLowerCase();
    if (!q) return sortedPurchases.slice(0, 12);
    return sortedPurchases
      .filter(
        (pur) =>
          pur.purchaseNumber.toLowerCase().includes(q) ||
          (pur.supplierInvoiceNo || "").toLowerCase().includes(q) ||
          (pur.supplierName || "").toLowerCase().includes(q) ||
          (pur.supplierPhone || "").toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [sortedPurchases, invoiceLookupQuery]);

  const doesReturnMatchPurchase = (ret: ReturnRecord, purchase: PurchaseOrder): boolean => {
    if (ret.returnType !== "Purchase Return") return false;
    const ref = ret.referenceNumber.trim().toLowerCase();
    const purNo = purchase.purchaseNumber.trim().toLowerCase();
    const supInv = (purchase.supplierInvoiceNo || "").trim().toLowerCase();
    return (
      ref === purNo ||
      ref.includes(purNo) ||
      (supInv !== "" && supInv !== "-" && (ref === supInv || ref.includes(supInv)))
    );
  };

  const buildItemsFromOrder = (
    order: Order,
    itemReason: ReturnReason,
    itemCondition: "Restockable" | "Damaged / Quarantine" | "Returned to Supplier"
  ): ReturnItem[] => {
    return order.items.map((ordItem, idx) => {
      const qty = Math.max(1, Number(ordItem.quantity) || 1);
      const lineAmount = Number(ordItem.amount) || qty * (Number(ordItem.rate) || 0);
      const effectiveRate =
        qty > 0 && lineAmount > 0
          ? Number((lineAmount / qty).toFixed(2))
          : Number(ordItem.rate) || 0;

      return {
        id: `ritm-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        productId: ordItem.productId || `prod-ord-${idx}`,
        productName: ordItem.productName,
        batch: ordItem.batch || "",
        quantity: qty,
        unitRate: effectiveRate,
        amount: Math.round(lineAmount * 100) / 100,
        reason: itemReason,
        condition: itemCondition,
      };
    });
  };

  const buildItemsFromPurchase = (
    purchase: PurchaseOrder,
    itemReason: ReturnReason,
    itemCondition: "Restockable" | "Damaged / Quarantine" | "Returned to Supplier"
  ): ReturnItem[] => {
    return purchase.items.map((purItem, idx) => {
      const qty = Math.max(1, Number(purItem.quantity) || 1);
      const lineAmount = Number(purItem.amount) || qty * (Number(purItem.costRate) || 0);
      const effectiveRate =
        qty > 0 && lineAmount > 0
          ? Number((lineAmount / qty).toFixed(2))
          : Number(purItem.costRate) || 0;

      return {
        id: `ritm-pur-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        productId: purItem.productId || `prod-pur-${idx}`,
        productName: purItem.productName,
        batch: purItem.batch || "",
        quantity: qty,
        unitRate: effectiveRate,
        amount: Math.round(lineAmount * 100) / 100,
        reason: itemReason,
        condition: itemCondition,
      };
    });
  };

  const applyOrderToReturnForm = (
    order: Order,
    overrideCondition?: "Restockable" | "Damaged / Quarantine" | "Returned to Supplier"
  ) => {
    const chosenCondition = overrideCondition || bulkCondition;
    setLoadedOrder(order);
    setLoadedPurchase(null);
    setInvoiceLookupQuery(order.orderNumber);
    setShowInvoiceDropdown(false);
    setReferenceNumber(order.orderNumber);
    setPartyName(order.customerName || "Counter Sale");
    setPartyContact(order.customerPhone || "");
    setFormError(null);
    setItems(buildItemsFromOrder(order, bulkReason, chosenCondition));
    if (!notes.trim() || notes.startsWith("Full invoice return") || notes.startsWith("Full purchase return")) {
      setNotes(`Full invoice return against ${order.orderNumber} (${order.orderDate}).`);
    }
  };

  const applyPurchaseToReturnForm = (
    purchase: PurchaseOrder,
    overrideCondition?: "Restockable" | "Damaged / Quarantine" | "Returned to Supplier",
    overrideReason?: ReturnReason
  ) => {
    const chosenCondition = overrideCondition || "Returned to Supplier";
    const chosenReason = overrideReason || bulkReason;
    const hasSupInv =
      purchase.supplierInvoiceNo &&
      purchase.supplierInvoiceNo.trim() !== "" &&
      purchase.supplierInvoiceNo.trim() !== "-";
    const formattedRef = hasSupInv
      ? `${purchase.purchaseNumber} (${purchase.supplierInvoiceNo.trim()})`
      : purchase.purchaseNumber;

    setLoadedPurchase(purchase);
    setLoadedOrder(null);
    setInvoiceLookupQuery(purchase.purchaseNumber);
    setShowInvoiceDropdown(false);
    setReferenceNumber(formattedRef);
    setPartyName(purchase.supplierName || "Supplier");
    setPartyContact(purchase.supplierPhone || "");
    setBulkCondition(chosenCondition);
    setBulkReason(chosenReason);
    setFormError(null);
    setItems(buildItemsFromPurchase(purchase, chosenReason, chosenCondition));
    if (!notes.trim() || notes.startsWith("Full invoice return") || notes.startsWith("Full purchase return")) {
      setNotes(
        `Full purchase return against ${purchase.purchaseNumber}${
          hasSupInv ? ` / Supplier Inv: ${purchase.supplierInvoiceNo}` : ""
        } (${purchase.purchaseDate}).`
      );
    }
  };

  const resetFormState = (
    modeOverride?: "full_invoice" | "manual",
    typeOverride?: "Sale Return" | "Purchase Return"
  ) => {
    const targetMode =
      modeOverride || (settings.fullInvoiceReturnByDefault !== false ? "full_invoice" : "manual");
    const targetType = typeOverride || "Sale Return";
    const defSaleCond = settings.defaultSaleReturnCondition || "Restockable";
    const targetCond = targetType === "Purchase Return" ? "Returned to Supplier" : defSaleCond;
    const targetBulkReason: ReturnReason =
      targetType === "Purchase Return" ? "Damaged / Broken" : "Customer Cancellation";

    setReturnType(targetType);
    setReturnEntryMode(targetMode);
    setReferenceNumber("");
    setPartyName("");
    setPartyContact("");
    setReturnDate(new Date().toISOString().split("T")[0]);
    setActionTaken("Credit Note / Ledger Adjustment");
    setNotes("");
    setItems([]);
    setFormError(null);
    setInvoiceLookupQuery("");
    setShowInvoiceDropdown(false);
    setLoadedOrder(null);
    setLoadedPurchase(null);
    setBulkReason(targetBulkReason);
    setBulkCondition(targetCond);
    setProductInput("");
    setSelectedProductId("");
    setBatch("");
    setQuantity(1);
    setUnitRate(0);
    setReason("Damaged / Broken");
    setCondition(targetCond);
    setProductSuggestions([]);
  };

  const openCreateModal = (
    modeOverride?: "full_invoice" | "manual",
    typeOverride?: "Sale Return" | "Purchase Return"
  ) => {
    resetFormState(modeOverride, typeOverride);
    setIsCreateModalOpen(true);
  };

  const handleReturnTypeSwitch = (nextType: "Sale Return" | "Purchase Return") => {
    if (nextType === returnType) return;
    setReturnType(nextType);
    setFormError(null);
    setShowInvoiceDropdown(false);
    setInvoiceLookupQuery("");
    setLoadedOrder(null);
    setLoadedPurchase(null);
    setItems([]);
    setReferenceNumber("");
    setPartyName("");
    setPartyContact("");
    setNotes("");
    if (nextType === "Purchase Return") {
      setBulkReason("Damaged / Broken");
      setBulkCondition("Returned to Supplier");
      setCondition("Returned to Supplier");
    } else {
      setBulkReason("Customer Cancellation");
      setBulkCondition(defaultSaleCondition);
      setCondition(defaultSaleCondition);
    }
  };

  // Auto-open and load full invoice when navigated from Orders History
  useEffect(() => {
    if (!preselectedReturnOrderNumber) return;
    const matched = orders.find(
      (o) =>
        o.orderNumber.trim().toLowerCase() ===
        preselectedReturnOrderNumber.trim().toLowerCase()
    );
    const defCond = settings.defaultSaleReturnCondition || "Restockable";
    resetFormState("full_invoice", "Sale Return");
    setIsCreateModalOpen(true);
    if (matched) {
      applyOrderToReturnForm(matched, defCond);
    } else {
      setInvoiceLookupQuery(preselectedReturnOrderNumber);
      setReferenceNumber(preselectedReturnOrderNumber);
    }
    setPreselectedReturnOrderNumber(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedReturnOrderNumber]);

  // Auto-open and load full purchase bill when navigated from Purchases Ledger
  useEffect(() => {
    if (!preselectedReturnPurchaseRef) return;
    const q = preselectedReturnPurchaseRef.trim().toLowerCase();
    const matched = purchases.find(
      (p) =>
        p.purchaseNumber.trim().toLowerCase() === q ||
        (p.supplierInvoiceNo || "").trim().toLowerCase() === q
    );
    resetFormState("full_invoice", "Purchase Return");
    setIsCreateModalOpen(true);
    if (matched) {
      applyPurchaseToReturnForm(matched, "Returned to Supplier", "Damaged / Broken");
    } else {
      setInvoiceLookupQuery(preselectedReturnPurchaseRef);
      setReferenceNumber(preselectedReturnPurchaseRef);
    }
    setPreselectedReturnPurchaseRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedReturnPurchaseRef]);

  const handleLookupInvoiceSubmit = () => {
    const q = invoiceLookupQuery.trim().toLowerCase();

    if (returnType === "Purchase Return") {
      if (!q) {
        setFormError(
          "Please enter or select a Purchase # or Supplier Invoice # (e.g. PUR-2026-0001)."
        );
        return;
      }

      const exactPurchase = sortedPurchases.find(
        (p) =>
          p.purchaseNumber.toLowerCase() === q ||
          (p.supplierInvoiceNo || "").trim().toLowerCase() === q
      );
      if (exactPurchase) {
        applyPurchaseToReturnForm(exactPurchase);
        return;
      }

      const matchedList = sortedPurchases.filter(
        (p) =>
          p.purchaseNumber.toLowerCase().includes(q) ||
          (p.supplierInvoiceNo || "").toLowerCase().includes(q) ||
          (p.supplierName || "").toLowerCase().includes(q)
      );

      if (matchedList.length === 1) {
        applyPurchaseToReturnForm(matchedList[0]);
      } else if (matchedList.length > 1) {
        setShowInvoiceDropdown(true);
        setFormError(
          `Multiple purchase bills matched "${invoiceLookupQuery.trim()}". Please click the exact bill from the list.`
        );
      } else {
        setFormError(
          `No purchase bill found matching "${invoiceLookupQuery.trim()}".`
        );
      }
      return;
    }

    if (!q) {
      setFormError("Please enter or select a Sale Invoice # (e.g. ORD-2026-0001).");
      return;
    }

    const exact = sortedOrders.find((o) => o.orderNumber.toLowerCase() === q);
    if (exact) {
      applyOrderToReturnForm(exact);
      return;
    }

    const suffixOrPartial = sortedOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q)
    );

    if (suffixOrPartial.length === 1) {
      applyOrderToReturnForm(suffixOrPartial[0]);
    } else if (suffixOrPartial.length > 1) {
      setShowInvoiceDropdown(true);
      setFormError(
        `Multiple invoices matched "${invoiceLookupQuery.trim()}". Please click the exact invoice from the list.`
      );
    } else {
      setFormError(`No sale invoice found matching "${invoiceLookupQuery.trim()}".`);
    }
  };

  const handleBulkReasonChange = (newReason: ReturnReason) => {
    setBulkReason(newReason);
    setItems((prev) => prev.map((it) => ({ ...it, reason: newReason })));
  };

  const handleBulkConditionChange = (
    newCondition: "Restockable" | "Damaged / Quarantine" | "Returned to Supplier"
  ) => {
    setBulkCondition(newCondition);
    setItems((prev) => prev.map((it) => ({ ...it, condition: newCondition })));
  };

  const handleUpdateItemQuantity = (itemId: string, newQtyRaw: number) => {
    const newQty = Math.max(1, Number(newQtyRaw) || 1);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              quantity: newQty,
              amount: Math.round(newQty * it.unitRate * 100) / 100,
            }
          : it
      )
    );
  };

  const handleUpdateItemField = (
    itemId: string,
    updates: Partial<Pick<ReturnItem, "reason" | "condition">>
  ) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, ...updates } : it)));
  };

  const handleProductInputChange = (val: string) => {
    setProductInput(val);
    if (val.trim().length > 1) {
      const matches = findMatchingProducts(val, currentProducts, 5);
      setProductSuggestions(
        matches.map((m) => ({
          name: m.product.name,
          price: m.product.price,
          id: m.product.id,
        }))
      );
    } else {
      setProductSuggestions([]);
    }
  };

  const handleSelectProduct = (prod: { name: string; price: number; id: string }) => {
    setProductInput(prod.name);
    setSelectedProductId(prod.id);
    setUnitRate(prod.price);
    setProductSuggestions([]);
  };

  const handleAddItem = () => {
    if (!productInput.trim()) return;
    const numQty = Number(quantity) || 1;
    const numRate = Number(unitRate) || 0;
    const amount = Math.round(numQty * numRate * 100) / 100;

    const newItem: ReturnItem = {
      id: `ritm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: selectedProductId || `prod-custom-${Date.now()}`,
      productName: productInput.trim(),
      batch: batch.trim(),
      quantity: numQty,
      unitRate: numRate,
      amount,
      reason,
      condition,
    };

    setItems([...items, newItem]);
    setFormError(null);

    // Reset item row
    setProductInput("");
    setSelectedProductId("");
    setBatch("");
    setQuantity(1);
    setUnitRate(0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const totalReturnAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const existingReturnForLoadedOrder = useMemo(() => {
    if (!loadedOrder) return null;
    return (
      returns.find(
        (r) =>
          r.returnType === "Sale Return" &&
          r.referenceNumber.trim().toLowerCase() ===
            loadedOrder.orderNumber.trim().toLowerCase()
      ) || null
    );
  }, [loadedOrder, returns]);

  const existingReturnForLoadedPurchase = useMemo(() => {
    if (!loadedPurchase) return null;
    return returns.find((r) => doesReturnMatchPurchase(r, loadedPurchase)) || null;
  }, [loadedPurchase, returns]);

  const handleSaveReturn = () => {
    if (!partyName.trim()) {
      setFormError(
        returnEntryMode === "full_invoice"
          ? returnType === "Purchase Return"
            ? "Please select or load a Purchase / Supplier Invoice # first (or enter Supplier Name)."
            : "Please select or load a Sale Invoice # first (or enter Customer Name)."
          : "Please enter customer / supplier party name."
      );
      return;
    }
    if (items.length === 0) {
      setFormError(
        returnEntryMode === "full_invoice"
          ? returnType === "Purchase Return"
            ? "No items loaded yet. Enter a Purchase # or Supplier Invoice # and click 'Load Purchase Bill'."
            : "No items loaded yet. Enter an Invoice # and click 'Load Full Invoice'."
          : "Please add at least one item to this return record."
      );
      return;
    }

    const newRecord: ReturnRecord = {
      id: `ret-${Date.now()}`,
      returnNumber: generateNextReturnNumber(),
      returnType,
      referenceNumber: referenceNumber.trim() || "-",
      partyName: partyName.trim(),
      partyContact: partyContact.trim(),
      returnDate,
      items,
      totalAmount: Math.round(totalReturnAmount * 100) / 100,
      status: "Approved",
      actionTaken,
      notes: notes.trim(),
      handledBy: settings.defaultSalesman || "ADNAN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveReturn(newRecord);
    setIsCreateModalOpen(false);
    resetFormState();
  };

  const filteredReturns = returns.filter((ret) => {
    const matchesSearch =
      ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.items.some((it) => it.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = typeFilter === "all" || ret.returnType === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalSaleReturnVal = returns
    .filter((r) => r.returnType === "Sale Return")
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const totalPurchaseReturnVal = returns
    .filter((r) => r.returnType === "Purchase Return")
    .reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Stock Returns &amp; Full Invoice Return
            </h2>
            <p className="text-sm text-slate-500">
              Return an entire Sale Invoice or Supplier Purchase Bill by Invoice # in 1 click, or log individual items.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-open-full-invoice-return"
            onClick={() => openCreateModal("full_invoice", "Sale Return")}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Receipt className="w-4 h-4" />
            <span>Sale Return by Invoice #</span>
          </button>

          <button
            id="btn-open-purchase-invoice-return"
            onClick={() => openCreateModal("full_invoice", "Purchase Return")}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Purchase Return by Invoice #</span>
          </button>

          <button
            id="btn-open-new-return"
            onClick={() => openCreateModal("manual", "Sale Return")}
            className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Return</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer Sale Returns
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {settings.currencySymbol} {totalSaleReturnVal.toLocaleString()}
          </p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Inward adjustments from retail &amp; hospital clients
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Supplier Purchase Returns
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {settings.currencySymbol} {totalPurchaseReturnVal.toLocaleString()}
          </p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Outward credit adjustments to distributors
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Logged Discrepancies
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{returns.length} Records</p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Mode:{" "}
            {settings.fullInvoiceReturnByDefault !== false
              ? "Full Invoice # Return Enabled"
              : "Manual Entry Default"}
          </span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-returns"
            type="text"
            placeholder="Search return #, invoice #, party, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            id="select-return-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            <option value="all">All Return Types</option>
            <option value="Sale Return">Sale Returns (Customer)</option>
            <option value="Purchase Return">Purchase Returns (Supplier)</option>
          </select>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Return #</th>
                <th className="py-3.5 px-4">Type &amp; Invoice Ref</th>
                <th className="py-3.5 px-4">Customer / Supplier</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Items &amp; Reason</th>
                <th className="py-3.5 px-4 text-right">Total Amount</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <RotateCcw className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-base font-semibold text-slate-600">No return records logged</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "Return Full Invoice by #" to return an entire sale invoice at once.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      {ret.returnNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md ${
                          ret.returnType === "Sale Return"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        {ret.returnType}
                      </span>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Ref: {ret.referenceNumber}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{ret.partyName}</div>
                      <div className="text-xs text-slate-400">{ret.partyContact || "No contact"}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {ret.returnDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800">
                        {ret.items.length} items (
                        {ret.items.reduce((s, it) => s + it.quantity, 0)} units)
                      </span>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">
                        {Array.from(new Set(ret.items.map((i) => i.reason))).join(", ")}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900 font-mono">
                      {settings.currencySymbol} {ret.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          id={`btn-view-return-${ret.id}`}
                          onClick={() => setSelectedReturn(ret)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="View Return Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-delete-return-${ret.id}`}
                          onClick={() => {
                            setConfirmDeleteModal({
                              isOpen: true,
                              title: "Delete Return Record",
                              message: `Are you sure you want to permanently delete return record ${ret.returnNumber}?`,
                              itemDescription: `Type: ${ret.returnType} | Party: ${ret.partyName} | Total: ${settings.currencySymbol} ${ret.totalAmount.toLocaleString()}`,
                              confirmButtonText: "Yes, Delete Return",
                              onConfirm: () => {
                                deleteReturn(ret.id);
                                setConfirmDeleteModal(null);
                              },
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete Return Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE RETURN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="font-bold text-base text-white">
                    {returnEntryMode === "full_invoice"
                      ? returnType === "Purchase Return"
                        ? "Purchase Return by Invoice / Bill #"
                        : "Full Sale Invoice Return (By Invoice #)"
                      : "Record Return / Defect / Quarantine Voucher"}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {returnEntryMode === "full_invoice"
                      ? returnType === "Purchase Return"
                        ? "Enter Purchase # or Supplier Invoice # to load supplier bill items and return stock."
                        : "Enter or pick a Sale Invoice # to automatically load and return the full bill at once."
                      : "Log returned items manually one by one for customer or supplier returns."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Inline Validation Error Banner */}
              {formError && (
                <div className="flex items-center justify-between gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="p-0.5 text-rose-500 hover:text-rose-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Return Type & Entry Mode Selector Bar */}
              <div
                className={`flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl border ${
                  returnType === "Purchase Return"
                    ? "bg-purple-50/70 border-purple-200/80"
                    : "bg-rose-50/70 border-rose-200/80"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-bold flex items-center gap-1.5 ${
                      returnType === "Purchase Return" ? "text-purple-900" : "text-rose-900"
                    }`}
                  >
                    {returnType === "Purchase Return" ? (
                      <Truck className="w-4 h-4 text-purple-600" />
                    ) : (
                      <Receipt className="w-4 h-4 text-rose-600" />
                    )}
                    <span>Return Type:</span>
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                    <button
                      type="button"
                      id="btn-switch-sale-return"
                      onClick={() => handleReturnTypeSwitch("Sale Return")}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        returnType === "Sale Return"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Sale Return (Customer)
                    </button>
                    <button
                      type="button"
                      id="btn-switch-purchase-return"
                      onClick={() => handleReturnTypeSwitch("Purchase Return")}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        returnType === "Purchase Return"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Purchase Return (Supplier)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-semibold self-start lg:self-auto">
                  <button
                    type="button"
                    id="btn-mode-full-invoice"
                    onClick={() => {
                      setReturnEntryMode("full_invoice");
                      setFormError(null);
                    }}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      returnEntryMode === "full_invoice"
                        ? returnType === "Purchase Return"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-rose-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    By Invoice # (Full Bill)
                  </button>
                  <button
                    type="button"
                    id="btn-mode-manual"
                    onClick={() => {
                      setReturnEntryMode("manual");
                      setFormError(null);
                    }}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      returnEntryMode === "manual"
                        ? "bg-slate-800 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Manual (One by One)
                  </button>
                </div>
              </div>

              {/* FULL SALE INVOICE LOOKUP BOX */}
              {returnType === "Sale Return" && returnEntryMode === "full_invoice" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Select or Type Sale Invoice # to Load Entire Bill
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {orders.length} Sale Invoices Available
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 relative">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="input-invoice-lookup"
                        type="text"
                        placeholder="Type Invoice # (e.g. ORD-2026-0001) or Customer Name..."
                        value={invoiceLookupQuery}
                        onFocus={() => setShowInvoiceDropdown(true)}
                        onChange={(e) => {
                          setInvoiceLookupQuery(e.target.value);
                          setShowInvoiceDropdown(true);
                          setFormError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLookupInvoiceSubmit();
                          }
                        }}
                        className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                      {invoiceLookupQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceLookupQuery("");
                            setShowInvoiceDropdown(true);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Searchable Sale Invoice Dropdown */}
                      {showInvoiceDropdown && matchingInvoices.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                          <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 sticky top-0">
                            <span>Click any Invoice to Load All Items</span>
                            <button
                              type="button"
                              onClick={() => setShowInvoiceDropdown(false)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              Close
                            </button>
                          </div>
                          {matchingInvoices.map((ord) => {
                            const alreadyReturned = returns.find(
                              (r) =>
                                r.returnType === "Sale Return" &&
                                r.referenceNumber.trim().toLowerCase() ===
                                  ord.orderNumber.trim().toLowerCase()
                            );
                            const totalPcs = ord.items.reduce(
                              (s, it) => s + (Number(it.quantity) || 0),
                              0
                            );
                            return (
                              <button
                                key={ord.id}
                                type="button"
                                onClick={() => applyOrderToReturnForm(ord)}
                                className="w-full text-left px-3 py-2.5 hover:bg-rose-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                      {ord.orderNumber}
                                    </span>
                                    <span className="font-semibold text-xs text-slate-900 truncate">
                                      {ord.customerName || "Counter Sale"}
                                    </span>
                                    {alreadyReturned && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        Returned ({alreadyReturned.returnNumber})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {ord.orderDate} &bull; {ord.items.length} products ({totalPcs} pcs)
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono text-xs font-bold text-slate-900">
                                    {settings.currencySymbol}{" "}
                                    {ord.grandTotal.toLocaleString("en-PK")}
                                  </div>
                                  <div className="text-[10px] text-rose-600 font-semibold">
                                    Load Full &rarr;
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      id="btn-load-full-invoice"
                      onClick={handleLookupInvoiceSubmit}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Load Full Invoice</span>
                    </button>
                  </div>

                  {/* Loaded Order Confirmation & Bulk Controls */}
                  {loadedOrder && (
                    <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-emerald-900">
                              Full Invoice Loaded: {loadedOrder.orderNumber}
                            </span>
                            <span className="text-slate-600 block sm:inline sm:ml-2">
                              {loadedOrder.customerName || "Counter Sale"} &bull;{" "}
                              {loadedOrder.items.length} products &bull; Invoice Net Total:{" "}
                              <strong className="font-mono text-slate-900">
                                {settings.currencySymbol}{" "}
                                {loadedOrder.grandTotal.toLocaleString("en-PK")}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => applyOrderToReturnForm(loadedOrder)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reload All Items</span>
                        </button>
                      </div>

                      {existingReturnForLoadedOrder && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Heads up: A Sale Return ({existingReturnForLoadedOrder.returnNumber} on{" "}
                            {existingReturnForLoadedOrder.returnDate}) already exists for{" "}
                            {loadedOrder.orderNumber}.
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Apply Return Reason to All Items
                          </label>
                          <select
                            value={bulkReason}
                            onChange={(e) => handleBulkReasonChange(e.target.value as ReturnReason)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                          >
                            {RETURN_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Apply Stock Condition to All Items
                          </label>
                          <select
                            value={bulkCondition}
                            onChange={(e) =>
                              handleBulkConditionChange(
                                e.target.value as
                                  | "Restockable"
                                  | "Damaged / Quarantine"
                                  | "Returned to Supplier"
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                          >
                            <option value="Restockable">
                              Restockable (Back to sellable stock)
                            </option>
                            <option value="Damaged / Quarantine">
                              Damaged / Quarantine (Do not restock)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* FULL PURCHASE BILL / SUPPLIER INVOICE LOOKUP BOX */}
              {returnType === "Purchase Return" && returnEntryMode === "full_invoice" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Select or Type Purchase # / Supplier Invoice # to Load Bill
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {purchases.length} Purchase Bills Available
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 relative">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="input-purchase-invoice-lookup"
                        type="text"
                        placeholder="Type Purchase # (e.g. PUR-2026-0001), Supplier Inv #, or Supplier Name..."
                        value={invoiceLookupQuery}
                        onFocus={() => setShowInvoiceDropdown(true)}
                        onChange={(e) => {
                          setInvoiceLookupQuery(e.target.value);
                          setShowInvoiceDropdown(true);
                          setFormError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleLookupInvoiceSubmit();
                          }
                        }}
                        className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                      {invoiceLookupQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setInvoiceLookupQuery("");
                            setShowInvoiceDropdown(true);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Searchable Purchase Bill Dropdown */}
                      {showInvoiceDropdown && matchingPurchases.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                          <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 sticky top-0">
                            <span>Click any Purchase Bill to Load Items</span>
                            <button
                              type="button"
                              onClick={() => setShowInvoiceDropdown(false)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              Close
                            </button>
                          </div>
                          {matchingPurchases.map((pur) => {
                            const alreadyReturned = returns.find((r) =>
                              doesReturnMatchPurchase(r, pur)
                            );
                            const totalPcs = pur.items.reduce(
                              (s, it) => s + (Number(it.quantity) || 0),
                              0
                            );
                            return (
                              <button
                                key={pur.id}
                                type="button"
                                onClick={() => applyPurchaseToReturnForm(pur)}
                                className="w-full text-left px-3 py-2.5 hover:bg-purple-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                      {pur.purchaseNumber}
                                    </span>
                                    {pur.supplierInvoiceNo && pur.supplierInvoiceNo !== "-" && (
                                      <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        Inv: {pur.supplierInvoiceNo}
                                      </span>
                                    )}
                                    <span className="font-semibold text-xs text-slate-900 truncate">
                                      {pur.supplierName}
                                    </span>
                                    {alreadyReturned && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        Returned ({alreadyReturned.returnNumber})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {pur.purchaseDate} &bull; {pur.items.length} products ({totalPcs}{" "}
                                    pcs)
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono text-xs font-bold text-slate-900">
                                    {settings.currencySymbol}{" "}
                                    {pur.grandTotal.toLocaleString("en-PK")}
                                  </div>
                                  <div className="text-[10px] text-purple-700 font-semibold">
                                    Load Bill &rarr;
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      id="btn-load-full-purchase"
                      onClick={handleLookupInvoiceSubmit}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Load Purchase Bill</span>
                    </button>
                  </div>

                  {/* Loaded Purchase Confirmation & Bulk Controls */}
                  {loadedPurchase && (
                    <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-emerald-900">
                              Purchase Bill Loaded: {loadedPurchase.purchaseNumber}
                              {loadedPurchase.supplierInvoiceNo &&
                              loadedPurchase.supplierInvoiceNo !== "-"
                                ? ` (Supplier Inv: ${loadedPurchase.supplierInvoiceNo})`
                                : ""}
                            </span>
                            <span className="text-slate-600 block sm:inline sm:ml-2">
                              {loadedPurchase.supplierName} &bull;{" "}
                              {loadedPurchase.items.length} products &bull; Bill Net Total:{" "}
                              <strong className="font-mono text-slate-900">
                                {settings.currencySymbol}{" "}
                                {loadedPurchase.grandTotal.toLocaleString("en-PK")}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => applyPurchaseToReturnForm(loadedPurchase)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reload All Items</span>
                        </button>
                      </div>

                      {existingReturnForLoadedPurchase && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Heads up: A Purchase Return (
                            {existingReturnForLoadedPurchase.returnNumber} on{" "}
                            {existingReturnForLoadedPurchase.returnDate}) already exists for{" "}
                            {loadedPurchase.purchaseNumber}.
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Apply Return Reason to All Items
                          </label>
                          <select
                            value={bulkReason}
                            onChange={(e) => handleBulkReasonChange(e.target.value as ReturnReason)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                          >
                            {RETURN_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Apply Stock Condition to All Items
                          </label>
                          <select
                            value={bulkCondition}
                            onChange={(e) =>
                              handleBulkConditionChange(
                                e.target.value as
                                  | "Restockable"
                                  | "Damaged / Quarantine"
                                  | "Returned to Supplier"
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                          >
                            <option value="Returned to Supplier">
                              Returned to Supplier (Deduct from stock)
                            </option>
                            <option value="Damaged / Quarantine">
                              Damaged / Quarantine (Deduct from stock)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Header Party & Resolution Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Type *</label>
                  <select
                    value={returnType}
                    onChange={(e) =>
                      handleReturnTypeSwitch(e.target.value as "Sale Return" | "Purchase Return")
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="Sale Return">Sale Return (From Customer)</option>
                    <option value="Purchase Return">Purchase Return (To Supplier)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {returnType === "Purchase Return"
                      ? "Purchase / Supplier Inv #"
                      : "Invoice / Order Ref #"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      returnType === "Purchase Return"
                        ? "e.g. PUR-2026-0001"
                        : "e.g. ORD-2026-0001"
                    }
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {returnType === "Sale Return"
                      ? "Customer / Pharmacy Name *"
                      : "Supplier Name *"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      returnType === "Purchase Return"
                        ? "e.g. Ali Medicos Distributor"
                        : "e.g. Al-Rehman Pharmacy"
                    }
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Date</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Resolution / Action Taken
                  </label>
                  <select
                    value={actionTaken}
                    onChange={(e) =>
                      setActionTaken(
                        e.target.value as
                          | "Credit Note / Ledger Adjustment"
                          | "Stock Replacement"
                          | "Cash Refund"
                      )
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Credit Note / Ledger Adjustment">
                      Credit Note / Ledger Adjustment
                    </option>
                    <option value="Stock Replacement">Stock Replacement (Unit Swap)</option>
                    <option value="Cash Refund">Cash Refund</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={partyContact}
                    onChange={(e) => setPartyContact(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Items Entry & Table */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Returned Items ({items.length})
                  </h4>
                  {items.length > 0 && (
                    <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                      Total: {settings.currencySymbol} {totalReturnAmount.toLocaleString("en-PK")}
                    </span>
                  )}
                </div>

                {/* Show One-by-One Manual Entry box in Manual Mode */}
                {returnEntryMode === "manual" && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                      <div className="relative">
                        <label className="block font-semibold text-slate-600 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          placeholder="Search product..."
                          value={productInput}
                          onChange={(e) => handleProductInputChange(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                        />
                        {productSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                            {productSuggestions.map((prod) => (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => handleSelectProduct(prod)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 flex justify-between"
                              >
                                <span>{prod.name}</span>
                                <span className="font-mono text-slate-400">Rs. {prod.price}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Batch #</label>
                          <input
                            type="text"
                            placeholder="Batch"
                            value={batch}
                            onChange={(e) => setBatch(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={quantity || ""}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                          Unit Rate *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={unitRate || ""}
                          onChange={(e) => setUnitRate(Number(e.target.value))}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Reason *</label>
                        <select
                          value={reason}
                          onChange={(e) => setReason(e.target.value as ReturnReason)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                        >
                          {RETURN_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">
                          Stock Condition
                        </label>
                        <select
                          value={condition}
                          onChange={(e) =>
                            setCondition(
                              e.target.value as
                                | "Restockable"
                                | "Damaged / Quarantine"
                                | "Returned to Supplier"
                            )
                          }
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="Restockable">Restockable (Back to shelf)</option>
                          <option value="Damaged / Quarantine">Damaged / Quarantine</option>
                          <option value="Returned to Supplier">Returned to Supplier</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Item
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50/70 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                    {returnEntryMode === "full_invoice"
                      ? returnType === "Purchase Return"
                        ? "Select or enter a Purchase # or Supplier Invoice # above to load all items from that supplier bill."
                        : "Select or enter an Invoice # above to automatically populate all items from that invoice."
                      : "No items added yet. Use the form above to add returned products."}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3">Reason</th>
                          <th className="py-2 px-3">Condition</th>
                          <th className="py-2 px-3 text-right">Rate</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((it) => {
                          const stockInfo =
                            returnType === "Purchase Return"
                              ? getItemAvailableStock(it.productId, it.productName)
                              : null;
                          return (
                            <tr key={it.id} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-800">{it.productName}</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {it.batch && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Batch: {it.batch}
                                    </span>
                                  )}
                                  {stockInfo && (
                                    <span
                                      className={`text-[10px] font-mono ${
                                        stockInfo.availableStock < it.quantity
                                          ? "text-amber-700 font-semibold"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      Avail Stock: {stockInfo.availableStock}
                                    </span>
                                  )}
                                </div>
                              </td>
                            <td className="py-2 px-3">
                              <select
                                value={it.reason}
                                onChange={(e) =>
                                  handleUpdateItemField(it.id, {
                                    reason: e.target.value as ReturnReason,
                                  })
                                }
                                className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] text-slate-700"
                              >
                                {RETURN_REASONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={it.condition}
                                onChange={(e) =>
                                  handleUpdateItemField(it.id, {
                                    condition: e.target.value as
                                      | "Restockable"
                                      | "Damaged / Quarantine"
                                      | "Returned to Supplier",
                                  })
                                }
                                className={`px-2 py-1 border rounded text-[11px] font-semibold ${
                                  it.condition === "Restockable"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                              >
                                <option value="Restockable">Restockable</option>
                                <option value="Damaged / Quarantine">Damaged / Quarantine</option>
                                <option value="Returned to Supplier">Returned to Supplier</option>
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {it.unitRate.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="1"
                                value={it.quantity}
                                onChange={(e) =>
                                  handleUpdateItemQuantity(it.id, Number(e.target.value))
                                }
                                className="w-16 px-2 py-1 text-right bg-white border border-slate-200 rounded font-mono font-bold text-slate-900"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {settings.currencySymbol} {it.amount.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(it.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Remove item from return"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remark / Discrepancy Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Full invoice returned by customer or discrepancy noted on delivery."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Return Total:{" "}
                <strong className="font-mono text-sm text-slate-900">
                  {settings.currencySymbol} {totalReturnAmount.toLocaleString("en-PK")}
                </strong>
                {items.length > 0 && (
                  <span className="ml-2 text-slate-500">
                    ({items.length} items, {items.reduce((s, it) => s + it.quantity, 0)} units)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-save-return-record"
                  onClick={handleSaveReturn}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {loadedOrder && returnType === "Sale Return"
                      ? `Save Full Invoice Return (${loadedOrder.orderNumber})`
                      : loadedPurchase && returnType === "Purchase Return"
                      ? `Save Purchase Return (${loadedPurchase.purchaseNumber})`
                      : "Save Return Record"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW RETURN DETAILS */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-rose-400">
                  {selectedReturn.returnNumber}
                </span>
                <h3 className="font-bold text-base text-white">
                  Return Record — {selectedReturn.partyName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Type:</span>
                  <span className="font-bold text-slate-800">{selectedReturn.returnType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Date:</span>
                  <span className="font-mono text-slate-800">{selectedReturn.returnDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Invoice / Ref:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedReturn.referenceNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Action Taken:</span>
                  <span className="font-semibold text-rose-700">{selectedReturn.actionTaken}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3">Condition</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReturn.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {it.productName}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{it.reason}</td>
                        <td className="py-2 px-3 text-slate-500">{it.condition}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {it.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {settings.currencySymbol} {it.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedReturn.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">Remarks:</span>
                  <p className="text-slate-600">{selectedReturn.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800">
                Total Returned:{" "}
                <span className="font-mono text-rose-700">
                  {settings.currencySymbol} {selectedReturn.totalAmount.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Close
              </button>
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
