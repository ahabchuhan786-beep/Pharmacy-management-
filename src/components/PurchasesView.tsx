import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { PurchaseOrder, PurchaseItem } from "../types";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { DuplicateItemAlertModal } from "./DuplicateItemAlertModal";
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Truck,
  DollarSign,
  Package,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  X,
  ArrowDownRight,
  Filter,
  AlertTriangle,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { findMatchingProducts } from "../utils/fuzzyMatch";

export const PurchasesView: React.FC = () => {
  const {
    purchases,
    savePurchase,
    deletePurchase,
    deleteMultiplePurchases,
    generateNextPurchaseNumber,
    currentProducts,
    settings,
    returns,
    setActiveNavTab,
    setPreselectedReturnPurchaseRef,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Selection states
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [selectedModalItemIds, setSelectedModalItemIds] = useState<string[]>([]);

  // Duplicate item alert modal state for purchase creation
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    productName: string;
    productId?: string;
    costRate: number;
    newQty: number;
    newBon: number;
    newDisc: number;
    existingQuantity: number;
    existingLineNumber: number;
    existingItemId: string;
    category?: string;
    batch?: string;
    exp?: string;
    salePrice?: number;
  } | null>(null);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // New Purchase Form State
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Credit" | "Partial">("Paid");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank Transfer" | "Cheque" | "Credit">("Cash");
  const [notes, setNotes] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);

  // Item input row state
  const [productInput, setProductInput] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [category, setCategory] = useState("General Supplies");
  const [batch, setBatch] = useState("");
  const [exp, setExp] = useState("");
  const [costRate, setCostRate] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [bon, setBon] = useState<number>(0);
  const [discPercent, setDiscPercent] = useState<number>(0);

  // Suggestions for product name
  const [productSuggestions, setProductSuggestions] = useState<Array<{ name: string; price: number; id: string; category: string }>>([]);

  const handleProductInputChange = (val: string) => {
    setProductInput(val);
    setFormError(null);
    const normVal = val.toLowerCase().replace(/\s+/g, " ").trim();
    const exactMatch = currentProducts.find(
      (p) => p.name.toLowerCase().replace(/\s+/g, " ").trim() === normVal
    );
    if (exactMatch) {
      setSelectedProductId(exactMatch.id);
      setCategory(exactMatch.category || "General Supplies");
      setSalePrice(exactMatch.price);
      const cost = exactMatch.costPrice !== undefined ? exactMatch.costPrice : Math.round(exactMatch.price * 0.78);
      if (!costRate) setCostRate(cost);
    } else {
      setSelectedProductId("");
    }

    if (val.trim().length >= 1) {
      const matches = findMatchingProducts(val, currentProducts, 10);
      setProductSuggestions(
        matches.map((m) => ({
          name: m.product.name,
          price: m.product.price,
          id: m.product.id,
          category: m.product.category,
        }))
      );
    } else {
      setProductSuggestions([]);
    }
  };

  const handleSelectProduct = (prod: { name: string; price: number; id: string; category: string }) => {
    setProductInput(prod.name);
    setSelectedProductId(prod.id);
    setCategory(prod.category);
    setSalePrice(prod.price);
    // Use the product's configured purchase rate from master inventory
    const matched = currentProducts.find(
      (p) => p.id === prod.id || p.name.toLowerCase().replace(/\s+/g, " ").trim() === prod.name.toLowerCase().replace(/\s+/g, " ").trim()
    );
    const cost = matched?.costPrice !== undefined ? matched.costPrice : Math.round(prod.price * 0.78);
    setCostRate(cost);
    setProductSuggestions([]);
    setFormError(null);
  };

  const resetItemRow = () => {
    setProductInput("");
    setSelectedProductId("");
    setCategory("General Supplies");
    setBatch("");
    setExp("");
    setCostRate(0);
    setSalePrice(0);
    setQuantity(1);
    setBon(0);
    setDiscPercent(0);
    setProductSuggestions([]);
  };

  const handleAddItem = () => {
    if (!productInput.trim()) {
      setFormError("Please enter a product name before clicking Add.");
      return;
    }
    setFormError(null);
    const numQty = Number(quantity) || 1;
    const numCost = Number(costRate) || 0;
    const numDisc = Number(discPercent) || 0;
    const numBon = Number(bon) || 0;
    const gross = numQty * numCost;
    const discountVal = (gross * numDisc) / 100;
    const netAmount = Math.max(0, gross - discountVal);

    // Duplicate detection check
    const trimmed = productInput.trim().toLowerCase();
    const existingIndex = purchaseItems.findIndex(
      (it) =>
        (selectedProductId && it.productId === selectedProductId) ||
        it.productName.trim().toLowerCase() === trimmed
    );

    if (existingIndex !== -1) {
      const existing = purchaseItems[existingIndex];
      setDuplicateModal({
        isOpen: true,
        productName: productInput.trim(),
        productId: selectedProductId,
        costRate: numCost,
        newQty: numQty,
        newBon: numBon,
        newDisc: numDisc,
        existingQuantity: existing.quantity,
        existingLineNumber: existingIndex + 1,
        existingItemId: existing.id,
        category: category || "General Supplies",
        batch: batch.trim(),
        exp: exp.trim(),
        salePrice: Number(salePrice) || numCost,
      });
      return;
    }

    const newItem: PurchaseItem = {
      id: `pitm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: selectedProductId || `prod-custom-${Date.now()}`,
      productName: productInput.trim(),
      category: category || "General Supplies",
      batch: batch.trim(),
      exp: exp.trim(),
      costRate: numCost,
      salePrice: Number(salePrice) || numCost,
      quantity: numQty,
      bon: numBon,
      discPercent: numDisc,
      taxPercent: 0,
      amount: netAmount,
    };

    setPurchaseItems([...purchaseItems, newItem]);
    resetItemRow();
  };

  const handleMergeDuplicatePurchaseItem = () => {
    if (!duplicateModal) return;
    setPurchaseItems((prev) =>
      prev.map((item) => {
        if (item.id === duplicateModal.existingItemId) {
          const updatedQty = item.quantity + duplicateModal.newQty;
          const updatedBon = (item.bon || 0) + duplicateModal.newBon;
          const gross = updatedQty * item.costRate;
          const discountVal = (gross * item.discPercent) / 100;
          return {
            ...item,
            quantity: updatedQty,
            bon: updatedBon,
            amount: Math.max(0, gross - discountVal),
          };
        }
        return item;
      })
    );
    setNotification(
      `✓ Merged quantity for "${duplicateModal.productName}" (Line #${duplicateModal.existingLineNumber})`
    );
    setTimeout(() => setNotification(null), 3500);
    resetItemRow();
    setDuplicateModal(null);
  };

  const handleAddAsSeparatePurchaseItem = () => {
    if (!duplicateModal) return;
    const gross = duplicateModal.newQty * duplicateModal.costRate;
    const discountVal = (gross * duplicateModal.newDisc) / 100;
    const netAmount = Math.max(0, gross - discountVal);

    const newItem: PurchaseItem = {
      id: `pitm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: duplicateModal.productId || `prod-custom-${Date.now()}`,
      productName: duplicateModal.productName,
      category: duplicateModal.category || "General Supplies",
      batch: duplicateModal.batch || "",
      exp: duplicateModal.exp || "",
      costRate: duplicateModal.costRate,
      salePrice: duplicateModal.salePrice || duplicateModal.costRate,
      quantity: duplicateModal.newQty,
      bon: duplicateModal.newBon,
      discPercent: duplicateModal.newDisc,
      taxPercent: 0,
      amount: netAmount,
    };

    setPurchaseItems((prev) => [...prev, newItem]);
    setNotification(`✓ Added "${duplicateModal.productName}" as separate line`);
    setTimeout(() => setNotification(null), 3500);
    resetItemRow();
    setDuplicateModal(null);
  };

  const handleRemoveItem = (id: string) => {
    setPurchaseItems(purchaseItems.filter((it) => it.id !== id));
    setSelectedModalItemIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  // Duplicate detection in modal list items
  const modalItemFrequency = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    purchaseItems.forEach((it) => {
      const key = it.productName.trim().toLowerCase();
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [purchaseItems]);

  const hasDuplicateItemsInPurchaseModal = useMemo(() => {
    return Object.values(modalItemFrequency).some((cnt: number) => cnt > 1);
  }, [modalItemFrequency]);

  // Bulk actions for Purchase Modal items
  const isAllModalItemsSelected =
    purchaseItems.length > 0 && selectedModalItemIds.length === purchaseItems.length;

  const handleToggleSelectAllModalItems = () => {
    if (isAllModalItemsSelected) {
      setSelectedModalItemIds([]);
    } else {
      setSelectedModalItemIds(purchaseItems.map((it) => it.id));
    }
  };

  const handleToggleSelectModalItem = (id: string) => {
    setSelectedModalItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedModalItems = () => {
    if (selectedModalItemIds.length === 0) return;
    setPurchaseItems((prev) => prev.filter((it) => !selectedModalItemIds.includes(it.id)));
    setSelectedModalItemIds([]);
  };

  // Summary calculations for new purchase
  const totalPurchaseAmount = purchaseItems.reduce((sum, it) => sum + it.amount, 0);
  const totalUnits = purchaseItems.reduce((sum, it) => sum + it.quantity + (it.bon || 0), 0);

  const handleSavePurchase = () => {
    setFormError(null);
    if (!supplierName.trim()) {
      setFormError("Please enter Supplier / Distributor name.");
      return;
    }

    let itemsToSave = [...purchaseItems];
    // Auto-include any filled-in pending item row so users don't lose an item if they click Save without clicking + Add
    if (productInput.trim()) {
      const numQty = Number(quantity) || 1;
      const numCost = Number(costRate) || 0;
      const numDisc = Number(discPercent) || 0;
      const numBon = Number(bon) || 0;
      const gross = numQty * numCost;
      const netAmount = Math.max(0, gross - (gross * numDisc) / 100);
      const pendingNorm = productInput.trim().toLowerCase().replace(/\s+/g, " ");
      const existingMatch = currentProducts.find(
        (p) =>
          (selectedProductId && p.id === selectedProductId) ||
          p.name.toLowerCase().replace(/\s+/g, " ").trim() === pendingNorm
      );
      itemsToSave.push({
        id: `pitm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: existingMatch?.id || selectedProductId || `prod-custom-${Date.now()}`,
        productName: existingMatch?.name || productInput.trim(),
        category: category || existingMatch?.category || "General Supplies",
        batch: batch.trim(),
        exp: exp.trim(),
        costRate: numCost,
        salePrice: Number(salePrice) || existingMatch?.price || (numCost > 0 ? Math.round(numCost / 0.78) : 0),
        quantity: numQty,
        bon: numBon,
        discPercent: numDisc,
        taxPercent: 0,
        amount: netAmount,
      });
    }

    if (itemsToSave.length === 0) {
      setFormError("Please add at least one stock item to this purchase order.");
      return;
    }

    const finalTotalAmount = itemsToSave.reduce((sum, it) => sum + it.amount, 0);
    const finalTotalUnits = itemsToSave.reduce((sum, it) => sum + it.quantity + (it.bon || 0), 0);
    const purNumber = generateNextPurchaseNumber();

    const newPurchase: PurchaseOrder = {
      id: `pur-${Date.now()}`,
      purchaseNumber: purNumber,
      supplierInvoiceNo: supplierInvoiceNo.trim() || `BILL-${Date.now().toString().slice(-4)}`,
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone.trim(),
      supplierAddress: supplierAddress.trim(),
      purchaseDate,
      paymentStatus,
      paymentMethod,
      items: itemsToSave,
      subtotal: finalTotalAmount,
      discount: 0,
      tax: 0,
      grandTotal: finalTotalAmount,
      notes: notes.trim(),
      receivedBy: settings.defaultSalesman || "ADNAN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    savePurchase(newPurchase);
    setIsCreateModalOpen(false);
    setFormError(null);

    // Reset form
    setSupplierName("");
    setSupplierInvoiceNo("");
    setSupplierPhone("");
    setSupplierAddress("");
    setNotes("");
    setPurchaseItems([]);
    resetItemRow();

    setNotification(
      `✓ Purchase ${purNumber} saved! ${itemsToSave.length} item(s) (+${finalTotalUnits} units) added to Stock.`
    );
    setTimeout(() => setNotification(null), 5000);
  };

  // Filtered Purchases list
  const filteredPurchases = purchases.filter((pur) => {
    const matchesSearch =
      pur.purchaseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pur.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pur.supplierInvoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pur.items.some((it) => it.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || pur.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Selection logic for main purchases
  const isAllPurchasesSelected =
    filteredPurchases.length > 0 && selectedPurchaseIds.length === filteredPurchases.length;

  const handleToggleSelectAllPurchases = () => {
    if (isAllPurchasesSelected) {
      setSelectedPurchaseIds([]);
    } else {
      setSelectedPurchaseIds(filteredPurchases.map((p) => p.id));
    }
  };

  const handleToggleSelectPurchase = (id: string) => {
    setSelectedPurchaseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelectedPurchases = () => {
    if (selectedPurchaseIds.length === 0) return;
    setConfirmDeleteModal({
      isOpen: true,
      title: "Delete Selected Purchases",
      message: `Are you sure you want to permanently delete these ${selectedPurchaseIds.length} purchase record(s)? This will adjust inventory stock levels accordingly.`,
      confirmButtonText: `Delete ${selectedPurchaseIds.length} Purchases`,
      onConfirm: () => {
        deleteMultiplePurchases(selectedPurchaseIds);
        setNotification(`✓ Successfully deleted ${selectedPurchaseIds.length} purchase record(s).`);
        setTimeout(() => setNotification(null), 3500);
        setSelectedPurchaseIds([]);
        setConfirmDeleteModal(null);
      },
    });
  };

  // Overall Statistics
  const totalPurchasesSpend = purchases.reduce((sum, p) => sum + p.grandTotal, 0);
  const totalPurchasedItemsCount = purchases.reduce(
    (sum, p) => sum + p.items.reduce((s, it) => s + it.quantity + (it.bon || 0), 0),
    0
  );
  const uniqueSuppliers = new Set(purchases.map((p) => p.supplierName)).size;
  const pendingCredit = purchases
    .filter((p) => p.paymentStatus === "Credit")
    .reduce((sum, p) => sum + p.grandTotal, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification Alert */}
      {notification && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Purchases & Supplier Inward Bills
              </h2>
              <p className="text-sm text-slate-500">
                Log stock intake, supplier invoices, cost rates, batch numbers, and stock replenishment.
              </p>
            </div>
          </div>
        </div>

        <button
          id="btn-open-new-purchase"
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Purchase</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Purchase Spend
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {settings.currencySymbol} {totalPurchasesSpend.toLocaleString()}
          </p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Across {purchases.length} supplier orders
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Units Inward
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {totalPurchasedItemsCount.toLocaleString()} units
          </p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Including bonus & scheme stock
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Suppliers
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {uniqueSuppliers} Companies
          </p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Verified pharmaceutical distributors
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Credit Payable
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">
            {settings.currencySymbol} {pendingCredit.toLocaleString()}
          </p>
          <span className="text-xs text-slate-500 mt-1 inline-block">
            Payables to suppliers on credit
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-purchases"
            type="text"
            placeholder="Search by supplier, invoice #, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            id="select-purchase-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Credit">Credit</option>
            <option value="Partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Purchases List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Bulk Selection Bar for Purchases */}
        {filteredPurchases.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={isAllPurchasesSelected}
                  onChange={handleToggleSelectAllPurchases}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>Select All Purchases ({filteredPurchases.length})</span>
              </label>

              {selectedPurchaseIds.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[11px]">
                  {selectedPurchaseIds.length} of {filteredPurchases.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedPurchaseIds.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedPurchaseIds([])}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-800 rounded font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelectedPurchases}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected Purchases ({selectedPurchaseIds.length})</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleSelectAllPurchases}
                  className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium cursor-pointer"
                >
                  Select All
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPurchasesSelected}
                    onChange={handleToggleSelectAllPurchases}
                    title="Select All Purchases"
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Purchase / Bill #</th>
                <th className="py-3.5 px-4">Supplier & Contact</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Items Count</th>
                <th className="py-3.5 px-4">Status & Method</th>
                <th className="py-3.5 px-4 text-right">Grand Total</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-base font-semibold text-slate-600">No purchase records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "New Stock Purchase" above to add your first supplier bill.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => {
                  const itemCount = purchase.items.length;
                  const totalUnitsInBill = purchase.items.reduce(
                    (s, it) => s + it.quantity + (it.bon || 0),
                    0
                  );
                  const isSelected = selectedPurchaseIds.includes(purchase.id);

                  const existingReturn = returns.find((r) => {
                    if (r.returnType !== "Purchase Return") return false;
                    const ref = r.referenceNumber.trim().toLowerCase();
                    const purNo = purchase.purchaseNumber.trim().toLowerCase();
                    const supInv = (purchase.supplierInvoiceNo || "").trim().toLowerCase();
                    return (
                      ref === purNo ||
                      ref.includes(purNo) ||
                      (supInv !== "" && supInv !== "-" && (ref === supInv || ref.includes(supInv)))
                    );
                  });

                  return (
                    <tr
                      key={purchase.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectPurchase(purchase.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          aria-label={`Select purchase ${purchase.purchaseNumber}`}
                        />
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{purchase.purchaseNumber}</span>
                          {existingReturn && (
                            <span
                              title={`Returned via ${existingReturn.returnNumber}`}
                              className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200"
                            >
                              Returned
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-sans">
                          Inv: {purchase.supplierInvoiceNo}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{purchase.supplierName}</div>
                        <div className="text-xs text-slate-400">
                          {purchase.supplierPhone || "No contact"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        {purchase.purchaseDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800">{itemCount} items</span>
                        <div className="text-xs text-slate-400">{totalUnitsInBill} units inward</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md ${
                              purchase.paymentStatus === "Paid"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : purchase.paymentStatus === "Credit"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {purchase.paymentStatus === "Paid" && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {purchase.paymentStatus}
                          </span>
                          <span className="text-[11px] text-slate-400">{purchase.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 font-mono">
                        {settings.currencySymbol} {purchase.grandTotal.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            id={`btn-view-purchase-${purchase.id}`}
                            onClick={() => setSelectedPurchase(purchase)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Purchase Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-return-purchase-${purchase.id}`}
                            onClick={() => {
                              setPreselectedReturnPurchaseRef(purchase.purchaseNumber);
                              setActiveNavTab("returns");
                            }}
                            className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                            title="Return Purchase by Invoice #"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-purchase-${purchase.id}`}
                            onClick={() => {
                              setConfirmDeleteModal({
                                isOpen: true,
                                title: "Delete Purchase Record",
                                message: `Are you sure you want to permanently delete purchase order ${purchase.purchaseNumber} from supplier "${purchase.supplierName}"?`,
                                itemDescription: `Bill: ${purchase.supplierInvoiceNo} | Total: ${settings.currencySymbol} ${purchase.grandTotal.toLocaleString()}`,
                                confirmButtonText: "Yes, Delete Purchase",
                                onConfirm: () => {
                                  deletePurchase(purchase.id);
                                  setSelectedPurchaseIds((prev) => prev.filter((id) => id !== purchase.id));
                                  setNotification(`✓ Purchase order ${purchase.purchaseNumber} has been deleted.`);
                                  setTimeout(() => setNotification(null), 3000);
                                  setConfirmDeleteModal(null);
                                },
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
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

      {/* CREATE NEW PURCHASE ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-base text-white">
                    Record New Stock Purchase & Supplier Bill
                  </h3>
                  <p className="text-xs text-slate-300">
                    Add inward stock, batch info, cost rates, and distributor details.
                  </p>
                </div>
              </div>
              <button
                id="btn-close-new-purchase-modal"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="p-0.5 hover:bg-rose-100 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Supplier & Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier / Distributor *
                  </label>
                  <input
                    id="input-supplier-name"
                    type="text"
                    placeholder="e.g. Certeza Health Direct"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier Invoice / Bill #
                  </label>
                  <input
                    id="input-supplier-invoice-no"
                    type="text"
                    placeholder="e.g. INV-98214"
                    value={supplierInvoiceNo}
                    onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Date
                  </label>
                  <input
                    id="input-purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    id="select-payment-status"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Credit">Credit (Payable)</option>
                    <option value="Partial">Partial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier Phone
                  </label>
                  <input
                    id="input-supplier-phone"
                    type="text"
                    placeholder="040-4221190"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    id="select-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier Address / City
                  </label>
                  <input
                    id="input-supplier-address"
                    type="text"
                    placeholder="e.g. Industrial Area, Lahore"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Inward Items Entry Section */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    Inward Stock Items
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {purchaseItems.length} items added
                  </span>
                </div>

                {/* Add Item Row Inputs */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                    <div className="sm:col-span-2 relative">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Product Name (Search from Price List or Type) *
                      </label>
                      <input
                        id="input-purchase-item-name"
                        type="text"
                        placeholder="Type product name (e.g. Certeza Strip, Syringe 5cc)..."
                        value={productInput}
                        onChange={(e) => handleProductInputChange(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      {productSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                          {productSuggestions.map((prod) => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleSelectProduct(prod)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                            >
                              <span className="font-semibold text-slate-800">{prod.name}</span>
                              <span className="text-slate-500 font-mono">
                                Retail: Rs. {prod.price}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Category
                      </label>
                      <input
                        id="input-purchase-item-category"
                        type="text"
                        placeholder="e.g. Diagnostic Strips"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-8 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Batch #
                      </label>
                      <input
                        id="input-purchase-item-batch"
                        type="text"
                        placeholder="B-101"
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Exp Date
                      </label>
                      <input
                        id="input-purchase-item-exp"
                        type="text"
                        placeholder="MM/YY"
                        value={exp}
                        onChange={(e) => setExp(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Quantity *
                      </label>
                      <input
                        id="input-purchase-item-qty"
                        type="number"
                        min="1"
                        value={quantity || ""}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Bonus Qty
                      </label>
                      <input
                        id="input-purchase-item-bon"
                        type="number"
                        min="0"
                        value={bon}
                        onChange={(e) => setBon(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Cost Rate *
                      </label>
                      <input
                        id="input-purchase-item-cost"
                        type="number"
                        min="0"
                        value={costRate || ""}
                        onChange={(e) => setCostRate(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Sale Rate
                      </label>
                      <input
                        id="input-purchase-item-sale"
                        type="number"
                        min="0"
                        placeholder="Auto"
                        value={salePrice || ""}
                        onChange={(e) => setSalePrice(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Disc %
                      </label>
                      <input
                        id="input-purchase-item-disc"
                        type="number"
                        min="0"
                        max="100"
                        value={discPercent || ""}
                        onChange={(e) => setDiscPercent(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        id="btn-add-purchase-item-row"
                        type="button"
                        onClick={handleAddItem}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </div>
                  {productInput.trim() && !selectedProductId && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-medium">
                      New product &ldquo;{productInput.trim()}&rdquo; will be automatically added to Stock &amp; Price List on save.
                    </div>
                  )}
                </div>

                {/* Items Added Table */}
                {purchaseItems.length > 0 && (
                  <div className="space-y-2">
                    {/* Duplicate warning inside modal */}
                    {hasDuplicateItemsInPurchaseModal && (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-900 animate-fadeIn">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Note:</strong> Duplicate items detected in this purchase list (highlighted below).
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bulk Actions Bar for Modal Items */}
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={isAllModalItemsSelected}
                            onChange={handleToggleSelectAllModalItems}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>Select All Items ({purchaseItems.length})</span>
                        </label>
                        {selectedModalItemIds.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                            {selectedModalItemIds.length} selected
                          </span>
                        )}
                      </div>

                      {selectedModalItemIds.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedModalItemIds([])}
                            className="px-2 py-0.5 text-slate-500 hover:text-slate-800 rounded text-xs cursor-pointer"
                          >
                            Deselect
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteSelectedModalItems}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold rounded text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Selected ({selectedModalItemIds.length})</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600 font-semibold uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-2.5 w-8 text-center">
                              <input
                                type="checkbox"
                                checked={isAllModalItemsSelected}
                                onChange={handleToggleSelectAllModalItems}
                                title="Select All Items"
                                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                            </th>
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3">Batch & Exp</th>
                            <th className="py-2 px-3 text-right">Cost Rate</th>
                            <th className="py-2 px-3 text-right">Qty (+Bon)</th>
                            <th className="py-2 px-3 text-right">Disc %</th>
                            <th className="py-2 px-3 text-right">Net Amount</th>
                            <th className="py-2 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchaseItems.map((item) => {
                            const isDuplicate = (modalItemFrequency[item.productName.trim().toLowerCase()] || 0) > 1;
                            const isSelected = selectedModalItemIds.includes(item.id);
                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-slate-50 ${
                                  isSelected
                                    ? "bg-blue-50/60"
                                    : isDuplicate
                                    ? "bg-amber-50/50"
                                    : ""
                                }`}
                              >
                                <td className="py-2 px-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectModalItem(item.id)}
                                    className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>{item.productName}</span>
                                    {isDuplicate && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-bold">
                                        Duplicate
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {item.category}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-mono">
                                  {item.batch || "-"} / {item.exp || "-"}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  Rs. {item.costRate.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-slate-900 font-mono">
                                  {item.quantity} {item.bon ? `(+${item.bon})` : ""}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">{item.discPercent}%</td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                                  Rs. {item.amount.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title={`Remove ${item.productName}`}
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
                  </div>
                )}
              </div>

              {/* Purchase Notes & Bill Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Order Remarks / Inward Verification Notes
                  </label>
                  <textarea
                    id="input-purchase-notes"
                    rows={3}
                    placeholder="e.g. Received intact, verified against distributor challan."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Inward Units:</span>
                    <span className="font-mono font-bold text-slate-900">{totalUnits} units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Cost:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      Rs. {totalPurchaseAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-blue-200/80 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-blue-700">
                      Rs. {totalPurchaseAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                id="btn-cancel-purchase"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                id="btn-save-purchase"
                type="button"
                onClick={handleSavePurchase}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Save & Update Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PURCHASE BREAKDOWN MODAL */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-blue-400">
                  {selectedPurchase.purchaseNumber}
                </span>
                <h3 className="font-bold text-base text-white">
                  Supplier Bill — {selectedPurchase.supplierName}
                </h3>
              </div>
              <button
                id="btn-close-view-purchase-modal"
                onClick={() => setSelectedPurchase(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block">Supplier Invoice:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {selectedPurchase.supplierInvoiceNo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Date:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {selectedPurchase.purchaseDate}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Status:</span>
                  <span className="font-semibold text-emerald-700">
                    {selectedPurchase.paymentStatus} ({selectedPurchase.paymentMethod})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Received By:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedPurchase.receivedBy || "ADNAN"}
                  </span>
                </div>
              </div>

              {/* Items in this bill */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Batch & Expiry</th>
                      <th className="py-2.5 px-3 text-right">Cost Rate</th>
                      <th className="py-2.5 px-3 text-right">Qty (+Bonus)</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPurchase.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {it.productName}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {it.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono">
                          {it.batch || "-"} / {it.exp || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          Rs. {it.costRate.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold font-mono">
                          {it.quantity} {it.bon ? `(+${it.bon} bon)` : ""}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                          Rs. {it.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right text-slate-600">
                        Grand Total:
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700 font-mono text-sm">
                        Rs. {selectedPurchase.grandTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedPurchase.notes && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700 block mb-1">Notes / Remarks:</span>
                  <p className="text-slate-600">{selectedPurchase.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedPurchase(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg"
              >
                Close View
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
          rate={duplicateModal.costRate}
          currencySymbol={settings.currencySymbol}
          onMergeQuantity={handleMergeDuplicatePurchaseItem}
          onAddAsSeparate={handleAddAsSeparatePurchaseItem}
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
