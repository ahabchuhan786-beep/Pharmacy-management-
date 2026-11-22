import React, { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Quotation } from "../types";
import { useApp } from "../context/AppContext";
import { generateQuotationPdf, downloadPdfSafely } from "../utils/pdfGenerator";
import {
  Printer,
  Download,
  CheckCircle2,
  X,
  Share2,
  Calendar,
  Building,
  Phone,
  FileCheck2,
  Clock,
  ArrowRightCircle,
  FileSpreadsheet,
} from "lucide-react";

interface QuotationPrintModalProps {
  quotation: Quotation;
  onClose: () => void;
  onConvertToOrder?: (quotationId: string) => void;
}

export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  quotation,
  onClose,
  onConvertToOrder,
}) => {
  const { settings } = useApp();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const doc = generateQuotationPdf(quotation, settings);
      const safeCustomer = (quotation.customerName || "Customer").replace(/[^a-zA-Z0-9_-]+/g, "_");
      const ok = await downloadPdfSafely(
        doc,
        `${quotation.quotationNumber || "Quotation"}_${safeCustomer}.pdf`
      );
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    const itemsSummary = quotation.items
      .slice(0, 8)
      .map(
        (it, idx) =>
          `${idx + 1}. ${it.productName} x ${it.quantity} @ Rs. ${it.rate.toLocaleString()} = Rs. ${it.amount.toLocaleString()}`
      )
      .join("\n");

    const moreText = quotation.items.length > 8 ? `\n...and ${quotation.items.length - 8} more items` : "";

    const rawText =
      `*PRICE QUOTATION - ${settings.pharmacyName || "AK Pharmacy"}*\n` +
      `Quotation #: ${quotation.quotationNumber}\n` +
      `Date: ${quotation.quotationDate}\n` +
      `Valid Until: ${quotation.validUntil}\n` +
      `Customer: ${quotation.customerName}\n` +
      (quotation.subject ? `Subject: ${quotation.subject}\n` : "") +
      `\n*Items:*\n${itemsSummary}${moreText}\n\n` +
      `*Grand Total: Rs. ${quotation.grandTotal.toLocaleString()}*\n` +
      `(${quotation.grandTotalInWords})\n\n` +
      `*Terms:* ${quotation.termsConditions || "Prices valid for 15 days."}\n` +
      `Contact: ${settings.phone || "0300-1234567"}`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: `Quotation ${quotation.quotationNumber}`,
          text: rawText,
          dialogTitle: "Share Quotation",
        });
        return;
      } catch {
        // Ignore user cancel
        return;
      }
    }

    const text = encodeURIComponent(rawText);
    const phoneDigits = quotation.customerPhone?.replace(/[^0-9]/g, "") || "";
    const waUrl = phoneDigits
      ? `https://wa.me/${phoneDigits.startsWith("0") ? "92" + phoneDigits.slice(1) : phoneDigits}?text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(waUrl, "_blank");
  };

  const isExpired = new Date(quotation.validUntil) < new Date(new Date().toISOString().split("T")[0]);
  const isConverted = quotation.status === "Converted to Order";

  return (
    <div
      id="quotation-print-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">{quotation.quotationNumber}</span>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    isConverted
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : quotation.status === "Accepted"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : quotation.status === "Sent"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-slate-700 text-slate-300 border border-slate-600"
                  }`}
                >
                  {quotation.status}
                </span>
                {isExpired && !isConverted && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Expired
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Customer: <span className="text-white font-medium">{quotation.customerName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isConverted && onConvertToOrder && (
              <button
                type="button"
                onClick={() => onConvertToOrder(quotation.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                title="Convert this quotation into a live sales order"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>Convert to Order</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-lg transition-colors border border-emerald-600 cursor-pointer"
              title="Share quotation via WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-60"
              title="Download quotation PDF"
            >
              {downloadSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isDownloading ? "Generating..." : downloadSuccess ? "Saved!" : "Download PDF"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              title="Print quotation document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          <div
            id="quotation-printable-sheet"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white border border-slate-300 shadow-lg p-6 sm:p-10 flex flex-col justify-between text-slate-800 print:border-none print:shadow-none print:p-6 print:m-0"
          >
            {/* Header: Pharmacy Branding & Quotation Title */}
            <div>
              <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    {settings.logoUrl && (
                      <img
                        src={settings.logoUrl}
                        alt="Logo"
                        className="w-12 h-12 object-contain rounded border border-slate-200"
                      />
                    )}
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {settings.pharmacyName || "AK PHARMACY & SURGICALS"}
                      </h2>
                      <p className="text-xs text-slate-600 max-w-md">{settings.address}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500 pt-1">
                    {settings.phone && <span>Ph: {settings.phone}</span>}
                    {settings.licenseNo && <span>Drug Lic: {settings.licenseNo}</span>}
                    {settings.ntn && <span>NTN: {settings.ntn}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded">
                    Price Quotation / Estimate
                  </span>
                  <div className="mt-2 text-right">
                    <p className="text-xs font-mono font-bold text-slate-900">{quotation.quotationNumber}</p>
                    <p className="text-[11px] text-slate-500">Date: {quotation.quotationDate}</p>
                    <p className="text-[11px] font-semibold text-blue-700">Valid Until: {quotation.validUntil}</p>
                  </div>
                </div>
              </div>

              {/* Quotation Subject & Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Quotation Prepared For:
                  </span>
                  <p className="font-bold text-sm text-slate-900 mt-0.5">{quotation.customerName}</p>
                  {quotation.customerAddress && <p className="text-slate-600 mt-0.5">{quotation.customerAddress}</p>}
                  <div className="flex flex-wrap gap-x-3 text-slate-500 mt-1">
                    {quotation.customerCity && <span>City: {quotation.customerCity}</span>}
                    {quotation.customerPhone && <span>Phone: {quotation.customerPhone}</span>}
                    {quotation.customerNtn && <span>NTN: {quotation.customerNtn}</span>}
                  </div>
                </div>

                <div className="space-y-1 sm:text-right">
                  {quotation.subject && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Subject / Reference:
                      </span>
                      <p className="font-semibold text-slate-800">{quotation.subject}</p>
                    </div>
                  )}
                  {quotation.salesman && (
                    <p className="text-[11px] text-slate-500">
                      Prepared By Salesman: <span className="font-semibold text-slate-700">{quotation.salesman}</span>
                    </p>
                  )}
                  {isConverted && quotation.convertedOrderId && (
                    <p className="text-[11px] text-purple-700 font-semibold">
                      Converted to Order ID: {quotation.convertedOrderId}
                    </p>
                  )}
                </div>
              </div>

              {/* Rate Basis Banner */}
              <div
                className={`flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-semibold mb-3 border ${
                  quotation.quotationRateType === "purchase_rate"
                    ? "bg-amber-50 text-amber-900 border-amber-300"
                    : "bg-emerald-50 text-emerald-900 border-emerald-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      quotation.quotationRateType === "purchase_rate"
                        ? "bg-amber-200 text-amber-900"
                        : "bg-emerald-200 text-emerald-900"
                    }`}
                  >
                    {quotation.quotationRateType === "purchase_rate" ? "Purchase / Cost Rate" : "Standard Wholesale Rate"}
                  </span>
                  <span>
                    {quotation.quotationRateType === "purchase_rate"
                      ? "This quotation is prepared based on Wholesale Purchase / Cost Rates"
                      : "This quotation is prepared based on Standard Selling / MRP Rates"}
                  </span>
                </div>
                <span className="text-[11px] opacity-80 hidden sm:inline">
                  {quotation.quotationRateType === "purchase_rate" ? "Basis: Cost Rate" : "Basis: Selling Price"}
                </span>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-200 my-3">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold text-[11px]">
                    <th className="py-2 px-2.5 w-10 text-center">#</th>
                    <th className="py-2 px-3">Item Description</th>
                    <th className="py-2 px-2.5">Category</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2.5 text-right">Unit Rate (Rs.)</th>
                    <th className="py-2 px-2.5 text-right">Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {quotation.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2.5 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900">{it.productName}</span>
                      </td>
                      <td className="py-2 px-2.5 text-slate-500 text-[11px]">{it.category || "General Supplies"}</td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800">
                        {it.quantity}
                        {it.bon ? <span className="text-[10px] text-emerald-600 block">+{it.bon} free</span> : null}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                        {it.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                        {it.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Grand Total */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 my-4 pt-2">
                <div className="flex-1 space-y-1.5 text-xs text-slate-600">
                  <div>
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Amount in Words:
                    </span>
                    <p className="font-semibold text-slate-900 italic mt-0.5 bg-slate-50 p-2 rounded border border-slate-200">
                      {quotation.grandTotalInWords}
                    </p>
                  </div>
                  {quotation.notes && (
                    <div className="text-[11px] pt-1 text-slate-500">
                      <span className="font-semibold text-slate-700">Notes:</span> {quotation.notes}
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-64 space-y-1 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 shrink-0">
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      Rs. {quotation.subtotal.toLocaleString()}
                    </span>
                  </div>
                  {quotation.discount > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-mono font-semibold">- Rs. {quotation.discount.toLocaleString()}</span>
                    </div>
                  )}
                  {quotation.tax > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>Sales Tax:</span>
                      <span className="font-mono font-semibold">+ Rs. {quotation.tax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-blue-700">
                      Rs. {quotation.grandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              {quotation.termsConditions && (
                <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wider block mb-1">
                    Standard Terms & Conditions:
                  </span>
                  <p className="text-slate-600 whitespace-pre-line leading-relaxed text-[11px]">
                    {quotation.termsConditions}
                  </p>
                </div>
              )}
            </div>

            {/* Footer: Signatures & Stamp */}
            <div className="pt-8 border-t border-slate-300 mt-6 grid grid-cols-3 gap-4 text-center text-xs text-slate-500">
              <div>
                <div className="h-12 border-b border-dashed border-slate-400 mb-1" />
                <span className="font-semibold text-slate-700">Prepared By</span>
                <p className="text-[10px]">{quotation.salesman || settings.defaultSalesman || "Sales Officer"}</p>
              </div>
              <div>
                <div className="h-12 border-b border-dashed border-slate-400 mb-1" />
                <span className="font-semibold text-slate-700">Authorized Stamp & Signature</span>
                <p className="text-[10px]">{settings.pharmacyName}</p>
              </div>
              <div>
                <div className="h-12 border-b border-dashed border-slate-400 mb-1" />
                <span className="font-semibold text-slate-700">Customer Acceptance</span>
                <p className="text-[10px]">Received & Accepted with Stamp</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
