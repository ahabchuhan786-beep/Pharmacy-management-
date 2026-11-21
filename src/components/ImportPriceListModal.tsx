import React, { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import { ExtractedProductItem } from "../types";
import * as XLSX from "xlsx";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Sparkles,
  ShieldCheck,
  X,
  FileSpreadsheet,
} from "lucide-react";

interface ImportPriceListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportPriceListModal: React.FC<ImportPriceListModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { saveNewPriceListVersion, priceListVersions } = useApp();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [versionName, setVersionName] = useState(
    `Price List v${priceListVersions.length + 1}`
  );
  const [versionNotes, setVersionNotes] = useState("");

  // Extracted data state
  const [extractedItems, setExtractedItems] = useState<ExtractedProductItem[]>([]);
  const [qcStats, setQcStats] = useState<{
    totalLines: number;
    productCount: number;
    headingCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // remove prefix data:...;base64,
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Process Document
  const handleExtractPriceList = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const fileName = selectedFile.name.toLowerCase();

    try {
      // 1. If Excel or CSV file
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
        const data = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const items: ExtractedProductItem[] = [];
        let headingCount = 0;

        rows.forEach((row, idx) => {
          if (!row || row.length === 0) return;
          const textCols = row.map((c) => String(c || "").trim()).filter(Boolean);
          if (textCols.length === 0) return;

          // Check if row has a price (number)
          let price = 0;
          let name = "";
          let category = "General Supplies";

          // Try to identify price from columns
          for (let i = row.length - 1; i >= 0; i--) {
            const val = String(row[i] || "").replace(/[^0-9.]/g, "");
            if (val && !isNaN(Number(val)) && Number(val) > 0) {
              price = Number(val);
              break;
            }
          }

          // First text is name
          name = textCols[0];

          const isHeader = price === 0 || textCols.length === 1 || name.toLowerCase().includes("category");

          if (isHeader) {
            headingCount++;
          }

          items.push({
            name,
            category,
            price,
            isCategoryHeader: isHeader,
            isSelected: !isHeader,
            rawText: row.join(" | "),
          });
        });

        setExtractedItems(items);
        setQcStats({
          totalLines: rows.length,
          productCount: items.filter((it) => !it.isCategoryHeader).length,
          headingCount,
        });
      } else {
        // 2. PDF or Image Document -> Call Gemini Server-Side Multimodal Extraction
        const base64Data = await fileToBase64(selectedFile);
        const mimeType = selectedFile.type || (fileName.endsWith(".pdf") ? "application/pdf" : "image/jpeg");

        const response = await fetch("/api/extract-price-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData: base64Data,
            mimeType,
            fileName: selectedFile.name,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to extract price list from document");
        }

        const data = result.data;
        const items: ExtractedProductItem[] = (data.items || []).map((it: any) => ({
          name: it.name || "Unknown Item",
          category: it.category || "General Supplies",
          price: Number(it.price) || 0,
          productCode: it.productCode || "",
          isCategoryHeader: Boolean(it.isCategoryHeader),
          isSelected: !it.isCategoryHeader,
          rawText: it.rawText || it.name,
        }));

        setExtractedItems(items);
        setQcStats({
          totalLines: data.totalLinesProcessed || items.length,
          productCount: data.totalProductsDetected || items.filter((it) => !it.isCategoryHeader).length,
          headingCount: data.totalHeadingsDetected || items.filter((it) => it.isCategoryHeader).length,
        });
      }
    } catch (err: any) {
      console.error("Price list extraction error:", err);
      setErrorMessage(err.message || "An unexpected error occurred while reading the file.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Inline editing in QC table
  const handleUpdateItem = (idx: number, updates: Partial<ExtractedProductItem>) => {
    setExtractedItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  const handleDeleteItem = (idx: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save approved price list version
  const handleSavePriceList = () => {
    const validProducts = extractedItems.filter(
      (it) => it.isSelected && !it.isCategoryHeader && it.name.trim().length > 0
    );

    if (validProducts.length === 0) {
      setErrorMessage("No valid products selected to save. Please review the extracted lines.");
      return;
    }

    saveNewPriceListVersion(
      versionName,
      validProducts.map((p) => ({
        name: p.name,
        category: p.category,
        price: p.price,
        productCode: p.productCode,
      })),
      selectedFile?.name,
      versionNotes
    );

    onClose();
  };

  return (
    <div
      id="import-price-list-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 animate-scaleUp my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Import Master Pharmacy Price List
              </h3>
              <p className="text-xs text-slate-500">
                Upload PDF, Excel, or CSV &bull; Gemini AI extracts product names & exact rates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* File Upload Zone */}
          {!qcStats ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  selectedFile
                    ? "border-blue-500 bg-blue-50/40"
                    : "border-slate-300 hover:border-blue-500 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  {selectedFile?.name.endsWith(".pdf") ? (
                    <FileText className="w-6 h-6" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                {selectedFile ? (
                  <div>
                    <span className="font-bold text-slate-900 text-sm sm:text-base">{selectedFile.name}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to choose a different file
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold text-slate-800 text-sm sm:text-base">
                      Drag & Drop your Pharmacy Price List PDF / Excel
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports PDF, XLSX, XLS, CSV and Image documents
                    </p>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Version Naming Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Save as Price List Version Name:
                  </label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs sm:text-sm font-semibold bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Version Description / Notes (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Updated August 2026 surgical supplier catalog"
                    value={versionNotes}
                    onChange={(e) => setVersionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Process Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  id="btn-process-file"
                  disabled={!selectedFile || isProcessing}
                  onClick={handleExtractPriceList}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                    selectedFile && !isProcessing
                      ? "bg-blue-600 hover:bg-blue-700 text-white active:scale-95"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isProcessing ? "Extracting Products & Prices with AI..." : "Extract Price List"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Quality Control Review Screen */
            <div className="space-y-4">
              {/* QC Statistics Banner */}
              <div
                id="import-qc-summary-banner"
                className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Import Quality Control Summary
                    </h4>
                    <p className="text-slate-600 mt-0.5">
                      Imported <strong>{qcStats.totalLines}</strong> lines &bull; Detected{" "}
                      <strong className="text-blue-800">{qcStats.productCount} products</strong> &bull;{" "}
                      <strong className="text-slate-700">{qcStats.headingCount} category headings/notes</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQcStats(null);
                      setExtractedItems([]);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-700 font-semibold cursor-pointer shadow-xs text-xs"
                  >
                    Upload Another File
                  </button>
                </div>
              </div>

              {/* Interactive Review Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-200">
                  <span>Review Extracted Products ({extractedItems.length} entries):</span>
                  <span className="text-slate-400 text-[11px]">Check/Uncheck to include in master list</span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                      <tr>
                        <th className="p-2 w-10 text-center">Include</th>
                        <th className="p-2 min-w-[200px]">Product Name</th>
                        <th className="p-2 w-36">Category</th>
                        <th className="p-2 w-28 text-right">Price (PKR)</th>
                        <th className="p-2 w-16 text-center">Type</th>
                        <th className="p-2 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {extractedItems.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            item.isCategoryHeader ? "bg-slate-50 font-semibold text-slate-500" : ""
                          }`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.isSelected}
                              onChange={(e) =>
                                handleUpdateItem(idx, { isSelected: e.target.checked })
                              }
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-slate-900 font-medium text-xs focus:outline-none focus:border-blue-500"
                            />
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) =>
                                handleUpdateItem(idx, { category: e.target.value })
                              }
                              className="w-full px-2 py-1 border border-slate-200 rounded text-slate-700 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </td>

                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) =>
                                handleUpdateItem(idx, { price: Number(e.target.value) || 0 })
                              }
                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right font-mono font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-500"
                            />
                          </td>

                          <td className="p-2 text-center">
                            {item.isCategoryHeader ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-bold">
                                Heading
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] uppercase font-bold">
                                Product
                              </span>
                            )}
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(idx)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Cancel
          </button>

          {qcStats && (
            <button
              type="button"
              id="btn-save-approved-price-list"
              onClick={handleSavePriceList}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Approved Price List ({versionName})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
