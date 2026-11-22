import React, { useState } from "react";
import { Order, PdfTemplateId } from "../types";
import { useApp } from "../context/AppContext";
import { generateOrderPdf, downloadPdfSafely } from "../utils/pdfGenerator";
import { convertRupeesToWords } from "../utils/numberToWords";
import {
  Download,
  Printer,
  X,
  FileText,
  CheckCircle2,
  Share2,
} from "lucide-react";

interface InvoicePreviewModalProps {
  order: Order;
  onClose: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  order,
  onClose,
}) => {
  const { settings, saveOrder } = useApp();
  const [activeTemplate, setActiveTemplate] = useState<PdfTemplateId>(
    order.pdfTemplate || settings.defaultPdfTemplate || "nafees_ak"
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const currentOrderWithTemplate: Order = {
    ...order,
    pdfTemplate: activeTemplate,
  };

  const handleDownloadPdf = async () => {
    try {
      setPdfError(null);
      setIsDownloading(true);
      const doc = generateOrderPdf(currentOrderWithTemplate, settings);
      const safeName = `${order.orderNumber || "Invoice"}_${order.customerName || "Customer"}.pdf`;
      const ok = await downloadPdfSafely(doc, safeName);
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      } else {
        setPdfError("Could not export PDF on this device. Please try using the Print button.");
      }
      // Update order template/status if changed without blocking PDF download
      if (order.pdfTemplate !== activeTemplate || order.status !== "Generated") {
        saveOrder({ ...currentOrderWithTemplate, status: "Generated" });
      }
    } catch (e) {
      console.error("PDF generation error:", e);
      setPdfError(
        e instanceof Error
          ? `PDF error: ${e.message}`
          : "Error generating PDF document. Try using the Print button."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalQuantity = order.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  return (
    <div
      id="invoice-preview-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-slate-100 rounded-xl border border-slate-300 shadow-2xl max-w-4xl w-full flex flex-col max-h-[94vh] animate-scaleUp overflow-hidden">
        {/* Modal Top Control Bar */}
        <div className="bg-[#1e293b] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight text-white">
                Invoice & Order Document Preview
              </h3>
              <p className="text-[11px] text-slate-400">
                Order #{order.orderNumber} &bull; {order.customerName || "Counter Sale"}
              </p>
            </div>
          </div>

          {/* Template Selector Pills */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveTemplate("nafees_ak")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTemplate === "nafees_ak"
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              AK Pharmacy Style
            </button>
            <button
              onClick={() => setActiveTemplate("simple_list")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTemplate === "simple_list"
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Simple List
            </button>
            <button
              onClick={() => setActiveTemplate("professional_po")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeTemplate === "professional_po"
                  ? "bg-blue-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Formal PO
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="btn-print-invoice"
              onClick={handlePrint}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="Print directly"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              id="btn-download-pdf"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? "Generating..." : "Download PDF"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline PDF Success Banner */}
        {downloadSuccess && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              PDF saved &amp; ready to share!
            </span>
          </div>
        )}

        {/* Inline PDF Error Banner */}
        {pdfError && (
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <span>{pdfError}</span>
            <button
              type="button"
              onClick={() => setPdfError(null)}
              className="text-rose-500 hover:text-rose-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable A4 Document Sheet View */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 flex justify-center bg-slate-200/70">
          <div
            id="printable-a4-sheet"
            className="bg-white text-slate-900 w-full max-w-[794px] min-h-[1050px] shadow-2xl p-6 sm:p-8 rounded-sm font-sans flex flex-col justify-between border border-slate-300 mx-auto"
            style={{ fontSize: "13.5px", lineHeight: "1.45" }}
          >
            {activeTemplate === "nafees_ak" && (
              /* NAFEES / AK PHARMACY INVOICE TEMPLATE */
              <div className="space-y-4">
                {/* Centered Header */}
                <div className="border-b-2 border-slate-800 pb-3.5 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    {settings.logoUrl && (
                      <div className="w-20 h-20 shrink-0 flex items-center justify-center mx-auto">
                        <img
                          src={settings.logoUrl}
                          alt="Pharmacy Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="text-center">
                      <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-slate-900 uppercase">
                        {settings.pharmacyName || "AK PHARMACY"}
                      </h1>
                      <p className="text-sm text-slate-700 font-medium mt-0.5">
                        {settings.address || "16, Sahiwal Estate, Arif Road, Sahiwal"}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                        Phone: <span className="font-semibold">{settings.phone}</span> | Lic. No:{" "}
                        <span className="font-mono font-semibold">{settings.licenseNo}</span> | NTN #:{" "}
                        <span className="font-mono font-semibold">{settings.ntn}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <span className="inline-block px-5 py-1 bg-slate-100 font-bold text-sm border border-slate-300 rounded uppercase tracking-wider">
                      SALE ORDER / INVOICE
                    </span>
                  </div>
                </div>

                {/* Customer & Order Information Grid */}
                <div className="grid grid-cols-12 border border-slate-300 rounded text-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
                  {/* Left Column: Customer details */}
                  <div className="col-span-12 sm:col-span-7 p-2.5 space-y-1">
                    <div className="flex">
                      <span className="w-28 font-bold text-slate-700">Customer:</span>
                      <span className="font-bold text-slate-900">{order.customerName || "Counter Pharmacy"}</span>
                    </div>
                    <div className="flex">
                      <span className="w-28 font-bold text-slate-700">Code:</span>
                      <span className="font-mono text-slate-800">{order.customerCode || "---"}</span>
                    </div>
                    <div className="flex">
                      <span className="w-28 font-bold text-slate-700">Address & City:</span>
                      <span className="text-slate-800">
                        {[order.customerAddress, order.customerCity].filter(Boolean).join(", ") || "---"}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-28 font-bold text-slate-700">Lic. # / NTN:</span>
                      <span className="font-mono text-slate-800">
                        {order.customerLicenseNo || "---"} / {order.customerNtn || "---"}
                      </span>
                    </div>
                    {order.customerPhone && (
                      <div className="flex">
                        <span className="w-28 font-bold text-slate-700">Phone:</span>
                        <span className="font-mono text-slate-800">{order.customerPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Order Details */}
                  <div className="col-span-12 sm:col-span-5 p-2.5 space-y-1">
                    <div className="flex">
                      <span className="w-24 font-bold text-slate-700">Order No:</span>
                      <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold text-slate-700">Order Date:</span>
                      <span className="text-slate-800">{order.orderDate}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold text-slate-700">Salesman:</span>
                      <span className="font-medium text-slate-800">{order.salesman || "ADNAN"}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24 font-bold text-slate-700">Price List:</span>
                      <span className="text-blue-700 font-semibold">{order.priceListVersion || "Price List v1"}</span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto border border-slate-300 rounded">
                  <table className="w-full text-left text-[13px] divide-y divide-slate-300">
                    <thead className="bg-slate-100 font-bold text-slate-800 select-none">
                      <tr>
                        <th className="p-2 text-center border-r border-slate-300 w-9 align-middle">#</th>
                        <th className="p-2 border-r border-slate-300 align-middle">Item Description</th>
                        <th className="p-2 text-center border-r border-slate-300 w-16 align-middle">Batch</th>
                        <th className="p-2 text-right border-r border-slate-300 w-20 align-middle">Rate</th>
                        <th className="p-2 text-center border-r border-slate-300 w-14 align-middle">Qty</th>
                        <th className="p-2 text-center border-r border-slate-300 w-12 align-middle">Bon</th>
                        <th className="p-2 text-right border-r border-slate-300 w-20 align-middle">Gross</th>
                        <th className="p-2 text-right border-r border-slate-300 w-16 align-middle">Disc %</th>
                        <th className="p-2 text-right w-24 align-middle">Net Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {order.items.map((it, idx) => {
                        const gross = (it.rate || 0) * (it.quantity || 0);
                        const net = it.amount || gross;
                        const discPercent = it.disc2 || it.disc1 || 0;
                        return (
                          <tr key={it.id || idx} className={idx % 2 === 1 ? "bg-slate-50/50" : ""}>
                            <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200 align-middle">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-semibold text-slate-900 border-r border-slate-200 align-middle">
                              {it.productName}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200 align-middle">
                              {it.batch || "-"}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-800 border-r border-slate-200 align-middle">
                              {it.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center font-bold text-slate-900 border-r border-slate-200 align-middle">
                              {it.quantity}
                            </td>
                            <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200 align-middle">
                              {it.bon || 0}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-800 border-r border-slate-200 align-middle">
                              {gross.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-500 border-r border-slate-200 align-middle">
                              {discPercent > 0 ? discPercent.toFixed(2) : "0.00"}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900 align-middle">
                              {net.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary & Totals Block */}
                <div className="grid grid-cols-12 border border-slate-300 rounded text-xs">
                  {/* Left: Words & Counts */}
                  <div className="col-span-12 sm:col-span-7 p-3 border-b sm:border-b-0 sm:border-r border-slate-300 space-y-2">
                    <div>
                      <span className="font-bold text-slate-700">Total Lines: </span>
                      <span className="font-semibold text-slate-900">{order.items.length} Products</span>
                      <span className="mx-2 text-slate-400">|</span>
                      <span className="font-bold text-slate-700">Total Quantity: </span>
                      <span className="font-semibold text-slate-900">{totalQuantity} Units</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-bold text-slate-700">Payment Status:</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                          (order.pendingAmount ?? (order.grandTotal - (order.paidAmount ?? order.grandTotal))) === 0
                            ? "bg-emerald-100 text-emerald-800"
                            : (order.paidAmount || 0) > 0
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {order.paymentStatus || ((order.pendingAmount ?? 0) === 0 ? "Paid" : "Pending")} ({order.paymentMethod || "Cash"})
                      </span>
                      {order.dueDate && (order.pendingAmount || 0) > 0 && (
                        <span className="text-slate-500">Due: {order.dueDate}</span>
                      )}
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block mb-0.5">Amount in Words:</span>
                      <p className="font-serif italic font-semibold text-slate-900 bg-slate-50 p-2 rounded border border-slate-200">
                        {convertRupeesToWords(order.grandTotal)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Calculations */}
                  <div className="col-span-12 sm:col-span-5 p-3 space-y-1 bg-slate-50/50">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gross Amount:</span>
                      <span className="font-mono font-semibold">
                        Rs. {order.subtotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Discount Amount:</span>
                      <span className="font-mono">
                        Rs. {(order.discount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Sale Tax / Adv. Tax:</span>
                      <span className="font-mono">
                        Rs. {(order.tax || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {(order.previousPendingAmount || 0) > 0 && (
                      <div className="flex justify-between text-amber-800 font-semibold text-[11px]">
                        <span>+ Previous Pending:</span>
                        <span className="font-mono">
                          Rs. {(order.previousPendingAmount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-1 border-t border-slate-300 font-bold">
                      <span className="text-slate-900">Net Amount:</span>
                      <span className="font-mono text-blue-900 font-black">
                        Rs. {order.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Paid & Pending Balance - ONLY show if pending amount was added / pending > 0 */}
                    {(() => {
                      const effPending =
                        order.pendingAmount !== undefined
                          ? Number(order.pendingAmount)
                          : Math.max(0, Number(order.grandTotal) - (Number(order.paidAmount) || 0));
                      if (effPending <= 0) return null;
                      return (
                        <>
                          <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200">
                            <span className="text-slate-600">Paid / Received:</span>
                            <span className="font-mono font-semibold text-emerald-700">
                              Rs. {(order.paidAmount !== undefined
                                ? order.paidAmount
                                : Math.max(0, order.grandTotal - effPending)
                              ).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-rose-700">Pending Balance:</span>
                            <span className="font-mono text-rose-700 font-black">
                              Rs. {effPending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Footer Section */}
                <div className="border border-slate-300 rounded p-3 text-xs sm:text-[13px] space-y-3 bg-white">
                  <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                    <span className="font-bold text-slate-800 block sm:inline">Remark: </span>
                    <span className="text-slate-700 leading-relaxed">
                      {settings.footerRemarks ||
                        "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained."}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-center">
                    <div>
                      <span className="font-bold text-slate-600 block text-[11px] uppercase">Prepared By</span>
                      <span className="font-semibold text-slate-900">{settings.preparedBy || "ADNAN"}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600 block text-[11px] uppercase">Printed By</span>
                      <span className="font-semibold text-slate-900">{settings.printedBy || "ADNAN"}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600 block text-[11px] uppercase">Date &amp; Time</span>
                      <span className="font-semibold text-slate-900">{new Date().toLocaleDateString("en-GB")} {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-600 block text-[11px] uppercase">Authorized Signature</span>
                      <span className="text-slate-700">__________________</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTemplate === "simple_list" && (
              /* SIMPLE ORDER LIST TEMPLATE */
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center border-b border-slate-300 pb-3.5 gap-1.5">
                  {settings.logoUrl && (
                    <div className="w-16 h-16 shrink-0 flex items-center justify-center mx-auto">
                      <img
                        src={settings.logoUrl}
                        alt="Pharmacy Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                  <h1 className="text-2xl font-bold text-slate-900 uppercase">{settings.pharmacyName}</h1>
                  <span className="px-3 py-0.5 bg-slate-100 rounded text-xs font-bold uppercase border border-slate-300">
                    Purchase Order Slip
                  </span>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Order #{order.orderNumber} &bull; Date: {order.orderDate} &bull; Customer: {order.customerName}
                  </p>
                </div>

                <table className="w-full text-left text-[13px] divide-y divide-slate-200 border border-slate-200 rounded">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2.5 w-10 text-center align-middle">#</th>
                      <th className="p-2.5 align-middle">Product Description</th>
                      <th className="p-2.5 text-center w-16 align-middle">Qty</th>
                      <th className="p-2.5 text-right w-28 align-middle">Rate</th>
                      <th className="p-2.5 text-right w-32 align-middle">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((it, i) => (
                      <tr key={it.id || i}>
                        <td className="p-2.5 text-center text-slate-500 align-middle">{i + 1}</td>
                        <td className="p-2.5 font-medium align-middle">{it.productName}</td>
                        <td className="p-2.5 text-center font-bold align-middle">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono align-middle">
                          Rs. {it.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold align-middle">
                          Rs. {it.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-center p-4 bg-slate-50 rounded border border-slate-200">
                  <div className="text-xs font-bold uppercase text-slate-500">Grand Total</div>
                  <div className="text-2xl font-bold font-mono text-blue-800 mt-0.5">
                    Rs. {order.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm font-serif italic text-slate-600 mt-1">
                    {convertRupeesToWords(order.grandTotal)}
                  </div>
                </div>
              </div>
            )}

            {activeTemplate === "professional_po" && (
              /* FORMAL PURCHASE ORDER TEMPLATE */
              <div className="space-y-4">
                <div className="bg-[#1e293b] text-white p-4 rounded flex flex-col items-center text-center gap-1.5">
                  {settings.logoUrl && (
                    <div className="w-14 h-14 rounded bg-white p-1 shrink-0 flex items-center justify-center mx-auto">
                      <img
                        src={settings.logoUrl}
                        alt="Pharmacy Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                  <h1 className="text-xl font-bold uppercase">{settings.pharmacyName}</h1>
                  <div className="text-xs font-bold text-blue-300 tracking-wider uppercase">
                    Official Purchase Order &bull; {order.orderNumber}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                  <div className="p-3 border border-slate-200 rounded">
                    <div className="font-bold text-slate-500 text-xs mb-1">SUPPLIER / ISSUER</div>
                    <div className="font-bold text-slate-900">{settings.pharmacyName}</div>
                    <div>{settings.address}</div>
                    <div>{settings.phone}</div>
                  </div>
                  <div className="p-3 border border-slate-200 rounded">
                    <div className="font-bold text-slate-500 text-xs mb-1">PURCHASER / PHARMACY</div>
                    <div className="font-bold text-slate-900">{order.customerName}</div>
                    <div>Date: {order.orderDate}</div>
                    <div>Sales Representative: {order.salesman}</div>
                  </div>
                </div>

                <table className="w-full text-left text-[13px] divide-y divide-slate-200 border border-slate-200 rounded">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2.5 w-10 text-center align-middle">#</th>
                      <th className="p-2.5 align-middle">Description</th>
                      <th className="p-2.5 text-center w-20 align-middle">Quantity</th>
                      <th className="p-2.5 text-right w-28 align-middle">Unit Rate</th>
                      <th className="p-2.5 text-right w-32 align-middle">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((it, i) => (
                      <tr key={it.id || i}>
                        <td className="p-2.5 text-center text-slate-500 align-middle">{i + 1}</td>
                        <td className="p-2.5 font-medium align-middle">{it.productName}</td>
                        <td className="p-2.5 text-center font-bold align-middle">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono align-middle">
                          Rs. {it.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold align-middle">
                          Rs. {it.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-center p-4 bg-slate-50 rounded border border-slate-200">
                  <div className="text-xs font-bold uppercase text-slate-500">Total Amount</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                    Rs. {order.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-sm font-serif italic text-slate-700 mt-1">
                    {convertRupeesToWords(order.grandTotal)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
