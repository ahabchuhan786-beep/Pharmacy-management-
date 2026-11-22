import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Product } from "../types";
import { ImportPriceListModal } from "./ImportPriceListModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { StockAdjustmentModal } from "./StockAdjustmentModal";
import * as XLSX from "xlsx";
import {
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  Calendar,
  Sparkles,
  Tag,
  RefreshCw,
  SlidersHorizontal,
  FileText,
  Clock,
  Printer,
  Eye,
  Ban,
  DollarSign,
} from "lucide-react";
import { ProductHistoryModal } from "./ProductHistoryModal";
import {
  generateInventoryPriceListPdf,
  downloadPdfSafely,
  downloadBinaryBase64Safely,
} from "../utils/pdfGenerator";
import { InventoryPdfModal } from "./InventoryPdfModal";
import { AdjustPurchaseRateModal } from "./AdjustPurchaseRateModal";

export const PriceListView: React.FC = () => {
  const {
    priceListVersions,
    activeVersionId,
    setActiveVersionId,
    currentProducts,
    addProductToMaster,
    updateProductInMaster,
    deleteProductFromMaster,
    resetToDefaultCatalog,
    getItemAvailableStock,
    zeroOutItemStock,
    setActiveNavTab,
    purchases,
    orders,
    returns,
    stockAdjustments,
    getStockSummaries,
    settings,
    generateProductCode,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in-stock" | "low-out" | "adjusted">("all");
  const [sortOption, setSortOption] = useState<
    | "name-asc"
    | "name-desc"
    | "price-asc"
    | "price-desc"
    | "cost-asc"
    | "cost-desc"
    | "margin-desc"
    | "stock-desc"
    | "stock-asc"
  >("name-asc");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
  const [productForHistory, setProductForHistory] = useState<Product | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showInventoryPdfModal, setShowInventoryPdfModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Dedicated Purchase Rate Adjustment modal state
  const [showAdjustPurchaseRateModal, setShowAdjustPurchaseRateModal] = useState(false);
  const [productForPurchaseRate, setProductForPurchaseRate] = useState<Product | null>(null);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // New Product Modal Form State
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("General Supplies");
  const [newPrice, setNewPrice] = useState<number | string>(0);
  const [newCostPrice, setNewCostPrice] = useState<number | string>(0);
  const [newCode, setNewCode] = useState("");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState<number | string>(0);
  const [editCostPrice, setEditCostPrice] = useState<number | string>(0);
  const [editCode, setEditCode] = useState("");

  const activeVer = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];

  // Distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    currentProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [currentProducts]);

  // Inventory KPI metrics (Total products, stock units, cost valuation, retail valuation, projected gross profit)
  const inventoryStats = useMemo(() => {
    let totalStockUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;

    currentProducts.forEach((p) => {
      const stock = getItemAvailableStock(p.id, p.name);
      const units = stock.availableStock || 0;
      const cost = p.costPrice !== undefined ? p.costPrice : Math.round(p.price * 0.78);
      totalStockUnits += units;
      totalCostVal += units * cost;
      totalRetailVal += units * p.price;
    });

    const potentialProfit = Math.max(0, totalRetailVal - totalCostVal);
    const avgMarginPct = totalRetailVal > 0 ? (potentialProfit / totalRetailVal) * 100 : 0;

    return {
      totalProducts: currentProducts.length,
      totalStockUnits,
      totalCostVal: Math.round(totalCostVal),
      totalRetailVal: Math.round(totalRetailVal),
      potentialProfit: Math.round(potentialProfit),
      avgMarginPct,
    };
  }, [currentProducts, purchases, orders, returns, stockAdjustments]);

  // Filtered & Sorted Products
  const displayedProducts = useMemo(() => {
    let list = [...currentProducts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.productCode && p.productCode.toLowerCase().includes(q)) ||
          (p.category && typeof p.category === "string" && p.category.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (stockFilter !== "all") {
      list = list.filter((p) => {
        const st = getItemAvailableStock(p.id, p.name);
        if (stockFilter === "in-stock") return st.availableStock > 0;
        if (stockFilter === "low-out") return st.availableStock < 10;
        if (stockFilter === "adjusted") return st.totalAdjustedIncrease > 0 || st.totalAdjustedDecrease > 0;
        return true;
      });
    }

    list.sort((a, b) => {
      const costA = a.costPrice !== undefined ? a.costPrice : Math.round(a.price * 0.78);
      const costB = b.costPrice !== undefined ? b.costPrice : Math.round(b.price * 0.78);
      const marginA = a.price - costA;
      const marginB = b.price - costB;

      if (sortOption === "name-asc") return a.name.localeCompare(b.name);
      if (sortOption === "name-desc") return b.name.localeCompare(a.name);
      if (sortOption === "price-asc") return a.price - b.price;
      if (sortOption === "price-desc") return b.price - a.price;
      if (sortOption === "cost-asc") return costA - costB;
      if (sortOption === "cost-desc") return costB - costA;
      if (sortOption === "margin-desc") return marginB - marginA;
      if (sortOption === "stock-desc") {
        return getItemAvailableStock(b.id, b.name).availableStock - getItemAvailableStock(a.id, a.name).availableStock;
      }
      if (sortOption === "stock-asc") {
        return getItemAvailableStock(a.id, a.name).availableStock - getItemAvailableStock(b.id, b.name).availableStock;
      }
      return 0;
    });

    return list;
  }, [currentProducts, searchQuery, selectedCategory, stockFilter, sortOption, purchases, orders, returns, stockAdjustments]);

  const handleStartEdit = (prod: Product) => {
    setEditingId(prod.id);
    setEditName(prod.name);
    setEditCategory(prod.category);
    setEditPrice(prod.price);
    const currentCost = prod.costPrice !== undefined ? prod.costPrice : Math.round(prod.price * 0.78);
    setEditCostPrice(currentCost);
    setEditCode(prod.productCode || "");
  };

  const handleSaveEdit = (prodId: string) => {
    if (!editName.trim()) return;
    updateProductInMaster(prodId, {
      name: editName.trim(),
      category: editCategory.trim() || "General Supplies",
      price: Number(editPrice) || 0,
      costPrice: Number(editCostPrice) >= 0 ? Number(editCostPrice) : undefined,
      productCode: editCode.trim() || undefined,
    });
    setEditingId(null);
  };

  const handleSavePurchaseRate = (productId: string, newCostPrice: number, newSalePrice?: number) => {
    const updates: Partial<Product> = {
      costPrice: newCostPrice,
    };
    if (newSalePrice !== undefined && newSalePrice > 0) {
      updates.price = newSalePrice;
    }
    updateProductInMaster(productId, updates);
  };

  const handleOpenAddProduct = () => {
    setNewName("");
    setNewPrice(0);
    setNewCostPrice(0);
    const cat = "General Supplies";
    setNewCategory(cat);
    setNewCode(generateProductCode(cat));
    setShowAddProductModal(true);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const assignedCode = newCode.trim() || generateProductCode(newCategory);
    const saleNum = Number(newPrice) || 0;
    const costNum = Number(newCostPrice) >= 0 && newCostPrice !== "" 
      ? Number(newCostPrice) 
      : Math.round(saleNum * 0.78);

    addProductToMaster({
      name: newName.trim(),
      category: newCategory.trim() || "General Supplies",
      price: saleNum,
      costPrice: costNum,
      productCode: assignedCode,
    });

    setNewName("");
    setNewPrice(0);
    setNewCostPrice(0);
    setNewCode("");
    setShowAddProductModal(false);
  };

  const handleExportExcel = async () => {
    const exportData = currentProducts.map((p, idx) => {
      const stock = getItemAvailableStock(p.id, p.name);
      const cost = p.costPrice !== undefined ? p.costPrice : Math.round(p.price * 0.78);
      const unitProfit = p.price - cost;
      const marginPct = p.price > 0 ? ((unitProfit / p.price) * 100).toFixed(1) + "%" : "0%";
      return {
        "#": idx + 1,
        "Product Name": p.name,
        Category: p.category,
        "Product Code": p.productCode || "",
        "Purchase Rate (PKR)": cost,
        "Master Sale Rate (PKR)": p.price,
        "Unit Profit (PKR)": unitProfit,
        "Margin (%)": marginPct,
        "Purchased Qty": stock.totalPurchased,
        "Sold Qty": stock.totalSold,
        "Adjusted (+/-)": stock.netAdjusted,
        "Available Stock": stock.availableStock,
        Status: stock.status,
        "Inventory Cost Value (PKR)": stock.availableStock * cost,
        "Inventory Retail Value (PKR)": stock.availableStock * p.price,
        "Price List Version": p.sourcePriceListVersion,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Price List");
    const vName = (activeVer?.versionName || "Inventory").replace(/\s+/g, "_");
    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    await downloadBinaryBase64Safely(base64, `${vName}_Inventory_with_Purchase_Rates.xlsx`);
  };

  const handleExportPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const stockSummaries = getStockSummaries();
      const doc = generateInventoryPriceListPdf(currentProducts, activeVer, settings, stockSummaries);
      const pName = (settings?.pharmacyName || "PharmaFlow").replace(/\s+/g, "_");
      const vName = (activeVer?.versionName || "Catalog").replace(/\s+/g, "_");
      const fileName = `${pName}_Inventory_Catalog_${vName}.pdf`;
      const success = await downloadPdfSafely(doc, fileName);
      if (!success) {
        // If download is unavailable, open the preview modal
        setShowInventoryPdfModal(true);
      }
    } catch (err) {
      console.error("Failed to generate Inventory PDF:", err);
      // Fallback: open full preview modal
      setShowInventoryPdfModal(true);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div id="price-list-view" className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-12">
      {/* Top Banner & Version Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              Master Pharmacy Inventory Price List
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              {currentProducts.length} Products
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative source for order rates. Historical orders retain their original rates even when price lists change.
          </p>
        </div>

        {/* Version Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Price List Version Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <Layers className="w-4 h-4 text-slate-500 ml-1.5 shrink-0" />
            <select
              id="select-price-list-version"
              value={activeVersionId}
              onChange={(e) => setActiveVersionId(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 pr-2 py-1 outline-none cursor-pointer"
            >
              {priceListVersions.map((ver) => (
                <option key={ver.id} value={ver.id}>
                  {ver.versionName} ({ver.itemCount} items) {ver.isCurrent ? "★ Active" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-open-import-modal"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Import PDF / Excel</span>
          </button>

          <button
            id="btn-export-inventory-pdf"
            onClick={handleExportPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
            title="Download authoritative Master Inventory & Price List PDF Catalog"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? "Generating..." : "Download PDF"}</span>
          </button>

          <button
            id="btn-preview-inventory-pdf"
            onClick={() => setShowInventoryPdfModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg shadow-2xs transition-all cursor-pointer"
            title="Preview & Print Master Inventory Catalog in A4"
          >
            <Printer className="w-4 h-4 text-rose-600" />
            <span>Print / Preview PDF</span>
          </button>

          <button
            id="btn-open-add-product"
            onClick={handleOpenAddProduct}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product</span>
          </button>

          <button
            id="btn-open-adjust-stock"
            onClick={() => {
              setProductToAdjust(null);
              setShowAdjustmentModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
            title="Adjust inventory stock (Increase or Decrease)"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>+ Adjust Stock (+/-)</span>
          </button>

          <button
            id="btn-view-all-adjustments"
            onClick={() => setActiveNavTab("stock-adjustments")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
            title="View complete stock adjustment audit history"
          >
            <span>Audit History ({stockAdjustments.length})</span>
          </button>

          <button
            id="btn-reset-seed-catalog"
            onClick={() => {
              setConfirmDeleteModal({
                isOpen: true,
                title: "Reset Master Price List",
                message: "Are you sure you want to reset the price list to the baseline 91-item catalog? This will restore original master prices.",
                confirmButtonText: "Yes, Reset Catalog",
                onConfirm: () => {
                  resetToDefaultCatalog();
                  setConfirmDeleteModal(null);
                },
              });
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors cursor-pointer"
            title="Reset Master Price List to Seed 91 items"
          >
            <RefreshCw className="w-3.5 h-3.5 text-red-600" />
            <span>Reset Seed Catalog</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Export Price List to Excel"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Version Details Card */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-semibold text-slate-500 uppercase text-[10px]">Effective Date: </span>
            <span className="font-mono font-medium text-slate-800">{activeVer.effectiveDate}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase text-[10px]">Source: </span>
            <span className="font-medium text-slate-800">{activeVer.sourceFileName || "System Seed Catalog"}</span>
          </div>
          {activeVer.notes && (
            <div className="hidden sm:block">
              <span className="font-semibold text-slate-500 uppercase text-[10px]">Notes: </span>
              <span>{activeVer.notes}</span>
            </div>
          )}
        </div>
        <div className="text-[11px] text-blue-600 font-semibold font-mono">
          Ver: {activeVer.id}
        </div>
      </div>

      {/* Inventory Financial & Valuation Summary Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Catalog Items / Stock</span>
            <span className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
              {inventoryStats.totalProducts} Items
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
            {inventoryStats.totalStockUnits.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-500">Units in Stock</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Authoritative catalog items</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-semibold">
            <span>Stock Cost (Purchase Value)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              Cost
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-800 mt-1">
            Rs. {inventoryStats.totalCostVal.toLocaleString("en-PK")}
          </div>
          <span className="text-[10px] text-emerald-700/80 block mt-0.5">Total capital invested at cost rates</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
          <div className="flex items-center justify-between text-blue-800 text-[11px] font-semibold">
            <span>Stock Retail (Sale Value)</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
              Retail
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-blue-800 mt-1">
            Rs. {inventoryStats.totalRetailVal.toLocaleString("en-PK")}
          </div>
          <span className="text-[10px] text-blue-700/80 block mt-0.5">Expected return at master retail prices</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Gross Inventory Profit</span>
            <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
              {inventoryStats.avgMarginPct.toFixed(1)}% Margin
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
            Rs. {inventoryStats.potentialProfit.toLocaleString("en-PK")}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Potential profit in available stock</span>
        </div>
      </div>

      {/* Search, Filter & Sort Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="w-full md:w-80 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by product name, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="w-full md:w-auto flex flex-wrap items-center gap-2 text-xs">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">All Stock Status</option>
              <option value="in-stock">In Stock Only (&gt; 0)</option>
              <option value="low-out">Low / Out of Stock (&lt; 10)</option>
              <option value="adjusted">Has Adjustments (+/-)</option>
            </select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="stock-desc">Sort: Available Stock (High &rarr; Low)</option>
              <option value="stock-asc">Sort: Available Stock (Low &rarr; High)</option>
              <option value="price-asc">Sort: Sale Price (Low &rarr; High)</option>
              <option value="price-desc">Sort: Sale Price (High &rarr; Low)</option>
              <option value="cost-asc">Sort: Purchase Rate (Low &rarr; High)</option>
              <option value="cost-desc">Sort: Purchase Rate (High &rarr; Low)</option>
              <option value="margin-desc">Sort: Margin Profit (High &rarr; Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm divide-y divide-slate-100">
            <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">#</th>
                <th className="py-3.5 px-4 min-w-[170px]">Product Name</th>
                <th className="py-3.5 px-3 w-32">Category</th>
                <th className="py-3.5 px-2.5 w-24 font-mono text-center">Code</th>
                <th className="py-3.5 px-3 w-32 text-right bg-emerald-50/70 text-emerald-900 border-x border-emerald-100/80">
                  <div className="flex items-center justify-end gap-1">
                    <span>Purchase Rate</span>
                  </div>
                </th>
                <th className="py-3.5 px-3 w-28 text-right bg-blue-50/40 text-blue-900 border-r border-blue-100/60">
                  <div className="flex items-center justify-end gap-1">
                    <span>Master Rate</span>
                  </div>
                </th>
                <th className="py-3.5 px-2.5 w-24 text-right">Margin / Profit</th>
                <th className="py-3.5 px-2.5 w-20 text-right">Purchased</th>
                <th className="py-3.5 px-2 w-16 text-right">Sold</th>
                <th className="py-3.5 px-2 w-20 text-right">Adjusted</th>
                <th className="py-3.5 px-2.5 w-20 text-right">Available</th>
                <th className="py-3.5 px-2.5 w-24 text-center">Status</th>
                <th className="py-3.5 px-3 w-36 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
              {displayedProducts.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-10 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                displayedProducts.map((prod, index) => {
                  const isEditing = editingId === prod.id;
                  const stock = getItemAvailableStock(prod.id, prod.name);
                  const costPrice = prod.costPrice !== undefined ? prod.costPrice : Math.round(prod.price * 0.78);
                  const profit = prod.price - costPrice;
                  const marginPct = prod.price > 0 ? (profit / prod.price) * 100 : 0;

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isEditing ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-xs font-mono text-slate-400">
                        {index + 1}
                      </td>

                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 border border-blue-500 rounded text-xs sm:text-sm font-semibold"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setProductForHistory(prod);
                              setShowHistoryModal(true);
                            }}
                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left cursor-pointer transition-colors block"
                            title={`Click to view movement history (Purchases, Sales, Returns) for ${prod.name}`}
                          >
                            {prod.name}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                          />
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs">
                            {prod.category}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center text-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className="w-20 px-1 py-1 border border-slate-200 rounded text-xs font-mono text-center"
                          />
                        ) : (
                          <span className="font-mono font-bold text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                            {prod.productCode || `PRD-${String(index + 1).padStart(3, "0")}`}
                          </span>
                        )}
                      </td>

                      {/* Purchase Rate (Cost) */}
                      <td className="py-3 px-3 text-right bg-emerald-50/30 border-x border-emerald-100/60">
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editCostPrice}
                              onChange={(e) => setEditCostPrice(e.target.value)}
                              className="w-24 px-2 py-1 border border-emerald-500 rounded text-right font-mono text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Cost Rate"
                              title="Edit purchase rate"
                            />
                            <span className="text-[9px] text-emerald-600 font-mono">Cost Rate</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 group">
                            <button
                              type="button"
                              onClick={() => {
                                setProductForPurchaseRate(prod);
                                setShowAdjustPurchaseRateModal(true);
                              }}
                              className="font-mono font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer transition-colors"
                              title={`Click to adjust purchase rate for ${prod.name}`}
                            >
                              Rs. {costPrice.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProductForPurchaseRate(prod);
                                setShowAdjustPurchaseRateModal(true);
                              }}
                              className="opacity-60 group-hover:opacity-100 p-1 hover:bg-emerald-100 text-emerald-700 rounded transition-all cursor-pointer"
                              title={`Adjust purchase rate for ${prod.name}`}
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Master Sale Rate */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 bg-blue-50/10 border-r border-blue-100/40">
                        {isEditing ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-24 px-2 py-1 border border-blue-500 rounded text-right font-mono text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Sale Rate"
                            />
                            <span className="text-[9px] text-blue-600 font-mono">Sale Rate</span>
                          </div>
                        ) : (
                          `Rs. ${prod.price.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`
                        )}
                      </td>

                      {/* Margin / Profit */}
                      <td className="py-3 px-2.5 text-right font-mono">
                        <div className="flex flex-col items-end">
                          <span className={`text-xs font-bold ${profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {profit >= 0 ? "+" : ""}Rs. {Math.round(profit).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            ({marginPct.toFixed(1)}%)
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono font-semibold text-emerald-700">
                        {stock.totalPurchased}
                      </td>

                      <td className="py-3 px-2 text-right font-mono font-semibold text-blue-700">
                        {stock.totalSold}
                      </td>

                      <td className="py-3 px-2 text-right font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setProductToAdjust(prod);
                            setShowAdjustmentModal(true);
                          }}
                          className="hover:underline cursor-pointer"
                          title={`Increase: +${stock.totalAdjustedIncrease} | Decrease: -${stock.totalAdjustedDecrease} (Click to adjust)`}
                        >
                          {stock.netAdjusted > 0 ? (
                            <span className="font-bold text-emerald-700">+{stock.netAdjusted}</span>
                          ) : stock.netAdjusted < 0 ? (
                            <span className="font-bold text-rose-600">{stock.netAdjusted}</span>
                          ) : stock.totalAdjustedIncrease > 0 || stock.totalAdjustedDecrease > 0 ? (
                            <span className="font-semibold text-slate-600">
                              +{stock.totalAdjustedIncrease}/-{stock.totalAdjustedDecrease}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-900">
                        <span
                          className={
                            stock.availableStock > 0
                              ? "text-slate-900 font-bold"
                              : "text-rose-600 font-bold"
                          }
                        >
                          {stock.availableStock}
                        </span>
                      </td>

                      <td className="py-3 px-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            stock.status === "In Stock"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : stock.status === "Low Stock"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {stock.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveEdit(prod.id)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setProductForHistory(prod);
                                setShowHistoryModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                              title={`View Complete Movement History (Purchases, Sales, Returns) for ${prod.name}`}
                            >
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                              <span>History</span>
                            </button>
                            <button
                              onClick={() => {
                                setProductToAdjust(prod);
                                setShowAdjustmentModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                              title={`Adjust stock for ${prod.name} (+/-)`}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setProductForPurchaseRate(prod);
                                setShowAdjustPurchaseRateModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
                              title={`Adjust Purchase Rate for ${prod.name}`}
                            >
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            </button>
                            <button
                              type="button"
                              disabled={stock.availableStock <= 0}
                              onClick={() => {
                                setConfirmDeleteModal({
                                  isOpen: true,
                                  title: "Clear Available Stock to 0",
                                  message: `Are you sure you want to permanently clear remaining ${stock.availableStock} units of "${prod.name}" to 0? This will record a stock deduction and set available stock to 0.`,
                                  itemDescription: `Product: ${prod.name} | Current Available Stock: ${stock.availableStock} units`,
                                  confirmButtonText: "Yes, Set Stock to 0",
                                  onConfirm: () => {
                                    zeroOutItemStock(prod.id, prod.name, "Manual Stock Clearance to 0");
                                    setConfirmDeleteModal(null);
                                  },
                                });
                              }}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                stock.availableStock > 0
                                  ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                  : "text-slate-200 cursor-not-allowed"
                              }`}
                              title={
                                stock.availableStock > 0
                                  ? `Permanently clear remaining ${stock.availableStock} units to 0`
                                  : "Already 0 units in stock"
                              }
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleStartEdit(prod)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                              title="Edit product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDeleteModal({
                                  isOpen: true,
                                  title: "Delete Product from Catalog",
                                  message: `Are you sure you want to delete product "${prod.name}" from the master price list?`,
                                  itemDescription: `Category: ${prod.category} | Master Price: Rs. ${prod.price.toLocaleString()}`,
                                  confirmButtonText: "Yes, Delete Product",
                                  onConfirm: () => {
                                    deleteProductFromMaster(prod.id);
                                    setConfirmDeleteModal(null);
                                  },
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add Product to Price List</h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-sm">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gauze Imperial 4x4"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Dressing & Wound Care"
                  value={newCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setNewCategory(cat);
                    if (!newCode || newCode.startsWith("PRD-") || newCode.startsWith("GAU-") || newCode.startsWith("DIA-") || newCode.startsWith("SYR-")) {
                      setNewCode(generateProductCode(cat));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-emerald-800">
                      Purchase Rate (PKR) *
                    </label>
                    <span className="text-[9px] text-emerald-700 font-bold">Cost</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 150"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-emerald-400 bg-emerald-50/20 rounded-lg text-slate-800 font-bold font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-blue-800">
                      Master Sale Rate (PKR) *
                    </label>
                    <span className="text-[9px] text-blue-700 font-bold">Sale</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 200"
                    value={newPrice}
                    onChange={(e) => {
                      const sp = e.target.value;
                      setNewPrice(sp);
                      if (!newCostPrice || Number(newCostPrice) === 0) {
                        setNewCostPrice(Math.round((Number(sp) || 0) * 0.78));
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-bold font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">
                    Product Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewCode(generateProductCode(newCategory))}
                    className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Auto generate next available code"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-blue-500" />
                    Auto Code
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. GAU-004"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Quick live margin preview */}
              {Number(newPrice) > 0 && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 font-sans text-[11px]">Projected Margin / Profit:</span>
                  <span className={Number(newPrice) >= (Number(newCostPrice) || 0) ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                    Rs. {(Number(newPrice) - (Number(newCostPrice) || 0)).toFixed(2)} (
                    {Number(newPrice) > 0 
                      ? (((Number(newPrice) - (Number(newCostPrice) || 0)) / Number(newPrice)) * 100).toFixed(1)
                      : "0"}% margin)
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Price List Modal */}
      <ImportPriceListModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

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

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={showAdjustmentModal}
        onClose={() => {
          setShowAdjustmentModal(false);
          setProductToAdjust(null);
        }}
        preselectedProduct={productToAdjust}
      />

      {/* Product Movement History Modal */}
      <ProductHistoryModal
        product={productForHistory}
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setProductForHistory(null);
        }}
        onOpenAdjustStock={(p) => {
          setProductToAdjust(p);
          setShowAdjustmentModal(true);
        }}
      />

      {/* Master Inventory PDF Preview & Print Modal */}
      <InventoryPdfModal
        isOpen={showInventoryPdfModal}
        onClose={() => setShowInventoryPdfModal(false)}
        products={currentProducts}
        version={activeVer}
        settings={settings}
        stockSummaries={getStockSummaries()}
      />

      {/* Dedicated Purchase Rate Adjustment Modal */}
      <AdjustPurchaseRateModal
        isOpen={showAdjustPurchaseRateModal}
        onClose={() => {
          setShowAdjustPurchaseRateModal(false);
          setProductForPurchaseRate(null);
        }}
        product={productForPurchaseRate}
        availableStock={
          productForPurchaseRate
            ? getItemAvailableStock(productForPurchaseRate.id, productForPurchaseRate.name).availableStock
            : 0
        }
        onSave={handleSavePurchaseRate}
      />
    </div>
  );
};
