import React, { useState, useMemo } from "react";
import { Product, PriceListVersion, PharmacySettings, StockSummaryItem } from "../types";
import { generateInventoryPriceListPdf, downloadPdfSafely, getPdfBlobUrl } from "../utils/pdfGenerator";
import {
  X,
  Download,
  Printer,
  ExternalLink,
  Search,
  FileText,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";

interface InventoryPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  version: PriceListVersion;
  settings: PharmacySettings;
  stockSummaries?: StockSummaryItem[];
}

export const InventoryPdfModal: React.FC<InventoryPdfModalProps> = ({
  isOpen,
  onClose,
  products,
  version,
  settings,
  stockSummaries,
}) => {
  const [searchFilter, setSearchFilter] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    if (stockSummaries) {
      stockSummaries.forEach((s) => {
        if (s.productId) map.set(s.productId, Number(s.currentStock) || 0);
        if (s.productName) map.set(s.productName.toLowerCase().trim(), Number(s.currentStock) || 0);
      });
    }
    return map;
  }, [stockSummaries]);

  const filteredProducts = useMemo(() => {
    if (!searchFilter.trim()) return products;
    const q = searchFilter.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.productCode && p.productCode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, searchFilter]);

  const totalCatalogValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  }, [products]);

  if (!isOpen) return null;

  const fileName = `${(settings.pharmacyName || "AK_Pharmacy").replace(/\s+/g, "_")}_Inventory_Catalog_${(version?.versionName || "v1").replace(/\s+/g, "_")}.pdf`;

  const handleDownloadPdf = () => {
    try {
      setIsDownloading(true);
      const doc = generateInventoryPriceListPdf(products, version, settings, stockSummaries);
      const ok = downloadPdfSafely(doc, fileName);
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      }
    } catch (err) {
      console.error("Failed to generate/download Inventory PDF:", err);
      alert("Error generating PDF. Please use the Print button as an alternative.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenPdfInNewTab = () => {
    try {
      const doc = generateInventoryPriceListPdf(products, version, settings, stockSummaries);
      const url = getPdfBlobUrl(doc);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Failed to open PDF in new tab:", err);
      window.print();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="inventory-pdf-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Controls (Hidden when printing) */}
        <div className="print:hidden bg-slate-900 text-white px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Master Inventory & Price List Catalog PDF
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {version?.versionName || "Catalog v1"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {products.length} Products &bull; Total Value: Rs. {totalCatalogValue.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {downloadSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30 animate-pulse">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Downloaded!
              </span>
            )}

            <button
              type="button"
              id="btn-modal-download-inventory-pdf"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Download standalone PDF document to your device"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? "Generating PDF..." : "Download PDF"}</span>
            </button>

            <button
              type="button"
              id="btn-modal-open-tab-inventory-pdf"
              onClick={handleOpenPdfInNewTab}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Open full PDF in a new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </button>

            <button
              type="button"
              id="btn-modal-print-inventory-pdf"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Print standard A4 Inventory Catalog"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar (Hidden when printing) */}
        <div className="print:hidden bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, code, or category..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-3 text-slate-600 font-medium">
            <span>Showing: <strong>{filteredProducts.length}</strong> of {products.length} items</span>
            <span className="hidden md:inline text-slate-400">&bull;</span>
            <span className="hidden md:inline font-mono text-[11px] text-slate-500">
              Lic: {settings.licenseNo || "Direct"}
            </span>
          </div>
        </div>

        {/* Scrollable Printable Sheet View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div
            id="inventory-printable-catalog"
            className="w-full max-w-[210mm] bg-white border border-slate-300 shadow-md p-6 sm:p-8 flex flex-col text-slate-800 print:border-none print:shadow-none print:p-4 print:m-0"
          >
            {/* Catalog Banner Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {settings.pharmacyName || "AK PHARMACY"}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  {settings.address || "16, Sahiwal Estate, Arif Road, Sahiwal"} &bull; Phone: {settings.phone || "040-4500933"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Drug Lic: {settings.licenseNo || "Direct"} &bull; NTN #: {settings.ntn || "Direct"}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                  Master Price List & Catalog
                </span>
                <p className="text-xs font-mono font-bold text-slate-800 mt-1.5">
                  Edition: {version?.versionName || "Catalog v1"}
                </p>
                <p className="text-[11px] text-slate-500">
                  Date: {new Date().toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>

            {/* Catalog Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold text-[11px]">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2.5 w-20">Code</th>
                    <th className="py-2 px-3">Product Description</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right w-16">Stock</th>
                    <th className="py-2 px-3 text-right w-24 text-emerald-300">Purchase Rate</th>
                    <th className="py-2 px-3 text-right w-24">Sale Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProducts.map((prod, idx) => {
                    const availStock = stockMap.get(prod.id) ?? stockMap.get((prod.name || "").toLowerCase().trim()) ?? 0;
                    const costPrice = prod.costPrice !== undefined ? prod.costPrice : Math.round(prod.price * 0.78);
                    return (
                      <tr
                        key={prod.id || idx}
                        className={idx % 2 === 0 ? "bg-slate-50/70" : "bg-white"}
                      >
                        <td className="py-2 px-2 text-center font-mono text-slate-500 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-bold text-blue-900 text-[11px]">
                          {prod.productCode || `PRD-${String(idx + 1).padStart(3, "0")}`}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {prod.name}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          {prod.category || "General Supplies"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          <span className={availStock > 0 ? "text-emerald-700" : "text-rose-600"}>
                            {availStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                          Rs. {costPrice.toLocaleString("en-PK")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          Rs. {Number(prod.price).toLocaleString("en-PK")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Catalog Summary Footer */}
            <div className="mt-6 pt-4 border-t-2 border-slate-300 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
              <div className="text-slate-500 text-[11px]">
                <span>Total Catalog Items: <strong>{products.length} Products</strong></span>
                <span className="mx-2">&bull;</span>
                <span>Computer Generated Catalog</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                Cumulative Base Valuation: <span className="text-blue-700 font-mono">Rs. {totalCatalogValue.toLocaleString("en-PK")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
