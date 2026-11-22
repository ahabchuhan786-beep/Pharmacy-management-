import React, { useState } from "react";
import { createPortal } from "react-dom";
import { RecoveryRecord } from "../types";
import { useApp } from "../context/AppContext";
import { convertRupeesToWords } from "../utils/numberToWords";
import { generateRecoveryReceiptPdf, downloadPdfSafely } from "../utils/pdfGenerator";
import {
  Download,
  Printer,
  X,
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Smartphone,
} from "lucide-react";

interface RecoveryReceiptModalProps {
  recovery: RecoveryRecord;
  onClose: () => void;
}

export const RecoveryReceiptModal: React.FC<RecoveryReceiptModalProps> = ({
  recovery,
  onClose,
}) => {
  const { settings } = useApp();
  const [layoutMode, setLayoutMode] = useState<"voucher" | "slip">("voucher");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const currency = settings.currencySymbol || "Rs.";
  const amountWords =
    recovery.amountInWords || convertRupeesToWords(Number(recovery.recoveredAmount) || 0);

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const doc = generateRecoveryReceiptPdf(recovery, settings, layoutMode);
      const safeName = (recovery.customerName || "Customer")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .slice(0, 30);
      const suffix = layoutMode === "slip" ? "_Slip" : "";
      const ok = await downloadPdfSafely(doc, `${recovery.receiptNumber}${suffix}_${safeName}.pdf`);
      if (ok) {
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    const lines = [
      `*${(settings.pharmacyName || "AK PHARMACY").toUpperCase()}*`,
      `PAYMENT RECEIVING RECEIPT`,
      `Receipt #: ${recovery.receiptNumber}`,
      `Date: ${recovery.recoveryDate}${recovery.recoveryTime ? ` (${recovery.recoveryTime})` : ""}`,
      `Customer: ${recovery.customerName}`,
      recovery.linkedOrderNumber ? `Against Invoice: ${recovery.linkedOrderNumber}` : "",
      `--------------------------------`,
      `Previous Balance: ${currency} ${Number(recovery.previousDue || 0).toLocaleString("en-PK")}`,
      `Amount Received: ${currency} ${Number(recovery.recoveredAmount || 0).toLocaleString("en-PK")}`,
      (recovery.discountOrAdjustment || 0) > 0
        ? `Adjustment / Discount: ${currency} ${Number(recovery.discountOrAdjustment).toLocaleString("en-PK")}`
        : "",
      `Remaining Balance: ${currency} ${Number(recovery.remainingDue || 0).toLocaleString("en-PK")}`,
      `--------------------------------`,
      `Method: ${recovery.paymentMethod}${recovery.referenceNo ? ` (Ref: ${recovery.referenceNo})` : ""}`,
      `Collected By: ${recovery.collectedBy || settings.defaultSalesman || "Staff"}`,
      `In Words: ${amountWords}`,
      recovery.notes ? `Notes: ${recovery.notes}` : "",
      `Thank you for your payment!`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback copy via temporary textarea
      const textarea = document.createElement("textarea");
      textarea.value = lines;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const renderVoucherCopy = (copyTitle: string) => (
    <div className="border-2 border-slate-800 rounded-lg overflow-hidden bg-white">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {settings.logoUrl && (
            <div className="w-12 h-12 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center">
              <img
                src={settings.logoUrl}
                alt="Pharmacy Logo"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          <div>
            <h2 className="text-lg font-black tracking-wide uppercase leading-tight">
              {settings.pharmacyName || "AK PHARMACY"}
            </h2>
            <p className="text-[11px] text-slate-300">{settings.address}</p>
            <p className="text-[10px] text-slate-400">
              Tel: {settings.phone} &bull; Lic: {settings.licenseNo}
              {settings.ntn ? ` • NTN: ${settings.ntn}` : ""}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="inline-block px-3 py-1 bg-emerald-600 text-white font-black text-xs tracking-wider uppercase rounded">
            Receiving Receipt
          </div>
          <div className="text-[10px] text-slate-300 font-semibold tracking-widest uppercase mt-1">
            {copyTitle}
          </div>
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className="text-slate-500 font-semibold">Receipt No: </span>
          <span className="font-mono font-black text-slate-900 text-sm">
            {recovery.receiptNumber}
          </span>
        </div>
        <div>
          <span className="text-slate-500 font-semibold">Date &amp; Time: </span>
          <span className="font-bold text-slate-800">
            {recovery.recoveryDate}
            {recovery.recoveryTime ? ` • ${recovery.recoveryTime}` : ""}
          </span>
        </div>
        <div>
          <span className="text-slate-500 font-semibold">Payment Mode: </span>
          <span className="font-bold text-blue-700">{recovery.paymentMethod}</span>
        </div>
      </div>

      {/* Body Grid */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Left: Party Details */}
          <div className="sm:col-span-7 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs bg-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Received With Thanks From
            </div>
            <div className="text-base font-black text-slate-900">
              {recovery.customerName || "Walk-In Customer"}
            </div>
            {recovery.customerCode && (
              <div className="text-slate-600">
                <span className="font-semibold">Customer Code:</span>{" "}
                <span className="font-mono">{recovery.customerCode}</span>
              </div>
            )}
            {recovery.customerPhone && (
              <div className="text-slate-600">
                <span className="font-semibold">Phone:</span>{" "}
                <span className="font-mono">{recovery.customerPhone}</span>
              </div>
            )}
            {(recovery.customerAddress || recovery.customerCity) && (
              <div className="text-slate-600">
                <span className="font-semibold">Address:</span>{" "}
                {[recovery.customerAddress, recovery.customerCity].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="pt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
              {recovery.linkedOrderNumber && (
                <span>
                  <span className="font-semibold text-slate-500">Against Invoice:</span>{" "}
                  <span className="font-mono font-bold text-blue-700">
                    {recovery.linkedOrderNumber}
                  </span>
                </span>
              )}
              {recovery.referenceNo && (
                <span>
                  <span className="font-semibold text-slate-500">Ref / TXN / Cheque #:</span>{" "}
                  <span className="font-mono font-semibold">{recovery.referenceNo}</span>
                </span>
              )}
              {recovery.receivedBy && (
                <span>
                  <span className="font-semibold text-slate-500">Paid By:</span>{" "}
                  {recovery.receivedBy}
                </span>
              )}
            </div>
          </div>

          {/* Right: Financial Settlement Box */}
          <div className="sm:col-span-5 border border-emerald-200 bg-emerald-50/60 rounded-lg p-3.5 flex flex-col justify-between text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Previous Pending:</span>
              <span className="font-mono font-semibold text-slate-800">
                {currency} {Number(recovery.previousDue || 0).toLocaleString("en-PK")}
              </span>
            </div>

            <div className="flex justify-between items-center bg-emerald-600 text-white px-3 py-2 rounded-md shadow-xs">
              <span className="font-bold">Amount Received:</span>
              <span className="font-mono font-black text-base">
                {currency} {Number(recovery.recoveredAmount || 0).toLocaleString("en-PK")}
              </span>
            </div>

            {(recovery.discountOrAdjustment || 0) > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Waived / Discount:</span>
                <span className="font-mono font-semibold text-amber-700">
                  - {currency} {Number(recovery.discountOrAdjustment).toLocaleString("en-PK")}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-emerald-200 flex justify-between items-center font-bold">
              <span className="text-slate-700">Remaining Balance:</span>
              <span
                className={`font-mono text-sm font-black ${
                  recovery.remainingDue > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {recovery.remainingDue > 0
                  ? `${currency} ${Number(recovery.remainingDue).toLocaleString("en-PK")}`
                  : `${currency} 0 (Settled)`}
              </span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider mr-2">
            Amount in Words:
          </span>
          <span className="font-serif italic font-bold text-slate-900">{amountWords}</span>
        </div>

        {/* Remarks */}
        {recovery.notes && (
          <div className="text-xs text-slate-600 bg-amber-50/50 border border-amber-200/70 rounded-lg px-3.5 py-2">
            <span className="font-bold text-slate-700">Remarks: </span>
            <span>{recovery.notes}</span>
          </div>
        )}

        {/* Signatures Footer */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-700">
              Collected By: {recovery.collectedBy || settings.defaultSalesman || "Staff"}
            </div>
            <div className="text-[10px] text-slate-400">Authorized Receiver Signature &amp; Stamp</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1.5 font-bold text-slate-700">
              Customer / Payer Signature
            </div>
            <div className="text-[10px] text-slate-400">Verified &amp; Acknowledged</div>
          </div>
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <div
      id="recovery-receipt-modal"
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="recovery-modal-dialog bg-slate-100 rounded-xl border border-slate-300 shadow-2xl max-w-4xl w-full flex flex-col max-h-[94vh] animate-scaleUp overflow-hidden">
        {/* Top Modal Action Bar */}
        <div className="bg-[#1e293b] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight text-white">
                Receiving Receipt
              </h3>
              <p className="text-[11px] text-slate-400">
                {recovery.receiptNumber} &bull; {recovery.customerName}{downloadSuccess ? " • PDF Saved!" : ""}
              </p>
            </div>
          </div>

          {/* Layout Toggle */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode("voucher")}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                layoutMode === "voucher"
                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Dual Copy</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("slip")}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                layoutMode === "slip"
                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Compact Slip</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="Copy text receipt for WhatsApp / SMS"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Copy Text</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="Print receipt"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? "Generating..." : "Download PDF"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Sheet Preview */}
        <div className="recovery-modal-scroll flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70">
          {layoutMode === "voucher" ? (
            <div
              id="printable-recovery-sheet"
              className="bg-white w-full max-w-[794px] mx-auto shadow-2xl p-5 sm:p-7 rounded-sm space-y-5 border border-slate-300"
            >
              {renderVoucherCopy("CUSTOMER COPY")}

              <div className="flex items-center gap-3 text-slate-400 text-[10px] select-none">
                <div className="flex-1 border-t border-dashed border-slate-300" />
                <span className="uppercase tracking-widest font-semibold">
                  Cut Here / Perforated Line
                </span>
                <div className="flex-1 border-t border-dashed border-slate-300" />
              </div>

              {renderVoucherCopy("OFFICE / RECORD COPY")}
            </div>
          ) : (
            <div
              id="printable-recovery-sheet"
              className="compact-slip-sheet bg-white w-full max-w-[360px] mx-auto shadow-2xl p-5 rounded-lg border border-slate-300 font-mono text-xs space-y-3"
            >
              <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
                <div className="text-base font-black text-slate-900 uppercase font-sans">
                  {settings.pharmacyName || "AK PHARMACY"}
                </div>
                <div className="text-[11px] text-slate-600 font-sans">{settings.address}</div>
                <div className="text-[11px] text-slate-600">Tel: {settings.phone}</div>
                <div className="pt-1">
                  <span className="inline-block px-2.5 py-0.5 bg-slate-900 text-white font-bold text-[11px] rounded uppercase font-sans">
                    Receiving Receipt
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt #:</span>
                  <span className="font-bold text-slate-900">{recovery.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold text-slate-800">
                    {recovery.recoveryDate} {recovery.recoveryTime || ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode:</span>
                  <span className="font-semibold text-slate-800">{recovery.paymentMethod}</span>
                </div>
                {recovery.referenceNo && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ref #:</span>
                    <span className="font-semibold text-slate-800">{recovery.referenceNo}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2.5">
                <div className="text-[10px] uppercase text-slate-400 font-sans font-bold">
                  Received From
                </div>
                <div className="font-bold text-sm text-slate-900 font-sans">
                  {recovery.customerName}
                </div>
                {recovery.customerPhone && (
                  <div className="text-[11px] text-slate-600">{recovery.customerPhone}</div>
                )}
                {recovery.linkedOrderNumber && (
                  <div className="text-[11px] text-blue-700 font-semibold">
                    Against Invoice: {recovery.linkedOrderNumber}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between text-slate-600">
                  <span>Previous Due:</span>
                  <span>
                    {currency} {Number(recovery.previousDue || 0).toLocaleString("en-PK")}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 px-2 py-1.5 rounded font-bold text-emerald-800 text-sm">
                  <span>RECEIVED:</span>
                  <span>
                    {currency} {Number(recovery.recoveredAmount || 0).toLocaleString("en-PK")}
                  </span>
                </div>
                {(recovery.discountOrAdjustment || 0) > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Discount/Adj:</span>
                    <span>
                      - {currency} {Number(recovery.discountOrAdjustment).toLocaleString("en-PK")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 pt-1">
                  <span>Remaining Due:</span>
                  <span>
                    {currency} {Number(recovery.remainingDue || 0).toLocaleString("en-PK")}
                  </span>
                </div>
              </div>

              <div className="text-[11px] font-sans text-slate-600 italic leading-snug">
                {amountWords}
              </div>

              {recovery.notes && (
                <div className="text-[11px] font-sans text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
                  Note: {recovery.notes}
                </div>
              )}

              <div className="pt-4 border-t border-dashed border-slate-300 text-center space-y-1 text-[11px]">
                <div className="flex items-center justify-center gap-1 text-emerald-700 font-bold font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Payment Verified &amp; Recorded</span>
                </div>
                <div className="text-slate-500 font-sans">
                  Collected By: {recovery.collectedBy || settings.defaultSalesman || "Staff"}
                </div>
                {recovery.receivedBy && (
                  <div className="text-slate-400 font-sans text-[10px]">
                    Paid By: {recovery.receivedBy}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
