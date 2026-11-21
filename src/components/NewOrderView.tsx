import React, { useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Customer, MatchingCandidate, Product } from "../types";
import { findMatchingProducts } from "../utils/fuzzyMatch";
import { formatPakistaniRupees } from "../utils/numberToWords";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { DuplicateItemAlertModal } from "./DuplicateItemAlertModal";
import {
  Plus,
  Trash2,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  AlertTriangle,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Building2,
  HelpCircle,
  PlusSquare,
  Edit2,
  Wallet,
  CreditCard,
  Calendar,
  Clock,
  DollarSign,
  Users,
  UserPlus,
  Phone,
  MapPin,
  X,
  UserCheck,
  History,
  CheckSquare,
  Square,
  Receipt,
} from "lucide-react";

interface NewOrderViewProps {
  onOpenReview: () => void;
}

export const NewOrderView: React.FC<NewOrderViewProps> = ({ onOpenReview }) => {
  const {
    draftOrder,
    setDraftOrder,
    currentProducts,
    addItemToDraft,
    updateDraftItem,
    removeDraftItem,
    deleteMultipleDraftItems,
    resetDraftOrder,
    recalculateOrder,
    settings,
    priceListVersions,
    activeVersionId,
    addProductToMaster,
    orders,
    customers,
    saveCustomer,
    getCustomerPendingDues,
    getItemAvailableStock,
    loadPreviousInvoiceIntoNewOrder,
  } = useApp();

  const [inputQuery, setInputQuery] = useState("");
  const [inputQty, setInputQty] = useState<number | string>(1);
  const [candidates, setCandidates] = useState<MatchingCandidate[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<MatchingCandidate | null>(null);
  const [showProductNotFound, setShowProductNotFound] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomPrice, setNewCustomPrice] = useState<number | string>(0);
  const [newCustomCategory, setNewCustomCategory] = useState("General");
  const [showExtendedCustomerInfo, setShowExtendedCustomerInfo] = useState(false);
  const [isAiMatchingLoading, setIsAiMatchingLoading] = useState(false);

  // Bulk item selection state for sales order
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Duplicate item detection modal state
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    productName: string;
    productId?: string;
    rate: number;
    newQty: number;
    existingQuantity: number;
    existingLineNumber: number;
    existingItemId: string;
    category?: string;
  } | null>(null);

  // Confirmation Delete Modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    itemDescription?: string;
    confirmButtonText?: string;
  } | null>(null);

  // Clean up selected items if draft items change
  useEffect(() => {
    setSelectedItemIds((prev) => prev.filter((id) => draftOrder.items.some((it) => it.id === id)));
  }, [draftOrder.items]);

  // Track item frequency to highlight duplicates in the list
  const itemFrequencyMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    draftOrder.items.forEach((it) => {
      const key = it.productName.trim().toLowerCase();
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [draftOrder.items]);

  const hasDuplicateItemsInList = useMemo(() => {
    return Object.values(itemFrequencyMap).some((count: number) => count > 1);
  }, [itemFrequencyMap]);

  // "Select All" logic
  const isAllItemsSelected =
    draftOrder.items.length > 0 && selectedItemIds.length === draftOrder.items.length;

  const handleToggleSelectAll = () => {
    if (isAllItemsSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(draftOrder.items.map((it) => it.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Merge all duplicate rows currently in the order
  const handleMergeAllDuplicates = () => {
    const mergedMap = new Map<string, typeof draftOrder.items[0]>();
    draftOrder.items.forEach((item) => {
      const key = (item.productId || "") + "___" + item.productName.trim().toLowerCase();
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        existing.quantity += item.quantity;
        existing.bon = (existing.bon || 0) + (item.bon || 0);
        existing.amount = existing.quantity * existing.rate;
      } else {
        mergedMap.set(key, { ...item });
      }
    });
    const updatedItems = Array.from(mergedMap.values());
    setDraftOrder((prev) => recalculateOrder({ ...prev, items: updatedItems }));
    setAutoFillNotification("✓ Merged all duplicate rows into combined quantities!");
    setTimeout(() => setAutoFillNotification(null), 4000);
  };

  // Customer autocomplete & auto-fill states
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  const [autoFillNotification, setAutoFillNotification] = useState<string | null>(null);
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    name: "",
    code: "",
    city: "Sahiwal",
    address: "",
    phone: "",
    licenseNo: "",
    ntn: "",
    openingBalance: 0,
    notes: "",
  });
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);

  // Previous Invoice Quick-Sell lookup states
  const [prevInvoiceQuery, setPrevInvoiceQuery] = useState("");
  const [showPrevInvoiceDropdown, setShowPrevInvoiceDropdown] = useState(false);
  const [prevInvoiceMode, setPrevInvoiceMode] = useState<"replace" | "append">("replace");
  const [prevInvoiceLowStockWarnings, setPrevInvoiceLowStockWarnings] = useState<
    Array<{
      productName: string;
      requested: number;
      available: number;
      hasPurchaseRecord: boolean;
    }>
  >([]);
  const prevInvoiceContainerRef = useRef<HTMLDivElement>(null);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const activeVer = priceListVersions.find((v) => v.id === activeVersionId);

  const sortedPastInvoices = useMemo(() => {
    return [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders]);

  const matchingPastInvoices = useMemo(() => {
    const q = prevInvoiceQuery.trim().toLowerCase();
    if (!q) return sortedPastInvoices.slice(0, 12);
    return sortedPastInvoices
      .filter(
        (ord) =>
          ord.orderNumber.toLowerCase().includes(q) ||
          (ord.customerName || "").toLowerCase().includes(q) ||
          (ord.customerPhone || "").toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [sortedPastInvoices, prevInvoiceQuery]);

  // Close previous invoice dropdown when clicking outside
  useEffect(() => {
    const handleClickOutsidePrevInv = (e: MouseEvent) => {
      if (
        prevInvoiceContainerRef.current &&
        !prevInvoiceContainerRef.current.contains(e.target as Node)
      ) {
        setShowPrevInvoiceDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutsidePrevInv);
    return () => document.removeEventListener("mousedown", handleClickOutsidePrevInv);
  }, []);

  const handleLoadPreviousInvoice = (targetOrderNumberOrId?: string) => {
    const query = targetOrderNumberOrId || prevInvoiceQuery;
    const modeToUse = draftOrder.items.length === 0 ? "replace" : prevInvoiceMode;
    const result = loadPreviousInvoiceIntoNewOrder(query, modeToUse);
    if (!result.success || !result.sourceOrder) {
      setStockError(result.error || "Could not load previous invoice.");
      return;
    }

    setStockError(null);
    setShowPrevInvoiceDropdown(false);
    setPrevInvoiceQuery(result.sourceOrder.orderNumber);
    setShowExtendedCustomerInfo(true);
    setPrevInvoiceLowStockWarnings(result.lowStockWarnings || []);
    setAutoFillNotification(
      `✓ Loaded ${result.sourceOrder.items.length} items from ${result.sourceOrder.orderNumber} (${result.sourceOrder.customerName || "Counter Sale"}) into new order!`
    );
    setTimeout(() => setAutoFillNotification(null), 5000);
  };

  const handleAutoAdjustLoadedStock = () => {
    const adjustedItems = draftOrder.items
      .map((it) => {
        const stock = getItemAvailableStock(it.productId, it.productName, draftOrder.id);
        if (!stock.hasPurchaseRecord || stock.availableStock <= 0) {
          return null;
        }
        const maxQty = stock.availableStock;
        if (it.quantity > maxQty) {
          const disc1 = Number(it.disc1) || 0;
          const disc2 = Number(it.disc2) || 0;
          const netAmt = maxQty * (Number(it.rate) || 0) * (1 - disc1 / 100) * (1 - disc2 / 100);
          return {
            ...it,
            quantity: maxQty,
            bon: 0,
            amount: Math.round(netAmt * 100) / 100,
          };
        }
        return it;
      })
      .filter((it): it is NonNullable<typeof it> => it !== null);

    setDraftOrder((prev) => recalculateOrder({ ...prev, items: adjustedItems }));
    setPrevInvoiceLowStockWarnings([]);
    setStockError(null);
    setAutoFillNotification("✓ Quantities automatically adjusted to match available stock.");
    setTimeout(() => setAutoFillNotification(null), 4000);
  };

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node) &&
        customerInputRef.current &&
        !customerInputRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter matching customers based on input
  const matchingCustomers = useMemo(() => {
    const q = (draftOrder.customerName || "").trim().toLowerCase();
    if (!q) {
      return customers.slice(0, 8);
    }
    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const code = (c.code || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const city = (c.city || "").toLowerCase();
      const addr = (c.address || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        addr.includes(q)
      );
    });
  }, [customers, draftOrder.customerName]);

  // Apply complete customer credentials into draft order
  const applyCustomerDetails = (cust: Customer) => {
    const pending = getCustomerPendingDues(cust.name, draftOrder.id);
    setDraftOrder((prev) =>
      recalculateOrder({
        ...prev,
        customerName: cust.name,
        customerCode: cust.code || prev.customerCode || "",
        customerAddress: cust.address || prev.customerAddress || "",
        customerCity: cust.city || prev.customerCity || "Sahiwal",
        customerPhone: cust.phone || prev.customerPhone || "",
        customerLicenseNo: cust.licenseNo || prev.customerLicenseNo || "",
        customerNtn: cust.ntn || prev.customerNtn || "",
        // Do not force previousPendingAmount into the order; keep 0 unless user explicitly adds it
        previousPendingAmount: prev.previousPendingAmount || 0,
      })
    );
    setShowExtendedCustomerInfo(true);
    setShowCustomerDropdown(false);
    setAutoFillNotification(
      `✓ Customer auto-filled: ${cust.name} (${cust.city || "Sahiwal"})${
        pending > 0 ? ` — Note: Ledger has Rs. ${pending.toLocaleString("en-PK")} past dues (optional)` : ""
      }`
    );
    setTimeout(() => {
      setAutoFillNotification(null);
    }, 5000);
  };

  const openQuickAddCustomer = (initialName?: string) => {
    setQuickCustomerForm({
      name: initialName !== undefined ? initialName : draftOrder.customerName || "",
      code: `CUST-${String(customers.length + 1).padStart(3, "0")}`,
      city: draftOrder.customerCity || "Sahiwal",
      address: draftOrder.customerAddress || "",
      phone: draftOrder.customerPhone || "",
      licenseNo: draftOrder.customerLicenseNo || "",
      ntn: draftOrder.customerNtn || "",
      openingBalance: 0,
      notes: "",
    });
    setQuickCustomerError(null);
    setShowQuickAddCustomerModal(true);
  };

  const handleSaveQuickCustomer = () => {
    if (!quickCustomerForm.name.trim()) {
      setQuickCustomerError("Pharmacy / Customer Name is required.");
      return;
    }
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: quickCustomerForm.name.trim(),
      code: quickCustomerForm.code.trim() || `CUST-${String(customers.length + 1).padStart(3, "0")}`,
      city: quickCustomerForm.city.trim() || "Sahiwal",
      address: quickCustomerForm.address.trim(),
      phone: quickCustomerForm.phone.trim(),
      licenseNo: quickCustomerForm.licenseNo.trim(),
      ntn: quickCustomerForm.ntn.trim(),
      openingBalance: Number(quickCustomerForm.openingBalance) || 0,
      notes: quickCustomerForm.notes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveCustomer(newCust);
    applyCustomerDetails(newCust);
    setShowQuickAddCustomerModal(false);
    setAutoFillNotification(`✓ Customer "${newCust.name}" registered and auto-filled!`);
  };

  // Handle typing in customer name input with automatic matching
  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraftOrder((prev) => ({ ...prev, customerName: val }));
    setShowCustomerDropdown(true);
    setSelectedCustomerIndex(-1);

    // If exact name matches an existing customer, auto-populate all missing details
    const trimmed = val.trim().toLowerCase();
    if (trimmed.length >= 3) {
      const exact = customers.find((c) => c.name.toLowerCase().trim() === trimmed);
      if (exact) {
        const pending = getCustomerPendingDues(exact.name, draftOrder.id);
        setDraftOrder((prev) =>
          recalculateOrder({
            ...prev,
            customerName: exact.name,
            customerCode: exact.code || prev.customerCode || "",
            customerAddress: exact.address || prev.customerAddress || "",
            customerCity: exact.city || prev.customerCity || "Sahiwal",
            customerPhone: exact.phone || prev.customerPhone || "",
            customerLicenseNo: exact.licenseNo || prev.customerLicenseNo || "",
            customerNtn: exact.ntn || prev.customerNtn || "",
            previousPendingAmount: prev.previousPendingAmount || 0,
          })
        );
        setShowExtendedCustomerInfo(true);
        setAutoFillNotification(
          `✓ Auto-filled details for ${exact.name} (${exact.city || "Sahiwal"})${
            pending > 0 ? ` — Note: Ledger has Rs. ${pending.toLocaleString("en-PK")} past dues (optional)` : ""
          }`
        );
        setTimeout(() => setAutoFillNotification(null), 4000);
      }
    }
  };

  // Keyboard navigation for customer dropdown
  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCustomerDropdown || matchingCustomers.length === 0) {
      if (e.key === "ArrowDown") {
        setShowCustomerDropdown(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedCustomerIndex((prev) => (prev < matchingCustomers.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedCustomerIndex((prev) => (prev > 0 ? prev - 1 : matchingCustomers.length - 1));
    } else if (e.key === "Enter" && selectedCustomerIndex >= 0 && matchingCustomers[selectedCustomerIndex]) {
      e.preventDefault();
      applyCustomerDetails(matchingCustomers[selectedCustomerIndex]);
    } else if (e.key === "Escape") {
      setShowCustomerDropdown(false);
    }
  };

  // Compute previous pending dues for this customer from past orders
  const customerHistoryPending = React.useMemo(() => {
    if (!draftOrder.customerName || !draftOrder.customerName.trim()) return 0;
    const name = draftOrder.customerName.trim().toLowerCase();
    return orders
      .filter((o) => o.customerName && o.customerName.trim().toLowerCase() === name && o.id !== draftOrder.id)
      .reduce((sum, o) => {
        const p = o.pendingAmount !== undefined ? Number(o.pendingAmount) : Math.max(0, Number(o.grandTotal) - (Number(o.paidAmount) || 0));
        return sum + p;
      }, 0);
  }, [draftOrder.customerName, draftOrder.id, orders]);

  // Live fuzzy search suggestions while typing
  useEffect(() => {
    if (inputQuery.trim().length >= 2) {
      const matches = findMatchingProducts(inputQuery, currentProducts, 6);
      setCandidates(matches);
    } else {
      setCandidates([]);
    }
  }, [inputQuery, currentProducts]);

  // Handle Add Product submit
  const handleAddSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputQuery.trim();
    if (!query) {
      searchInputRef.current?.focus();
      return;
    }

    const qty = Number(inputQty) || 1;
    if (qty <= 0) {
      setStockError("Please enter a valid quantity greater than 0.");
      qtyInputRef.current?.focus();
      return;
    }

    // 1. Check local fuzzy matching candidates
    const matches = findMatchingProducts(query, currentProducts, 6);

    // If top match is 100% exact match
    if (matches.length > 0 && matches[0].score === 100) {
      requestAddItem(
        matches[0].product.name,
        matches[0].product.price,
        qty,
        matches[0].product.id,
        matches[0].product.category
      );
      return;
    }

    // If match found with high or partial score -> show confirmation popup
    if (matches.length > 0) {
      setSelectedCandidate(matches[0]);
      setCandidates(matches);
      setShowMatchModal(true);
      setShowProductNotFound(false);
      return;
    }

    // If no local match, optionally try AI match or prompt not found
    setShowProductNotFound(true);
  };

  // Central item adding handler with instant duplicate detection
  const requestAddItem = (
    productName: string,
    rate: number,
    quantity: number,
    productId?: string,
    category?: string
  ) => {
    const trimmed = productName.trim().toLowerCase();
    const existingIndex = draftOrder.items.findIndex(
      (it) =>
        (productId && it.productId === productId) ||
        it.productName.trim().toLowerCase() === trimmed
    );

    if (existingIndex !== -1) {
      const existing = draftOrder.items[existingIndex];
      setDuplicateModal({
        isOpen: true,
        productName: productName.trim(),
        productId,
        rate,
        newQty: quantity,
        existingQuantity: existing.quantity,
        existingLineNumber: existingIndex + 1,
        existingItemId: existing.id,
        category: category || "General Supplies",
      });
      return;
    }

    // Not duplicate -> add directly to draft
    const res = addItemToDraft(productName.trim(), rate, quantity, productId);
    if (!res.success) {
      setStockError(res.error || "Cannot add item to order");
    } else {
      setStockError(null);
      setInputQuery("");
      setInputQty(1);
      setCandidates([]);
      setShowMatchModal(false);
      setSelectedCandidate(null);
      searchInputRef.current?.focus();
    }
  };

  const handleMergeDuplicate = () => {
    if (!duplicateModal) return;
    const newTotal = duplicateModal.existingQuantity + duplicateModal.newQty;
    const res = updateDraftItem(duplicateModal.existingItemId, { quantity: newTotal });
    if (!res.success) {
      setStockError(res.error || "Cannot increase item quantity");
    } else {
      setStockError(null);
      setAutoFillNotification(
        `✓ Quantity for "${duplicateModal.productName}" merged to ${newTotal} units (Line #${duplicateModal.existingLineNumber})`
      );
      setTimeout(() => setAutoFillNotification(null), 4000);
      setInputQuery("");
      setInputQty(1);
      setCandidates([]);
      setShowMatchModal(false);
      setSelectedCandidate(null);
      searchInputRef.current?.focus();
    }
    setDuplicateModal(null);
  };

  const handleAddAsSeparateLine = () => {
    if (!duplicateModal) return;
    const res = addItemToDraft(
      duplicateModal.productName,
      duplicateModal.rate,
      duplicateModal.newQty,
      duplicateModal.productId
    );
    if (!res.success) {
      setStockError(res.error || "Cannot add item to order");
    } else {
      setStockError(null);
      setAutoFillNotification(`✓ Added "${duplicateModal.productName}" as separate line item`);
      setTimeout(() => setAutoFillNotification(null), 4000);
      setInputQuery("");
      setInputQty(1);
      setCandidates([]);
      setShowMatchModal(false);
      setSelectedCandidate(null);
      searchInputRef.current?.focus();
    }
    setDuplicateModal(null);
  };

  // Confirm match selection
  const confirmMatch = (candidate: MatchingCandidate) => {
    const qty = Number(inputQty) || 1;
    requestAddItem(
      candidate.product.name,
      candidate.product.price,
      qty,
      candidate.product.id,
      candidate.product.category
    );
  };

  // Create & Add New Product to Master Inventory
  const handleSaveAndAddNewProduct = () => {
    if (!newCustomName.trim()) return;
    const priceNum = Number(newCustomPrice) || 0;
    const qty = Number(inputQty) || 1;

    addProductToMaster({
      name: newCustomName.trim(),
      category: newCustomCategory.trim() || "General Supplies",
      price: priceNum,
    });

    requestAddItem(newCustomName.trim(), priceNum, qty, undefined, newCustomCategory.trim());

    setShowNewProductModal(false);
    setShowProductNotFound(false);
    setNewCustomName("");
    setNewCustomPrice(0);
  };

  return (
    <div id="new-order-view" className="max-w-7xl mx-auto space-y-5 pb-24 md:pb-12">
      {/* Auto-fill Notification Alert */}
      {autoFillNotification && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{autoFillNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoFillNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-3 text-sm px-1.5 py-0.5 rounded hover:bg-emerald-100/60 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Sell from Previous Invoice # Bar */}
      <section
        ref={prevInvoiceContainerRef}
        className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-xs space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                Sell Stock from Previous Invoice #
              </h3>
              <p className="text-[11px] text-slate-500">
                Enter or pick a previous Invoice # to auto-load all products &amp; customer info into this new sale order.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-sell-prev-invoice"
                type="text"
                autoComplete="off"
                placeholder="Type Invoice # (e.g. ORD-2026-0001) or customer..."
                value={prevInvoiceQuery}
                onFocus={() => setShowPrevInvoiceDropdown(true)}
                onChange={(e) => {
                  setPrevInvoiceQuery(e.target.value);
                  setShowPrevInvoiceDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLoadPreviousInvoice();
                  } else if (e.key === "Escape") {
                    setShowPrevInvoiceDropdown(false);
                  }
                }}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {prevInvoiceQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setPrevInvoiceQuery("");
                    setShowPrevInvoiceDropdown(true);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {showPrevInvoiceDropdown && matchingPastInvoices.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-40 max-h-64 overflow-y-auto divide-y divide-slate-100">
                  <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 sticky top-0">
                    <span>Select Previous Invoice ({matchingPastInvoices.length})</span>
                    <button
                      type="button"
                      onClick={() => setShowPrevInvoiceDropdown(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  {matchingPastInvoices.map((ord) => {
                    const pcs = ord.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                    return (
                      <button
                        key={ord.id}
                        type="button"
                        onClick={() => handleLoadPreviousInvoice(ord.orderNumber)}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {ord.orderNumber}
                            </span>
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {ord.customerName || "Counter Sale"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {ord.orderDate} &bull; {ord.items.length} products ({pcs} pcs)
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-xs font-bold text-slate-900">
                            {settings.currencySymbol} {ord.grandTotal.toLocaleString("en-PK")}
                          </div>
                          <div className="text-[10px] text-blue-600 font-semibold">
                            Sell Again &rarr;
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {draftOrder.items.length > 0 && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => setPrevInvoiceMode("replace")}
                  className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    prevInvoiceMode === "replace"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setPrevInvoiceMode("append")}
                  className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    prevInvoiceMode === "append"
                      ? "bg-white text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  + Append
                </button>
              </div>
            )}

            <button
              type="button"
              id="btn-load-prev-invoice"
              onClick={() => handleLoadPreviousInvoice()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Load Invoice</span>
            </button>
          </div>
        </div>

        {/* Stock Check Warning for Items Loaded from Previous Invoice */}
        {prevInvoiceLowStockWarnings.length > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {prevInvoiceLowStockWarnings.length} item(s) from the previous invoice exceed current available stock:
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  {prevInvoiceLowStockWarnings
                    .slice(0, 4)
                    .map(
                      (w) =>
                        `${w.productName} (Need: ${w.requested}, Avail: ${w.available})`
                    )
                    .join(" • ")}
                  {prevInvoiceLowStockWarnings.length > 4
                    ? ` +${prevInvoiceLowStockWarnings.length - 4} more`
                    : ""}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAutoAdjustLoadedStock}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer"
              >
                Auto-Adjust to Available Stock
              </button>
              <button
                type="button"
                onClick={() => setPrevInvoiceLowStockWarnings([])}
                className="p-1 text-amber-600 hover:text-amber-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Customer / Pharmacy Details Form */}
      <section id="customer-order-info-card" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Order & Customer Credentials</span>
            <span className="hidden sm:inline text-[11px] font-normal text-slate-400">
              (Auto-fills address, code, phone & pending dues on customer typing)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExtendedCustomerInfo(!showExtendedCustomerInfo)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>{showExtendedCustomerInfo ? "Hide Extra Details" : "More Customer Details"}</span>
            {showExtendedCustomerInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer / Pharmacy with Live Autocomplete */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">
                Customer / Pharmacy <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerDropdown((prev) => !prev)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                  title="Browse registered pharmacies"
                >
                  <Users className="w-3 h-3" />
                  <span>Browse ({customers.length})</span>
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => openQuickAddCustomer()}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                  title="Add new customer profile for auto-fill"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ Add Customer</span>
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                ref={customerInputRef}
                id="input-customer-name"
                type="text"
                autoComplete="off"
                placeholder="Type name (e.g. Al-Rehman, Citizen...)"
                value={draftOrder.customerName}
                onChange={handleCustomerNameChange}
                onFocus={() => setShowCustomerDropdown(true)}
                onKeyDown={handleCustomerKeyDown}
                className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
              />
              {draftOrder.customerName ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftOrder((prev) =>
                      recalculateOrder({
                        ...prev,
                        customerName: "",
                        customerCode: "",
                        customerAddress: "",
                        customerCity: "Sahiwal",
                        customerPhone: "",
                        customerLicenseNo: "",
                        customerNtn: "",
                        previousPendingAmount: 0,
                      })
                    );
                    setShowCustomerDropdown(false);
                    customerInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Clear customer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Live Autocomplete Dropdown */}
            {showCustomerDropdown && (
              <div
                ref={customerDropdownRef}
                className="absolute left-0 right-0 sm:min-w-[340px] top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto"
              >
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Registered Pharmacies (Auto-Fill)
                  </span>
                  <span className="text-slate-400">{matchingCustomers.length} available</span>
                </div>

                {matchingCustomers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    <p className="font-medium text-slate-700">No matching customer found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Type details directly — new customers are saved automatically when invoice is generated.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {matchingCustomers.map((c, idx) => {
                      const pending = getCustomerPendingDues(c.name, draftOrder.id);
                      const isSelected = idx === selectedCustomerIndex;
                      return (
                        <div
                          key={c.id || idx}
                          onClick={() => applyCustomerDetails(c)}
                          className={`p-2.5 text-left cursor-pointer transition-colors ${
                            isSelected ? "bg-blue-50/90" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {c.code && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-mono font-bold rounded">
                                  {c.code}
                                </span>
                              )}
                            </div>
                            {pending > 0 && (
                              <span className="shrink-0 px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded-full">
                                Dues: Rs. {pending.toLocaleString("en-PK")}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                            {c.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                {c.address}{c.city ? `, ${c.city}` : ""}
                              </span>
                            )}
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                {c.phone}
                              </span>
                            )}
                            {c.licenseNo && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Lic: {c.licenseNo}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-2 bg-slate-50 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomerDropdown(false);
                      openQuickAddCustomer(draftOrder.customerName);
                    }}
                    className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-center flex items-center justify-center gap-1.5 cursor-pointer text-xs transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {draftOrder.customerName && draftOrder.customerName.trim()
                        ? `+ Register "${draftOrder.customerName}" for Auto-Fill`
                        : "+ Add New Customer Profile for Auto-Fill"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Order Date</label>
            <input
              id="input-order-date"
              type="date"
              value={draftOrder.orderDate}
              onChange={(e) => setDraftOrder((prev) => ({ ...prev, orderDate: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Salesman</label>
            <input
              id="input-order-salesman"
              type="text"
              placeholder="Adnan Ahmed"
              value={draftOrder.salesman}
              onChange={(e) => setDraftOrder((prev) => ({ ...prev, salesman: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Price List Version</label>
            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium flex items-center justify-between">
              <span>{draftOrder.priceListVersion || activeVer?.versionName || "v3.2 - Oct 2023"}</span>
              <span className="text-[11px] text-slate-400">({currentProducts.length} items)</span>
            </div>
          </div>
        </div>

        {/* Extended Invoice Details (Code, Address, City, Phone, Lic/NTN, Previous Pending) */}
        {showExtendedCustomerInfo && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer Code</label>
                <input
                  id="input-customer-code"
                  type="text"
                  placeholder="e.g. CUST-019"
                  value={draftOrder.customerCode || ""}
                  onChange={(e) => setDraftOrder((prev) => ({ ...prev, customerCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer Address</label>
                <input
                  id="input-customer-address"
                  type="text"
                  placeholder="Shop / Hospital Address"
                  value={draftOrder.customerAddress || ""}
                  onChange={(e) => setDraftOrder((prev) => ({ ...prev, customerAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">City</label>
                <input
                  id="input-customer-city"
                  type="text"
                  placeholder="City (e.g. Sahiwal)"
                  value={draftOrder.customerCity || ""}
                  onChange={(e) => setDraftOrder((prev) => ({ ...prev, customerCity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phone Number</label>
                <input
                  id="input-customer-phone"
                  type="text"
                  placeholder="e.g. 0300-1234567"
                  value={draftOrder.customerPhone || ""}
                  onChange={(e) => setDraftOrder((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer Lic. # / NTN</label>
                <input
                  id="input-customer-lic-ntn"
                  type="text"
                  placeholder="Lic & NTN numbers"
                  value={draftOrder.customerLicenseNo || ""}
                  onChange={(e) => setDraftOrder((prev) => ({ ...prev, customerLicenseNo: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Previous Pending Dues Card - Only added if user enters or clicks Add */}
              <div className="sm:col-span-2 bg-amber-50/70 p-3 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="block text-[10px] uppercase font-bold text-amber-800">
                      Previous Pending Dues (PKR)
                    </label>
                    {customerHistoryPending > 0 && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-bold">
                        Past Dues: Rs. {customerHistoryPending.toLocaleString("en-PK")}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    {(draftOrder.previousPendingAmount || 0) > 0
                      ? "Added to Net Amount on invoice. Click Clear if you do not wish to include it."
                      : "Optional. Not added to invoice. Click '+ Add Past Dues' or type amount if you wish to include it."}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {customerHistoryPending > 0 && (draftOrder.previousPendingAmount || 0) === 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraftOrder((prev) =>
                          recalculateOrder({
                            ...prev,
                            previousPendingAmount: customerHistoryPending,
                          })
                        )
                      }
                      className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
                      title="Add past dues to this invoice"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Past Dues</span>
                    </button>
                  )}
                  {(draftOrder.previousPendingAmount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraftOrder((prev) =>
                          recalculateOrder({
                            ...prev,
                            previousPendingAmount: 0,
                          })
                        )
                      }
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Clear past dues from this invoice"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                  <input
                    id="input-previous-pending-amount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={draftOrder.previousPendingAmount || ""}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setDraftOrder((prev) =>
                        recalculateOrder({
                          ...prev,
                          previousPendingAmount: val,
                        })
                      );
                    }}
                    className="w-28 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-amber-950 font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* QUICK ADD & ORDER ITEMS SECTION */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Quick Add Product Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleAddSubmit} className="relative">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 md:gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] uppercase font-bold text-slate-400">
                    Quick Add Product (Type name / shorthand...)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomName(inputQuery);
                      setShowNewProductModal(true);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    + Add New to Master List
                  </button>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    id="input-product-name"
                    type="text"
                    placeholder="e.g. Certeza strip, B braun cannula, Sufra tule..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    autoComplete="off"
                  />
                </div>

                {/* Live Search Quick Candidate Dropdown */}
                {candidates.length > 0 && !showMatchModal && (
                  <div
                    id="dropdown-quick-matches"
                    className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100"
                  >
                    <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-400 flex justify-between">
                      <span>Suggested Master Matches:</span>
                      <span>Stock & Rate (PKR)</span>
                    </div>
                    {candidates.map((cand) => {
                      const stockInfo = getItemAvailableStock(cand.product.id, cand.product.name);
                      return (
                        <button
                          key={cand.product.id}
                          type="button"
                          onClick={() => {
                            setSelectedCandidate(cand);
                            setShowMatchModal(true);
                          }}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50/60 flex items-center justify-between transition-colors text-xs sm:text-sm cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-semibold text-slate-800 group-hover:text-blue-600 truncate">
                              {cand.product.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                              {cand.product.category}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                stockInfo.availableStock > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {stockInfo.availableStock > 0
                                ? `Avail: ${stockInfo.availableStock}`
                                : stockInfo.hasPurchaseRecord
                                ? "Out of Stock (0)"
                                : "No Purchase Record"}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-blue-600 shrink-0 ml-2">
                            Rs. {cand.product.price.toLocaleString("en-PK")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quantity Input */}
              <div className="w-full sm:w-28">
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Qty</label>
                <input
                  ref={qtyInputRef}
                  id="input-product-qty"
                  type="number"
                  min="1"
                  step="1"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  className="w-full px-3 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 text-center font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Add Button */}
              <button
                type="submit"
                id="btn-add-product-submit"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shrink-0 shadow-lg shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ ADD ITEM</span>
              </button>
            </div>
          </form>

          {/* Real-time Stock Validation Error Banner */}
          {stockError && (
            <div
              id="banner-stock-error"
              className="mt-3 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-2 text-xs text-rose-800 animate-fadeIn font-semibold"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{stockError}</span>
              </div>
              <button
                type="button"
                onClick={() => setStockError(null)}
                className="text-rose-500 hover:text-rose-700 px-2 py-0.5 font-bold cursor-pointer"
                title="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Product Not Found Banner */}
          {showProductNotFound && (
            <div
              id="banner-product-not-found"
              className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 animate-fadeIn"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Product <strong>"{inputQuery}"</strong> could not be matched with high confidence in the master list.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setNewCustomName(inputQuery);
                    setShowNewProductModal(true);
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-xs transition-colors cursor-pointer"
                >
                  + Add As New Product
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductNotFound(false)}
                  className="px-2 py-1 text-slate-500 hover:text-slate-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DUPLICATE WARNING BANNER (IF ANY DUPLICATES EXIST IN CURRENT ORDER) */}
        {hasDuplicateItemsInList && (
          <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Warning:</strong> One or more duplicate / double items were detected in your order list (highlighted below).
              </span>
            </div>
            <button
              type="button"
              onClick={handleMergeAllDuplicates}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-lg text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title="Automatically combine duplicate items and sum their quantities"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Merge All Duplicate Rows</span>
            </button>
          </div>
        )}

        {/* BULK SELECTION ACTION TOOLBAR */}
        {draftOrder.items.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={isAllItemsSelected}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>Select All Items ({draftOrder.items.length})</span>
              </label>

              {selectedItemIds.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">
                  {selectedItemIds.length} of {draftOrder.items.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedItemIds.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds([])}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 rounded font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteModal({
                        isOpen: true,
                        title: "Delete Selected Items",
                        message: `Are you sure you want to remove the ${selectedItemIds.length} selected items from this order?`,
                        confirmButtonText: `Delete ${selectedItemIds.length} Items`,
                        onConfirm: () => {
                          deleteMultipleDraftItems(selectedItemIds);
                          setAutoFillNotification(`✓ Removed ${selectedItemIds.length} items from order.`);
                          setTimeout(() => setAutoFillNotification(null), 3000);
                          setSelectedItemIds([]);
                          setConfirmDeleteModal(null);
                        },
                      });
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedItemIds.length})</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium cursor-pointer"
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        )}

        {/* ORDER ITEMS TABLE */}
        <div className="flex-1 overflow-x-auto p-0 min-h-[220px]">
          {draftOrder.items.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="text-slate-600 font-semibold text-sm">No items added to order yet.</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Type product name above or click "Load 27-Item Sample Test" in the header to instantly verify the complete order.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-white z-10 border-b border-slate-200">
                <tr className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  <th className="px-3 py-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllItemsSelected}
                      onChange={handleToggleSelectAll}
                      title="Select All Items"
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-4 w-12 text-center">#</th>
                  <th className="px-6 py-4">Item Description</th>
                  <th className="px-6 py-4 w-32 text-right">Available Stock</th>
                  <th className="px-6 py-4 w-28 text-right">Qty</th>
                  <th className="px-6 py-4 w-36 text-right">Rate</th>
                  <th className="px-6 py-4 w-36 text-right">Amount</th>
                  <th className="px-6 py-4 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {draftOrder.items.map((item, index) => {
                  const stockInfo = getItemAvailableStock(item.productId, item.productName);
                  const isExceedingStock =
                    !stockInfo.hasPurchaseRecord || item.quantity > stockInfo.availableStock;
                  const isDuplicateItem = (itemFrequencyMap[item.productName.trim().toLowerCase()] || 0) > 1;
                  const isRowSelected = selectedItemIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isRowSelected
                          ? "bg-blue-50/50"
                          : isDuplicateItem
                          ? "bg-amber-50/40"
                          : isExceedingStock
                          ? "bg-rose-50/40"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => handleToggleSelectItem(item.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          aria-label={`Select ${item.productName}`}
                        />
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-400 text-center">
                        {String(index + 1).padStart(2, "0")}
                      </td>

                      <td className="px-6 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{item.productName}</span>
                          {isDuplicateItem && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              Duplicate Item (ڈپلیکیٹ)
                            </span>
                          )}
                        </div>
                        {isExceedingStock && (
                          <div className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            {!stockInfo.hasPurchaseRecord
                              ? "No purchase record exists. Cannot sell."
                              : `Insufficient stock. Available: ${stockInfo.availableStock}`}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-3 text-right font-mono">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-xs ${
                            stockInfo.availableStock > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {stockInfo.availableStock}
                        </span>
                      </td>

                      <td className="px-6 py-3 text-right">
                        <input
                          type="number"
                          min="1"
                          max={stockInfo.availableStock > 0 ? stockInfo.availableStock : undefined}
                          step="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = Number(e.target.value) || 1;
                            const res = updateDraftItem(item.id, { quantity: newQty });
                            if (!res.success) {
                              setStockError(res.error || "Insufficient stock.");
                            } else {
                              setStockError(null);
                            }
                          }}
                          className={`w-20 px-2 py-1 border rounded text-right font-semibold focus:outline-none bg-white ${
                            isExceedingStock
                              ? "border-rose-400 text-rose-700 focus:border-rose-500 ring-1 ring-rose-200"
                              : "border-slate-200 text-slate-800 focus:border-blue-500"
                          }`}
                        />
                      </td>

                      <td className="px-6 py-3 text-right text-slate-500 font-mono">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-slate-400">Rs.</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) =>
                              updateDraftItem(item.id, { rate: Number(e.target.value) || 0 })
                            }
                            className="w-24 px-2 py-1 border border-slate-200 rounded text-right font-mono text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
                          />
                        </div>
                      </td>

                      <td className="px-6 py-3 text-right font-bold font-mono text-slate-900">
                        Rs. {item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-6 py-3 text-center">
                        <button
                          type="button"
                          id={`btn-remove-item-${index + 1}`}
                          onClick={() => {
                            setConfirmDeleteModal({
                              isOpen: true,
                              title: "Remove Item",
                              message: `Remove "${item.productName}" from this order?`,
                              confirmButtonText: "Remove Item",
                              itemDescription: `${item.quantity} units @ Rs. ${item.rate}`,
                              onConfirm: () => {
                                removeDraftItem(item.id);
                                setStockError(null);
                                setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
                                setConfirmDeleteModal(null);
                              },
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                          title={`Delete ${item.productName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* CALCULATIONS & SETTLEMENT SECTION */}
      <section className="flex flex-col lg:flex-row justify-between items-stretch gap-4 shrink-0">
        {/* Left Side: Amount in Words & Notes */}
        <div className="flex-1 bg-blue-50/40 rounded-xl p-4 border border-blue-100 flex flex-col justify-between space-y-3">
          <div>
            <label className="block text-[10px] uppercase font-bold text-blue-600 mb-1">
              Amount in Words
            </label>
            <p className="text-sm italic text-blue-950 font-serif font-medium leading-relaxed">
              {draftOrder.grandTotalInWords || "Rupee Zero Only"}
            </p>
          </div>

          <div className="pt-2 border-t border-blue-100/80">
            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
              Order Notes / Delivery Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Urgent counter delivery, verified stock batch."
              value={draftOrder.notes || ""}
              onChange={(e) => setDraftOrder((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Middle: Payment & Pending Settlement Controls */}
        <div className="w-full lg:w-[410px] bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              <span>Payment & Settlement Status</span>
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                (draftOrder.pendingAmount || 0) === 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : (draftOrder.paidAmount || 0) > 0
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {draftOrder.paymentStatus || "Paid"}
            </span>
          </div>

          {/* Payment Status Switcher */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() =>
                setDraftOrder((prev) => ({
                  ...prev,
                  paymentStatus: "Paid",
                  paidAmount: prev.grandTotal,
                  pendingAmount: 0,
                }))
              }
              className={`py-1 rounded text-center transition-colors cursor-pointer text-xs ${
                draftOrder.paymentStatus === "Paid" || (!draftOrder.paymentStatus && (draftOrder.pendingAmount || 0) === 0)
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Paid (Full)
            </button>
            <button
              type="button"
              onClick={() =>
                setDraftOrder((prev) => {
                  const half = Math.round(prev.grandTotal / 2);
                  return {
                    ...prev,
                    paymentStatus: "Partial",
                    paidAmount: half,
                    pendingAmount: Math.max(0, prev.grandTotal - half),
                  };
                })
              }
              className={`py-1 rounded text-center transition-colors cursor-pointer text-xs ${
                draftOrder.paymentStatus === "Partial"
                  ? "bg-amber-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Partial
            </button>
            <button
              type="button"
              onClick={() =>
                setDraftOrder((prev) => ({
                  ...prev,
                  paymentStatus: "Unpaid",
                  paidAmount: 0,
                  pendingAmount: prev.grandTotal,
                }))
              }
              className={`py-1 rounded text-center transition-colors cursor-pointer text-xs ${
                draftOrder.paymentStatus === "Unpaid"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending / Unpaid
            </button>
          </div>

          {/* DUAL EDITABLE INPUTS: Paid Amount & Pending Amount */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Paid Amount Input */}
            <div className="bg-emerald-50/40 p-2 rounded-lg border border-emerald-100/80">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold text-emerald-800">
                  Paid Amount (PKR)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraftOrder((prev) => ({
                      ...prev,
                      paidAmount: prev.grandTotal,
                      pendingAmount: 0,
                      paymentStatus: "Paid",
                    }))
                  }
                  className="text-[9px] text-emerald-700 hover:underline font-semibold"
                >
                  Set Full
                </button>
              </div>
              <input
                type="number"
                min="0"
                max={draftOrder.grandTotal}
                step="any"
                value={
                  draftOrder.paidAmount !== undefined
                    ? draftOrder.paidAmount
                    : draftOrder.grandTotal
                }
                onChange={(e) => {
                  const paid = Math.max(0, Math.min(draftOrder.grandTotal, Number(e.target.value) || 0));
                  const pending = Math.max(0, draftOrder.grandTotal - paid);
                  const status = pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
                  setDraftOrder((prev) => ({
                    ...prev,
                    paidAmount: paid,
                    pendingAmount: pending,
                    paymentStatus: status,
                  }));
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-md text-emerald-950 font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>

            {/* Pending Amount Input - FULLY EDITABLE */}
            <div className="bg-rose-50/40 p-2 rounded-lg border border-rose-100/80">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-bold text-rose-800">
                  Pending Amount (PKR)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraftOrder((prev) => ({
                      ...prev,
                      pendingAmount: prev.grandTotal,
                      paidAmount: 0,
                      paymentStatus: "Unpaid",
                    }))
                  }
                  className="text-[9px] text-rose-700 hover:underline font-semibold"
                >
                  Set Full
                </button>
              </div>
              <input
                type="number"
                min="0"
                max={draftOrder.grandTotal}
                step="any"
                value={
                  draftOrder.pendingAmount !== undefined
                    ? draftOrder.pendingAmount
                    : Math.max(0, draftOrder.grandTotal - (draftOrder.paidAmount ?? draftOrder.grandTotal))
                }
                onChange={(e) => {
                  const pending = Math.max(0, Math.min(draftOrder.grandTotal, Number(e.target.value) || 0));
                  const paid = Math.max(0, draftOrder.grandTotal - pending);
                  const status = pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
                  setDraftOrder((prev) => ({
                    ...prev,
                    pendingAmount: pending,
                    paidAmount: paid,
                    paymentStatus: status,
                  }));
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-md text-rose-950 font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Payment Method & Due Date Row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Payment Method
              </label>
              <select
                value={draftOrder.paymentMethod || "Cash"}
                onChange={(e) =>
                  setDraftOrder((prev) => ({
                    ...prev,
                    paymentMethod: e.target.value as any,
                  }))
                }
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-medium text-xs bg-slate-50 focus:bg-white outline-none cursor-pointer"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit / Pay Later">Credit / Pay Later</option>
                <option value="Online / Card">Online / Card</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                value={draftOrder.dueDate || ""}
                onChange={(e) => setDraftOrder((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-slate-800 font-medium text-xs bg-slate-50 focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Payment Notes / Cheque Ref */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Payment Reference / Cheque No. (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Cheque #78423 or Bank IBFT ref"
              value={draftOrder.paymentNotes || ""}
              onChange={(e) => setDraftOrder((prev) => ({ ...prev, paymentNotes: e.target.value }))}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Right Side: Financial Breakdown */}
        <div className="w-full lg:w-72 space-y-2 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Subtotal ({draftOrder.items.length} items)</span>
            <span className="font-semibold text-slate-800 font-mono">
              Rs. {draftOrder.subtotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Discount (Rs.)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draftOrder.discount || 0}
              onChange={(e) => {
                const disc = Number(e.target.value) || 0;
                setDraftOrder((prev) => recalculateOrder({ ...prev, discount: disc }));
              }}
              className="w-24 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs text-red-500 font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
            <span className="text-slate-500">Sales Tax (Rs.)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draftOrder.tax || 0}
              onChange={(e) => {
                const tax = Number(e.target.value) || 0;
                setDraftOrder((prev) => recalculateOrder({ ...prev, tax }));
              }}
              className="w-24 px-2 py-0.5 border border-slate-200 rounded text-right font-mono text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          {(draftOrder.previousPendingAmount || 0) > 0 && (
            <div className="flex justify-between items-center text-xs text-amber-800 font-semibold">
              <span>+ Previous Pending:</span>
              <span className="font-mono">
                Rs. {(draftOrder.previousPendingAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-slate-100">
            <span className="text-xs font-bold uppercase text-slate-800">Net Amount</span>
            <span className="text-base font-black font-mono text-blue-700">
              Rs. {draftOrder.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </span>
          </div>

          {(draftOrder.pendingAmount || 0) > 0 && (
            <>
              <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Paid / Received:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  Rs. {(draftOrder.paidAmount !== undefined ? draftOrder.paidAmount : draftOrder.grandTotal).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-700 font-bold">Pending Balance:</span>
                <span className="font-mono font-bold text-rose-600 font-black">
                  Rs. {(draftOrder.pendingAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ACTION BUTTONS BAR */}
      <div className="flex flex-wrap gap-3 justify-end shrink-0 mb-4 pt-1">
        <button
          type="button"
          id="btn-reset-order"
          onClick={() => {
            if (draftOrder.items.length === 0) {
              resetDraftOrder();
              setPrevInvoiceQuery("");
              setPrevInvoiceLowStockWarnings([]);
              return;
            }
            setConfirmDeleteModal({
              isOpen: true,
              title: "Clear Order Draft",
              message: `Are you sure you want to clear this draft order? All ${draftOrder.items.length} items will be removed.`,
              confirmButtonText: "Yes, Clear Draft",
              onConfirm: () => {
                resetDraftOrder();
                setSelectedItemIds([]);
                setPrevInvoiceQuery("");
                setPrevInvoiceLowStockWarnings([]);
                setAutoFillNotification("✓ Order draft has been cleared.");
                setTimeout(() => setAutoFillNotification(null), 3000);
                setConfirmDeleteModal(null);
              },
            });
          }}
          className="px-6 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
        >
          RESET DRAFT
        </button>

        <button
          type="button"
          id="btn-review-and-pdf"
          disabled={draftOrder.items.length === 0}
          onClick={onOpenReview}
          className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
            draftOrder.items.length > 0
              ? "bg-green-600 hover:bg-green-700 text-white shadow-green-500/20 active:scale-95"
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
          }`}
        >
          <FileCheck className="w-5 h-5" />
          <span>GENERATE INVOICE PDF</span>
        </button>
      </div>

      {/* SMART PRODUCT MATCHING MODAL */}
      {showMatchModal && selectedCandidate && (() => {
        const candStock = getItemAvailableStock(selectedCandidate.product.id, selectedCandidate.product.name);
        const requestedQty = Number(inputQty) || 1;
        const noPurchase = !candStock.hasPurchaseRecord;
        const zeroStock = candStock.availableStock === 0;
        const insufficient = requestedQty > candStock.availableStock;
        const isStockBlocked = noPurchase || zeroStock || insufficient;

        return (
          <div
            id="smart-match-confirmation-modal"
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 animate-scaleUp">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Confirm Master Product Match</h3>
                    <p className="text-xs text-slate-400">Inventory matching algorithm</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                  {selectedCandidate.score}% match
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 uppercase font-bold">You typed</span>
                  <span className="font-medium text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-xs">
                    "{inputQuery}"
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-xs text-slate-400 uppercase font-bold">Matched Item</span>
                  <span className="font-bold text-slate-900 text-sm text-right">{selectedCandidate.product.name}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 uppercase font-bold">Category</span>
                  <span className="text-xs text-slate-600">{selectedCandidate.product.category}</span>
                </div>

                {/* Real-time Available Stock Details */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-xs text-slate-400 uppercase font-bold">Available Stock</span>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-500">Purchased: {candStock.totalPurchased}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Sold: {candStock.totalSold}</span>
                    <span className="text-slate-300">|</span>
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        candStock.availableStock > 0
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      Avail: {candStock.availableStock}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 uppercase font-bold">Master Rate</span>
                  <span className="font-mono font-bold text-blue-600 text-base">
                    Rs. {selectedCandidate.product.price.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 uppercase font-bold">Requested Quantity</span>
                  <span className="font-bold text-slate-800">{inputQty}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase">Calculated Amount</span>
                  <span className="font-mono font-bold text-slate-900">
                    Rs. {((Number(inputQty) || 1) * selectedCandidate.product.price).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Stock Warning Message if Blocked */}
              {isStockBlocked && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Stock Validation: </span>
                    {noPurchase && (
                      <span>Cannot sell this item. No purchase record exists in the system. Items can only be sold if previously purchased.</span>
                    )}
                    {!noPurchase && zeroStock && (
                      <span>Out of stock (Available: 0). Sale is blocked until more stock is purchased.</span>
                    )}
                    {!noPurchase && !zeroStock && insufficient && (
                      <span>Insufficient stock. Available quantity: <strong>{candStock.availableStock}</strong>. You entered: <strong>{requestedQty}</strong>.</span>
                    )}
                  </div>
                </div>
              )}

              {/* Other candidates list if available */}
              {candidates.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase text-slate-400">Other Possible Matches:</span>
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-1.5 divide-y divide-slate-100">
                    {candidates
                      .filter((c) => c.product.id !== selectedCandidate.product.id)
                      .map((c) => {
                        const otherStock = getItemAvailableStock(c.product.id, c.product.name);
                        return (
                          <button
                            key={c.product.id}
                            type="button"
                            onClick={() => setSelectedCandidate(c)}
                            className="w-full text-left py-1.5 px-2 hover:bg-slate-100 rounded flex items-center justify-between text-xs cursor-pointer group"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-medium text-slate-800 group-hover:text-blue-600 truncate">{c.product.name}</span>
                              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${otherStock.availableStock > 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                                Avail: {otherStock.availableStock}
                              </span>
                            </div>
                            <span className="font-mono text-slate-600 font-semibold shrink-0 ml-2">
                              Rs. {c.product.price.toLocaleString("en-PK")}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowMatchModal(false);
                    setSelectedCandidate(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isStockBlocked}
                  onClick={() => confirmMatch(selectedCandidate)}
                  className={`px-5 py-2 text-sm font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                    isStockBlocked
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Add</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* QUICK ADD NEW PRODUCT MODAL */}
      {showNewProductModal && (
        <div
          id="modal-add-new-product"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add New Product to Master Inventory</h3>
              <button
                onClick={() => setShowNewProductModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={newCustomName}
                  onChange={(e) => setNewCustomName(e.target.value)}
                  placeholder="e.g. Insulin Syringe 0.5cc"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-medium text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Category</label>
                <input
                  type="text"
                  value={newCustomCategory}
                  onChange={(e) => setNewCustomCategory(e.target.value)}
                  placeholder="e.g. Syringes & Needles"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Unit Price / Rate (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newCustomPrice}
                  onChange={(e) => setNewCustomPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-bold font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewProductModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAndAddNewProduct}
                className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm cursor-pointer"
              >
                Save & Add to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {showQuickAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Customer for Auto-Fill</h3>
                  <p className="text-xs text-slate-500">
                    Saves customer profile permanently and auto-fills credentials into this order.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddCustomerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickCustomerError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{quickCustomerError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Pharmacy / Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Al-Rehman Pharmacy & Surgical"
                    value={quickCustomerForm.name}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Customer Code
                  </label>
                  <input
                    type="text"
                    placeholder="CUST-045"
                    value={quickCustomerForm.code}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Sahiwal"
                    value={quickCustomerForm.city}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Street Address / Market
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main High Street, Grain Market"
                    value={quickCustomerForm.address}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">Phone #</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={quickCustomerForm.phone}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Drug License #
                  </label>
                  <input
                    type="text"
                    placeholder="02-119-0982-S"
                    value={quickCustomerForm.licenseNo}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, licenseNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">NTN Number</label>
                  <input
                    type="text"
                    placeholder="4198234-7"
                    value={quickCustomerForm.ntn}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, ntn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-amber-800 mb-1">
                    Opening Dues (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={quickCustomerForm.openingBalance || ""}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, openingBalance: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">Notes / Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. 15 days credit"
                    value={quickCustomerForm.notes}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAddCustomerModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickCustomer}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Save & Auto-Fill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE ITEM ALERT MODAL */}
      {duplicateModal && (
        <DuplicateItemAlertModal
          isOpen={duplicateModal.isOpen}
          productName={duplicateModal.productName}
          category={duplicateModal.category}
          existingQuantity={duplicateModal.existingQuantity}
          newQuantity={duplicateModal.newQty}
          existingLineNumber={duplicateModal.existingLineNumber}
          rate={duplicateModal.rate}
          currencySymbol={settings.currencySymbol}
          onMergeQuantity={handleMergeDuplicate}
          onAddAsSeparate={handleAddAsSeparateLine}
          onCancel={() => setDuplicateModal(null)}
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
