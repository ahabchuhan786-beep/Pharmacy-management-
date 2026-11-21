import React, { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { Order, Quotation, PurchaseOrder, ReturnRecord, StockAdjustment } from "../types";
import {
  Search,
  X,
  FileSpreadsheet,
  ShoppingBag,
  History,
  RotateCcw,
  SlidersHorizontal,
  ArrowRight,
  Eye,
  Calendar,
  DollarSign,
  User,
  Building,
  FileText,
  Filter,
} from "lucide-react";

interface UniversalDocumentSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewOrder?: (order: Order) => void;
  onViewQuotation?: (quotation: Quotation) => void;
}

interface SearchResultItem {
  id: string;
  type: "Sale Order" | "Quotation" | "Purchase Bill" | "Stock Return" | "Stock Adjustment";
  docNumber: string;
  date: string;
  partyName: string;
  status: string;
  amount: number;
  itemCount: number;
  itemNames: string;
  rawData: Order | Quotation | PurchaseOrder | ReturnRecord | StockAdjustment;
}

export const UniversalDocumentSearchModal: React.FC<UniversalDocumentSearchModalProps> = ({
  isOpen,
  onClose,
  onViewOrder,
  onViewQuotation,
}) => {
  const {
    orders,
    quotations,
    purchases,
    returns,
    stockAdjustments,
    setActiveNavTab,
    setSelectedPreviewOrder,
  } = useApp();

  const [query, setQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Aggregate all documents into a searchable unified list
  const allDocuments: SearchResultItem[] = useMemo(() => {
    const list: SearchResultItem[] = [];

    // 1. Orders
    orders.forEach((o) => {
      const itemsList = o.items.map((i) => i.productName).join(", ");
      list.push({
        id: `ord-${o.id}`,
        type: "Sale Order",
        docNumber: o.orderNumber,
        date: o.orderDate,
        partyName: o.customerName || "Walk-in Customer",
        status: o.status,
        amount: o.grandTotal,
        itemCount: o.items.length,
        itemNames: itemsList,
        rawData: o,
      });
    });

    // 2. Quotations
    quotations.forEach((q) => {
      const itemsList = q.items.map((i) => i.productName).join(", ");
      list.push({
        id: `quot-${q.id}`,
        type: "Quotation",
        docNumber: q.quotationNumber,
        date: q.quotationDate,
        partyName: q.customerName || "Customer",
        status: q.status,
        amount: q.grandTotal,
        itemCount: q.items.length,
        itemNames: itemsList,
        rawData: q,
      });
    });

    // 3. Purchases
    purchases.forEach((p) => {
      const itemsList = p.items.map((i) => i.productName).join(", ");
      list.push({
        id: `pur-${p.id}`,
        type: "Purchase Bill",
        docNumber: p.purchaseNumber,
        date: p.purchaseDate,
        partyName: p.supplierName,
        status: p.paymentStatus,
        amount: p.grandTotal,
        itemCount: p.items.length,
        itemNames: itemsList,
        rawData: p,
      });
    });

    // 4. Returns
    returns.forEach((r) => {
      const itemsList = r.items.map((i) => i.productName).join(", ");
      list.push({
        id: `ret-${r.id}`,
        type: "Stock Return",
        docNumber: r.returnNumber,
        date: r.returnDate,
        partyName: r.partyName,
        status: r.returnType,
        amount: r.totalAmount,
        itemCount: r.items.length,
        itemNames: itemsList,
        rawData: r,
      });
    });

    // 5. Stock Adjustments
    stockAdjustments.forEach((a) => {
      list.push({
        id: `adj-${a.id}`,
        type: "Stock Adjustment",
        docNumber: a.adjustmentNumber,
        date: a.date,
        partyName: `${a.type}: ${a.productName}`,
        status: a.type,
        amount: a.totalValue,
        itemCount: a.quantity,
        itemNames: a.productName,
        rawData: a,
      });
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [orders, quotations, purchases, returns, stockAdjustments]);

  // Search filter
  const searchResults = useMemo(() => {
    let results = allDocuments;

    if (selectedTypeFilter !== "all") {
      results = results.filter((d) => d.type === selectedTypeFilter);
    }

    if (!query.trim()) {
      return results.slice(0, 20); // Show recent 20 by default
    }

    const q = query.toLowerCase().trim();
    return results.filter((doc) => {
      const matchDocNo = doc.docNumber.toLowerCase().includes(q);
      const matchParty = doc.partyName.toLowerCase().includes(q);
      const matchItems = doc.itemNames.toLowerCase().includes(q);
      const matchDate = doc.date.includes(q);
      return matchDocNo || matchParty || matchItems || matchDate;
    });
  }, [allDocuments, query, selectedTypeFilter]);

  if (!isOpen) return null;

  const handleOpenDocument = (result: SearchResultItem) => {
    onClose();
    if (result.type === "Sale Order") {
      if (onViewOrder) {
        onViewOrder(result.rawData as Order);
      } else {
        setSelectedPreviewOrder(result.rawData as Order);
        setActiveNavTab("orders-history");
      }
    } else if (result.type === "Quotation") {
      if (onViewQuotation) {
        onViewQuotation(result.rawData as Quotation);
      } else {
        setActiveNavTab("quotations");
      }
    } else if (result.type === "Purchase Bill") {
      setActiveNavTab("purchases");
    } else if (result.type === "Stock Return") {
      setActiveNavTab("returns");
    } else if (result.type === "Stock Adjustment") {
      setActiveNavTab("stock-adjustments");
    }
  };

  return (
    <div
      id="universal-document-search-modal"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] mt-6 sm:mt-12 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div className="p-4 bg-slate-900 text-white flex items-center gap-3 border-b border-slate-800 shrink-0">
          <Search className="w-5 h-5 text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type Order # (ORD-), Quotation # (QT-), Purchase Bill # (PUR-), or Customer Name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-400 outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 text-xs font-semibold shrink-0 cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Filter Categories Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          {[
            { id: "all", label: `All Records (${allDocuments.length})` },
            { id: "Sale Order", label: `Sales (${orders.length})` },
            { id: "Quotation", label: `Quotations (${quotations.length})` },
            { id: "Purchase Bill", label: `Purchases (${purchases.length})` },
            { id: "Stock Return", label: `Returns (${returns.length})` },
            { id: "Stock Adjustment", label: `Adjustments (${stockAdjustments.length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedTypeFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
                selectedTypeFilter === cat.id
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {searchResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Search className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-700 text-sm">No documents found matching "{query}"</p>
              <p className="text-xs text-slate-400">
                Try searching with partial document numbers like "0001", "ORD", "QT", "PUR", or party name.
              </p>
            </div>
          ) : (
            searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenDocument(item)}
                className="group p-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-xl transition-all shadow-2xs hover:shadow-xs flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.type === "Sale Order"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : item.type === "Quotation"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : item.type === "Purchase Bill"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : item.type === "Stock Return"
                          ? "bg-rose-50 text-rose-800 border border-rose-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {item.type}
                    </span>

                    <span className="font-mono font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                      {item.docNumber}
                    </span>

                    <span className="text-xs text-slate-400 font-mono">• {item.date}</span>

                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.2 rounded font-medium">
                      {item.status}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {item.partyName}
                  </div>

                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.itemNames || `${item.itemCount} items`}
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <div className="font-bold text-slate-900 text-sm font-mono">
                      Rs. {item.amount.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {item.itemCount} item{item.itemCount !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-400 rounded-lg transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <span>
            Found <strong>{searchResults.length}</strong> matching records
          </span>
          <span className="text-slate-400 text-[11px]">
            Press <strong>Esc</strong> to close
          </span>
        </div>
      </div>
    </div>
  );
};
