import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Order, PharmacySettings, Product, PriceListVersion, StockSummaryItem, Quotation, RecoveryRecord } from "../types";
import { DEFAULT_SETTINGS } from "../data/defaultData";
import { convertRupeesToWords } from "./numberToWords";

/**
 * Robust date and time formatter for PDF outputs
 */
export function getFormattedDateTime(dateString?: string): {
  formattedDate: string;
  formattedTime: string;
  fullDateTime: string;
} {
  const now = new Date();
  let targetDate = now;

  if (dateString) {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  const day = String(targetDate.getDate()).padStart(2, "0");
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const year = targetDate.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedTime = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;

  return {
    formattedDate,
    formattedTime,
    fullDateTime: `${formattedDate} ${formattedTime}`,
  };
}

export function generateOrderPdf(order: Order, settings: PharmacySettings): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const template = order.pdfTemplate || settings.defaultPdfTemplate || "nafees_ak";

  if (template === "simple_list") {
    renderSimpleListTemplate(doc, order, settings);
  } else if (template === "professional_po") {
    renderProfessionalPoTemplate(doc, order, settings);
  } else {
    renderNafeesAkInvoiceTemplate(doc, order, settings);
  }

  return doc;
}

/**
 * 1. NAFEES / AK PHARMACY INVOICE TEMPLATE
 * Authentic pharmacy invoice style with exact reference columns:
 * [# | Item Description | Batch | Rate | Qty | Bon | Gross | Disc % | Net Amt]
 * (Expiry and Disc 1 columns removed as requested)
 * Strictly keeps up to 30 items on the first page, remaining items on the second page.
 */
function renderNafeesAkInvoiceTemplate(doc: jsPDF, order: Order, settings: PharmacySettings) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 8;
  const printableWidth = pageWidth - margin * 2;
  const dtInfo = getFormattedDateTime(order.orderDate);

  const PAGE1_MAX_ITEMS = 30;
  const SUBSEQUENT_PAGE_MAX_ITEMS = 36;

  const totalItems = order.items.length;
  const page1Items = order.items.slice(0, PAGE1_MAX_ITEMS);
  const remainingItems = order.items.slice(PAGE1_MAX_ITEMS);
  const totalPages = totalItems > PAGE1_MAX_ITEMS ? 1 + Math.ceil(remainingItems.length / SUBSEQUENT_PAGE_MAX_ITEMS) : 1;

  // Streamlined 9 columns (Exp. and Disc 1 removed)
  const cols = [
    { label: "#", width: 8, align: "center" as const },
    { label: "Item Description", width: 78, align: "left" as const },
    { label: "Batch", width: 16, align: "center" as const },
    { label: "Rate", width: 18, align: "right" as const },
    { label: "Qty", width: 13, align: "center" as const },
    { label: "Bon", width: 11, align: "center" as const },
    { label: "Gross", width: 18, align: "right" as const },
    { label: "Disc %", width: 13, align: "right" as const },
    { label: "Net Amt", width: 19, align: "right" as const },
  ];

  let currentY = margin;

  // --- PAGE 1: HEADER SECTION ---
  if (settings.logoUrl) {
    try {
      doc.addImage(settings.logoUrl, margin + 2, currentY, 17, 17);
    } catch (e) {
      console.warn("Could not embed logo in PDF", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 30, 45);
  doc.text((settings.pharmacyName || "AK PHARMACY").toUpperCase(), pageWidth / 2, currentY + 4.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  currentY += 8;
  doc.text(settings.address || "16, Sahiwal Estate, Arif Road, Sahiwal", pageWidth / 2, currentY, { align: "center" });
  currentY += 3.5;
  doc.text(
    `Phone: ${settings.phone || "040-4500933, 34"}  |  Lic. No.: ${settings.licenseNo || "02-367-0154-110890D"}  |  NTN #: ${settings.ntn || "3159783-1"}`,
    pageWidth / 2,
    currentY,
    { align: "center" }
  );

  currentY += 3;
  doc.setDrawColor(40, 60, 90);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Title Box
  currentY += 3.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("SALE ORDER / INVOICE", pageWidth / 2, currentY, { align: "center" });

  // --- CUSTOMER & ORDER INFO GRID ---
  currentY += 2.5;
  const infoBoxY = currentY;
  const infoBoxHeight = 17;
  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.2);
  doc.rect(margin, infoBoxY, printableWidth, infoBoxHeight);

  // Vertical divider
  const midX = margin + printableWidth * 0.55;
  doc.line(midX, infoBoxY, midX, infoBoxY + infoBoxHeight);

  // Left Column - Customer Details
  doc.setFontSize(7.5);
  const leftX = margin + 2;
  let leftY = infoBoxY + 3.8;

  doc.setFont("helvetica", "bold");
  doc.text("Customer / Pharmacy:", leftX, leftY);
  doc.setFont("helvetica", "normal");
  doc.text(order.customerName || "WALK-IN / COUNTER PHARMACY", leftX + 31, leftY);

  leftY += 3.8;
  doc.setFont("helvetica", "bold");
  doc.text("Customer Code:", leftX, leftY);
  doc.setFont("helvetica", "normal");
  doc.text(order.customerCode || "---", leftX + 31, leftY);

  leftY += 3.8;
  doc.setFont("helvetica", "bold");
  doc.text("Address & City:", leftX, leftY);
  doc.setFont("helvetica", "normal");
  const addrStr = [order.customerAddress, order.customerCity].filter(Boolean).join(", ") || "---";
  doc.text(addrStr.length > 40 ? addrStr.substring(0, 38) + "..." : addrStr, leftX + 31, leftY);

  leftY += 3.8;
  doc.setFont("helvetica", "bold");
  doc.text("Lic. # / NTN:", leftX, leftY);
  doc.setFont("helvetica", "normal");
  const licNtnPhone = `${order.customerLicenseNo || "---"} / ${order.customerNtn || "---"}${order.customerPhone ? "  |  Ph: " + order.customerPhone : ""}`;
  doc.text(licNtnPhone.length > 44 ? licNtnPhone.substring(0, 42) + "..." : licNtnPhone, leftX + 31, leftY);

  // Right Column - Order, Date & Salesman Details
  const rightX = midX + 2;
  let rightY = infoBoxY + 3.8;

  doc.setFont("helvetica", "bold");
  doc.text("Order No.:", rightX, rightY);
  doc.setFont("helvetica", "normal");
  doc.text(order.orderNumber || "ORD-0001", rightX + 21, rightY);

  rightY += 3.8;
  doc.setFont("helvetica", "bold");
  doc.text("Order Date:", rightX, rightY);
  doc.setFont("helvetica", "normal");
  doc.text(dtInfo.formattedDate, rightX + 21, rightY);

  rightY += 3.8;
  doc.setFont("helvetica", "bold");
  doc.text("Salesman:", rightX, rightY);
  doc.setFont("helvetica", "normal");
  doc.text(order.salesman || settings.defaultSalesman || "ADNAN", rightX + 21, rightY);

  rightY += 3.8;
  doc.setFont("helvetica", "bold");
  doc.text("Price List:", rightX, rightY);
  doc.setFont("helvetica", "normal");
  doc.text(order.priceListVersion || "Price List v1", rightX + 21, rightY);

  // --- ITEM TABLE HEADER ---
  currentY = infoBoxY + infoBoxHeight + 2.5;
  const headerHeight = 5;
  const rowHeight = 4.5;

  const drawTableHeader = (y: number) => {
    doc.setFillColor(240, 243, 248);
    doc.rect(margin, y, printableWidth, headerHeight, "FD");
    doc.setDrawColor(180, 185, 195);
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(30, 40, 60);

    let colX = margin;
    cols.forEach((col) => {
      let textX =
        colX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 1.5 : 1.5);
      doc.text(col.label, textX, y + 3.6, { align: col.align });
      colX += col.width;
      if (colX < margin + printableWidth) {
        doc.line(colX, y, colX, y + headerHeight);
      }
    });
  };

  drawTableHeader(currentY);
  currentY += headerHeight;

  // Render Page 1 rows (Max 30 items)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(20, 20, 20);

  let totalQty = 0;

  page1Items.forEach((item, index) => {
    const isEven = index % 2 === 1;
    if (isEven) {
      doc.setFillColor(250, 252, 255);
      doc.rect(margin, currentY, printableWidth, rowHeight, "F");
    }

    doc.rect(margin, currentY, printableWidth, rowHeight);

    const itemRate = Number(item.rate) || 0;
    const itemQty = Number(item.quantity) || 0;
    const gross = itemRate * itemQty;
    const net = item.amount !== undefined ? Number(item.amount) || 0 : gross;
    const discPercent = Number(item.disc2 || item.disc1 || 0);
    const prodName = String(item.productName || "Item");
    totalQty += itemQty;

    const values = [
      (index + 1).toString(),
      prodName.length > 44 ? prodName.substring(0, 42) + ".." : prodName,
      item.batch || "",
      itemRate.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      itemQty.toString(),
      (item.bon || 0).toString(),
      gross.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      discPercent > 0 ? discPercent.toFixed(2) : "0.00",
      net.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
    ];

    let rowX = margin;
    cols.forEach((col, cIdx) => {
      let textX =
        rowX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 1.5 : 1.5);
      doc.text(values[cIdx], textX, currentY + 3.3, { align: col.align });
      rowX += col.width;
      if (rowX < margin + printableWidth) {
        doc.line(rowX, currentY, rowX, currentY + rowHeight);
      }
    });

    currentY += rowHeight;
  });

  // If there's only 1 page (<= 30 items), render totals & footer on Page 1
  if (totalItems <= PAGE1_MAX_ITEMS) {
    // Fill empty rows if less than 6 items for clean structure
    const remainingRows = Math.max(0, 5 - totalItems);
    for (let r = 0; r < remainingRows; r++) {
      doc.rect(margin, currentY, printableWidth, rowHeight);
      let rX = margin;
      cols.forEach((col) => {
        rX += col.width;
        if (rX < margin + printableWidth) {
          doc.line(rX, currentY, rX, currentY + rowHeight);
        }
      });
      currentY += rowHeight;
    }

    renderTotalsAndFooter(doc, order, settings, currentY, margin, printableWidth, pageWidth, totalQty, dtInfo, 1, 1);
  } else {
    // Page 1 Continuation Footer (when items > 30)
    currentY += 3;
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, currentY, printableWidth, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175);
    doc.text(
      `--- CONTINUED ON PAGE 2 (Items 31 to ${totalItems}) ---`,
      pageWidth / 2,
      currentY + 4.8,
      { align: "center" }
    );

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page 1 of ${totalPages}`, pageWidth - margin - 3, pageHeight - 5, { align: "right" });
    doc.text(`Printed: ${dtInfo.fullDateTime}`, margin + 3, pageHeight - 5);

    // --- PAGE 2 (AND SUBSEQUENT PAGES) ---
    let remaining = [...remainingItems];
    let pageNum = 2;

    while (remaining.length > 0) {
      doc.addPage();
      currentY = margin;

      // Page Header for Page 2+
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, 12, "FD");

      if (settings.logoUrl) {
        try {
          doc.addImage(settings.logoUrl, margin + 2, currentY + 1, 10, 10);
        } catch (e) {
          console.warn("Could not embed logo on page 2", e);
        }
      }

      const pTitleX = settings.logoUrl ? margin + 15 : margin + 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 30, 45);
      doc.text(
        `${(settings.pharmacyName || "AK PHARMACY").toUpperCase()} - SALE ORDER / INVOICE (Page ${pageNum} of ${totalPages})`,
        pTitleX,
        currentY + 4.8
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(70, 80, 95);
      doc.text(
        `Order #: ${order.orderNumber}  |  Date: ${dtInfo.formattedDate}  |  Customer: ${order.customerName || "Counter Sale"}  |  Salesman: ${order.salesman || "ADNAN"}`,
        pTitleX,
        currentY + 9.2
      );

      currentY += 14;

      // Draw table header
      drawTableHeader(currentY);
      currentY += headerHeight;

      // Slice items for this page
      const currentBatch = remaining.slice(0, SUBSEQUENT_PAGE_MAX_ITEMS);
      remaining = remaining.slice(SUBSEQUENT_PAGE_MAX_ITEMS);

      currentBatch.forEach((item, bIdx) => {
        const globalIdx = PAGE1_MAX_ITEMS + (pageNum - 2) * SUBSEQUENT_PAGE_MAX_ITEMS + bIdx;
        const isEven = bIdx % 2 === 1;
        if (isEven) {
          doc.setFillColor(250, 252, 255);
          doc.rect(margin, currentY, printableWidth, rowHeight, "F");
        }

        doc.rect(margin, currentY, printableWidth, rowHeight);

        const itemRate = Number(item.rate) || 0;
        const itemQty = Number(item.quantity) || 0;
        const gross = itemRate * itemQty;
        const net = item.amount !== undefined ? Number(item.amount) || 0 : gross;
        const discPercent = Number(item.disc2 || item.disc1 || 0);
        const prodName = String(item.productName || "Item");
        totalQty += itemQty;

        const values = [
          (globalIdx + 1).toString(),
          prodName.length > 44 ? prodName.substring(0, 42) + ".." : prodName,
          item.batch || "",
          itemRate.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
          itemQty.toString(),
          (item.bon || 0).toString(),
          gross.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
          discPercent > 0 ? discPercent.toFixed(2) : "0.00",
          net.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
        ];

        let rowX = margin;
        cols.forEach((col, cIdx) => {
          let textX =
            rowX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 1.5 : 1.5);
          doc.text(values[cIdx], textX, currentY + 3.3, { align: col.align });
          rowX += col.width;
          if (rowX < margin + printableWidth) {
            doc.line(rowX, currentY, rowX, currentY + rowHeight);
          }
        });

        currentY += rowHeight;
      });

      // If last page, render Totals & Footer
      if (remaining.length === 0) {
        renderTotalsAndFooter(doc, order, settings, currentY, margin, printableWidth, pageWidth, totalQty, dtInfo, pageNum, totalPages);
      } else {
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 3, pageHeight - 5, { align: "right" });
        doc.text(`Printed: ${dtInfo.fullDateTime}`, margin + 3, pageHeight - 5);
      }

      pageNum++;
    }
  }
}

/**
 * Shared Totals & Summary Block + Signature Footer for Nafees / AK template
 */
function renderTotalsAndFooter(
  doc: jsPDF,
  order: Order,
  settings: PharmacySettings,
  startY: number,
  margin: number,
  printableWidth: number,
  pageWidth: number,
  totalQty: number,
  dtInfo: { formattedDate: string; formattedTime: string; fullDateTime: string },
  pageNum: number,
  totalPages: number
) {
  let currentY = startY + 2;
  const totalsBoxY = currentY;

  const prevPending = Number(order.previousPendingAmount) || 0;
  const paid = order.paidAmount !== undefined ? Number(order.paidAmount) : Number(order.grandTotal);
  const pending = order.pendingAmount !== undefined ? Number(order.pendingAmount) : Math.max(0, Number(order.grandTotal) - paid);
  const hasPending = pending > 0 || prevPending > 0;
  const totalsBoxHeight = hasPending ? 26 : 22;

  const totalPayable = Number(order.grandTotal) + prevPending;
  const netPending = pending + prevPending;
  const paymentStatus = order.paymentStatus || (netPending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");

  // Amount In Words & Payment Info Box (Left 56%)
  const wordsBoxWidth = printableWidth * 0.56;
  doc.rect(margin, totalsBoxY, wordsBoxWidth, totalsBoxHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(40, 50, 70);
  doc.text("Total Items:", margin + 3, totalsBoxY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${order.items.length} Lines  |  Total Qty: ${totalQty} Pcs`, margin + 20, totalsBoxY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.text("Payment Status:", margin + 3, totalsBoxY + 9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(paymentStatus === "Paid" ? 16 : paymentStatus === "Partial" ? 180 : 200, paymentStatus === "Paid" ? 130 : paymentStatus === "Partial" ? 100 : 30, paymentStatus === "Paid" ? 60 : 30);
  doc.text(
    `${paymentStatus.toUpperCase()} (${order.paymentMethod || "Cash"})${order.dueDate && netPending > 0 ? `  |  Due: ${order.dueDate}` : ""}`,
    margin + 26,
    totalsBoxY + 9
  );

  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 50, 70);
  doc.text("Amount in Words:", margin + 3, totalsBoxY + 14);
  doc.setFont("helvetica", "normal");
  const wordsText = convertRupeesToWords(order.grandTotal);
  doc.text(doc.splitTextToSize(wordsText, wordsBoxWidth - 6), margin + 3, totalsBoxY + 18.5);

  // Financial Breakdown Box (Right 44%)
  const financialBoxX = margin + wordsBoxWidth + 2;
  const financialBoxWidth = printableWidth - wordsBoxWidth - 2;
  doc.rect(financialBoxX, totalsBoxY, financialBoxWidth, totalsBoxHeight);

  const finLines: Array<{ label: string; val: string; bold?: boolean; alert?: boolean; highlight?: boolean }> = [
    { label: "Gross Amount:", val: `Rs. ${(Number(order.subtotal) || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}` },
    { label: "Discount / Tax:", val: `Rs. ${((Number(order.discount) || 0) > 0 ? `-${order.discount}` : "0.00")} / ${order.tax || 0}` },
  ];

  if (prevPending > 0) {
    finLines.push({
      label: "+ Prev Pending:",
      val: `Rs. ${prevPending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      bold: true,
    });
  }

  finLines.push({
    label: "Net Amount:",
    val: `Rs. ${(Number(order.grandTotal) || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    bold: true,
    highlight: true,
  });

  // ONLY show Paid and Pending Balance if pending amount was added / pending > 0
  if (pending > 0) {
    finLines.push({ label: "Paid / Received:", val: `Rs. ${paid.toLocaleString("en-PK", { minimumFractionDigits: 2 })}` });
    finLines.push({
      label: "Pending Balance:",
      val: `Rs. ${pending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      bold: true,
      alert: true,
    });
  }

  const stepY = totalsBoxHeight / (finLines.length + 0.8);
  let finY = totalsBoxY + stepY * 0.9;
  finLines.forEach((fl) => {
    doc.setFont("helvetica", fl.bold ? "bold" : "normal");
    doc.setFontSize(fl.highlight ? 7.2 : fl.bold ? 6.8 : 6.3);
    if (fl.alert) {
      doc.setTextColor(190, 20, 20);
    } else if (fl.highlight) {
      doc.setTextColor(15, 40, 120);
    } else if (fl.bold) {
      doc.setTextColor(10, 30, 80);
    } else {
      doc.setTextColor(50, 50, 50);
    }
    doc.text(fl.label, financialBoxX + 2, finY);
    doc.text(fl.val, financialBoxX + financialBoxWidth - 2, finY, { align: "right" });
    finY += stepY;
  });

  // --- FOOTER SECTION ---
  currentY = totalsBoxY + totalsBoxHeight + 2;
  const remarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  const splitRemarks = doc.splitTextToSize(remarksText, printableWidth - 18);
  const remarksLineCount = splitRemarks.length;
  const remarksBlockHeight = Math.max(7, remarksLineCount * 2.8 + 2.5);
  const footerBoxHeight = remarksBlockHeight + 7.5;

  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.2);
  doc.rect(margin, currentY, printableWidth, footerBoxHeight);

  // Remarks heading & text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(30, 40, 60);
  doc.text("Remark:", margin + 2.5, currentY + 3.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(45, 55, 72);
  doc.text(splitRemarks, margin + 14, currentY + 3.2);

  // Horizontal divider inside footer box
  const dividerY = currentY + remarksBlockHeight;
  doc.setDrawColor(215, 222, 232);
  doc.line(margin, dividerY, margin + printableWidth, dividerY);

  // Personnel, Date & Time, Signature line
  const line2Y = dividerY + 4.8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(40, 40, 40);
  doc.text("Prepared By:", margin + 2.5, line2Y);
  doc.setFont("helvetica", "normal");
  doc.text(settings.preparedBy || "ADNAN", margin + 19, line2Y);

  doc.setFont("helvetica", "bold");
  doc.text("Printed By:", margin + 44, line2Y);
  doc.setFont("helvetica", "normal");
  doc.text(settings.printedBy || "ADNAN", margin + 58, line2Y);

  doc.setFont("helvetica", "bold");
  doc.text("Date & Time:", margin + 83, line2Y);
  doc.setFont("helvetica", "normal");
  doc.text(dtInfo.fullDateTime, margin + 99, line2Y);

  doc.setFont("helvetica", "bold");
  doc.text("Authorized Signature: __________________", pageWidth - margin - 3, line2Y, { align: "right" });

  // Page number footer
  doc.setFontSize(6.8);
  doc.setTextColor(120, 130, 145);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 3, 297 - 4, { align: "right" });
  doc.text(`Generated on ${dtInfo.fullDateTime}`, margin + 3, 297 - 4);
}

/**
 * 2. SIMPLE ORDER LIST TEMPLATE
 */
function renderSimpleListTemplate(doc: jsPDF, order: Order, settings: PharmacySettings) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const printableWidth = pageWidth - margin * 2;
  const dtInfo = getFormattedDateTime(order.orderDate);

  const PAGE1_MAX_ITEMS = 30;
  const totalItems = order.items.length;
  const page1Items = order.items.slice(0, PAGE1_MAX_ITEMS);
  const remainingItems = order.items.slice(PAGE1_MAX_ITEMS);

  let currentY = margin;

  // Header
  let titleX = margin;
  if (settings.logoUrl) {
    try {
      doc.addImage(settings.logoUrl, margin, currentY, 12, 12);
      titleX = margin + 15;
    } catch (e) {
      console.warn("Could not embed logo in Simple List PDF", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(settings.pharmacyName || "AK Pharmacy", titleX, currentY + 4);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("PURCHASE ORDER SLIP", pageWidth - margin, currentY + 4, { align: "right" });

  currentY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Order #: ${order.orderNumber}  |  Date & Time: ${dtInfo.fullDateTime}  |  Customer: ${order.customerName}`,
    margin,
    currentY
  );

  currentY += 3;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Table
  currentY += 3;
  const colWidths = [10, 95, 25, 25, 35];
  const headers = ["#", "Product Description", "Qty", "Rate (PKR)", "Total (PKR)"];

  const drawSimpleHeader = (y: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, printableWidth, 5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    let hX = margin;
    headers.forEach((h, i) => {
      const align = i >= 2 ? "right" : i === 0 ? "center" : "left";
      const tX = hX + (align === "center" ? colWidths[i] / 2 : align === "right" ? colWidths[i] - 2 : 2);
      doc.text(h, tX, y + 3.6, { align });
      hX += colWidths[i];
    });
  };

  drawSimpleHeader(currentY);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  const simpleRowHeight = 4.6;

  page1Items.forEach((item, index) => {
    const isEven = index % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, simpleRowHeight, "F");
    }

    let rX = margin;
    const vals = [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      item.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
    ];

    vals.forEach((v, i) => {
      const align = i >= 2 ? "right" : i === 0 ? "center" : "left";
      const tX = rX + (align === "center" ? colWidths[i] / 2 : align === "right" ? colWidths[i] - 2 : 2);
      doc.text(v, tX, currentY + 3.4, { align });
      rX += colWidths[i];
    });

    currentY += simpleRowHeight;
  });

  // If more than 30 items, go to page 2
  if (remainingItems.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 64, 175);
    doc.text(`--- CONTINUED ON PAGE 2 (Items 31 to ${totalItems}) ---`, pageWidth / 2, currentY + 5, { align: "center" });

    doc.addPage();
    currentY = margin + 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`${settings.pharmacyName || "AK Pharmacy"} - Order #${order.orderNumber} (Page 2)`, margin, currentY);
    currentY += 5;

    drawSimpleHeader(currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    remainingItems.forEach((item, index) => {
      const isEven = index % 2 === 1;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, simpleRowHeight, "F");
      }

      let rX = margin;
      const vals = [
        (PAGE1_MAX_ITEMS + index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        item.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
        item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      ];

      vals.forEach((v, i) => {
        const align = i >= 2 ? "right" : i === 0 ? "center" : "left";
        const tX = rX + (align === "center" ? colWidths[i] / 2 : align === "right" ? colWidths[i] - 2 : 2);
        doc.text(v, tX, currentY + 3.4, { align });
        rX += colWidths[i];
      });

      currentY += simpleRowHeight;
    });
  }

  currentY += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - margin - 70, currentY, pageWidth - margin, currentY);

  currentY += 3.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Grand Total:", pageWidth - margin - 70, currentY);
  doc.text(`Rs. ${order.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, {
    align: "right",
  });

  currentY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(convertRupeesToWords(order.grandTotal), margin, currentY);

  currentY += 4.5;
  const remarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(30, 40, 60);
  doc.text("Remark:", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  const simpleRemarks = doc.splitTextToSize(remarksText, printableWidth - 14);
  doc.text(simpleRemarks, margin + 12, currentY);

  currentY += Math.max(5, simpleRemarks.length * 2.8 + 2.5);
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Printed: ${dtInfo.fullDateTime}`, margin, currentY);
}

/**
 * 3. PROFESSIONAL PURCHASE ORDER TEMPLATE
 */
function renderProfessionalPoTemplate(doc: jsPDF, order: Order, settings: PharmacySettings) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const printableWidth = pageWidth - margin * 2;
  const dtInfo = getFormattedDateTime(order.orderDate);

  const PAGE1_MAX_ITEMS = 30;
  const totalItems = order.items.length;
  const page1Items = order.items.slice(0, PAGE1_MAX_ITEMS);
  const remainingItems = order.items.slice(PAGE1_MAX_ITEMS);

  let currentY = margin;

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, printableWidth, 13, "F");

  let poTitleX = margin + 3;
  if (settings.logoUrl) {
    try {
      doc.addImage(settings.logoUrl, margin + 2, currentY + 1.5, 10, 10);
      poTitleX = margin + 15;
    } catch (e) {
      console.warn("Could not embed logo in PO PDF", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.pharmacyName || "AK PHARMACY SUPPLIES", poTitleX, currentY + 5.5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Official Commercial Purchase Order & Supply Dispatch", poTitleX, currentY + 9.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PURCHASE ORDER", pageWidth - margin - 3, currentY + 8, { align: "right" });

  currentY += 15;

  // Info Dual Box
  const halfW = (printableWidth - 3) / 2;
  const poInfoH = 17;
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, halfW, poInfoH);
  doc.rect(margin + halfW + 3, currentY, halfW, poInfoH);

  // Left Vendor/Issuer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("ISSUED BY / PHARMACY", margin + 2, currentY + 3.8);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.text(settings.pharmacyName || "AK Pharmacy", margin + 2, currentY + 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(settings.address || "Sahiwal Estate, Arif Road", margin + 2, currentY + 11);
  doc.text(`Tel: ${settings.phone || "040-4500933"}  |  Lic: ${settings.licenseNo || "02-367"}`, margin + 2, currentY + 14.5);

  // Right Recipient
  const rightBX = margin + halfW + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("PURCHASER / CLIENT", rightBX + 2, currentY + 3.8);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.text(order.customerName || "COUNTER SALE", rightBX + 2, currentY + 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`PO Number: ${order.orderNumber}  |  Date: ${dtInfo.formattedDate}`, rightBX + 2, currentY + 11);
  doc.text(`Sales Representative: ${order.salesman || "ADNAN"}`, rightBX + 2, currentY + 14.5);

  currentY += poInfoH + 3;

  // Items Table
  const pCols = [
    { label: "#", width: 8, align: "center" as const },
    { label: "Product Description", width: 92, align: "left" as const },
    { label: "Qty", width: 22, align: "center" as const },
    { label: "Unit Rate", width: 34, align: "right" as const },
    { label: "Line Total", width: 34, align: "right" as const },
  ];

  const drawPoHeader = (y: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, printableWidth, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);

    let phX = margin;
    pCols.forEach((col) => {
      let tX = phX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2 : 2);
      doc.text(col.label, tX, y + 3.6, { align: col.align });
      phX += col.width;
    });
  };

  drawPoHeader(currentY);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  const poRowHeight = 4.5;

  page1Items.forEach((item, index) => {
    const isEven = index % 2 === 1;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, poRowHeight, "F");
    }

    let prX = margin;
    const pVals = [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      `Rs. ${item.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      `Rs. ${item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    ];

    pVals.forEach((pv, idx) => {
      const col = pCols[idx];
      let tX = prX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2 : 2);
      doc.text(pv, tX, currentY + 3.3, { align: col.align });
      prX += col.width;
    });

    currentY += poRowHeight;
  });

  if (remainingItems.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 64, 175);
    doc.text(`--- CONTINUED ON PAGE 2 (Items 31 to ${totalItems}) ---`, pageWidth / 2, currentY + 5, { align: "center" });

    doc.addPage();
    currentY = margin + 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${settings.pharmacyName || "AK PHARMACY SUPPLIES"} - PO #${order.orderNumber} (Page 2)`, margin, currentY);
    currentY += 5;

    drawPoHeader(currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    remainingItems.forEach((item, index) => {
      const isEven = index % 2 === 1;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, poRowHeight, "F");
      }

      let prX = margin;
      const pVals = [
        (PAGE1_MAX_ITEMS + index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        `Rs. ${item.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
        `Rs. ${item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      ];

      pVals.forEach((pv, idx) => {
        const col = pCols[idx];
        let tX = prX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2 : 2);
        doc.text(pv, tX, currentY + 3.3, { align: col.align });
        prX += col.width;
      });

      currentY += poRowHeight;
    });
  }

  currentY += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `TOTAL AMOUNT: Rs. ${order.grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    pageWidth - margin,
    currentY,
    { align: "right" }
  );

  currentY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(convertRupeesToWords(order.grandTotal), margin, currentY);

  currentY += 4.5;
  const poRemarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(30, 40, 60);
  doc.text("Remark:", margin, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  const poRemarks = doc.splitTextToSize(poRemarksText, printableWidth - 14);
  doc.text(poRemarks, margin + 12, currentY);

  currentY += Math.max(5, poRemarks.length * 2.8 + 2.5);
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Printed: ${dtInfo.fullDateTime}`, margin, currentY);
}

/**
 * Generates an authoritative, multi-page professional PDF of the Master Inventory Price List & Stock Catalog
 */
export function generateInventoryPriceListPdf(
  products: Product[],
  version?: PriceListVersion | null,
  settings?: PharmacySettings | null,
  stockSummaries?: StockSummaryItem[]
): jsPDF {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeSettings = settings || DEFAULT_SETTINGS;
  const safeVersion = version || {
    id: "ver-1",
    versionName: "Price List v1",
    versionNumber: 1,
    effectiveDate: new Date().toISOString().split("T")[0],
    isCurrent: true,
    itemCount: safeProducts.length,
    products: safeProducts,
  };

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190
  const dtInfo = getFormattedDateTime();

  const stockMap = new Map<string, number>();
  if (stockSummaries && Array.isArray(stockSummaries)) {
    stockSummaries.forEach((s) => {
      if (s) {
        if (s.productId) stockMap.set(s.productId, Number(s.currentStock) || 0);
        if (s.productName) stockMap.set(s.productName.toLowerCase().trim(), Number(s.currentStock) || 0);
      }
    });
  }

  const renderHeader = (isFirstPage: boolean) => {
    // Pharmacy Banner Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, margin, contentWidth, isFirstPage ? 24 : 14, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isFirstPage ? 14 : 10);
    doc.text(safeSettings.pharmacyName || "AK PHARMACY", margin + 5, margin + (isFirstPage ? 7 : 6));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(isFirstPage ? 7.5 : 6.5);
    doc.setTextColor(203, 213, 225); // slate-300
    if (isFirstPage) {
      doc.text(`${safeSettings.address || "16, Sahiwal Estate, Arif Road, Sahiwal"} • Ph: ${safeSettings.phone || "040-4500933"}`, margin + 5, margin + 13);
      doc.text(`Lic. No: ${safeSettings.licenseNo || "Direct"} • NTN: ${safeSettings.ntn || "Direct"}`, margin + 5, margin + 18);
    } else {
      doc.text(`Master Inventory Catalog (Continued) • Ph: ${safeSettings.phone || "040-4500933"}`, margin + 5, margin + 10.5);
    }

    // Document Title Banner on right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isFirstPage ? 10 : 8);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text(
      isFirstPage ? "MASTER INVENTORY PRICE LIST" : `Catalog Continued`,
      pageWidth - margin - 5,
      margin + (isFirstPage ? 8 : 8),
      { align: "right" }
    );

    if (isFirstPage) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`${safeVersion?.versionName || "Catalog v1"} • ${safeProducts.length} Items`, pageWidth - margin - 5, margin + 14, { align: "right" });
      doc.text(`Printed: ${dtInfo.formattedDate} ${dtInfo.formattedTime}`, pageWidth - margin - 5, margin + 19, { align: "right" });
    }

    const y = margin + (isFirstPage ? 28 : 17);

    // Table Header Row
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, y, contentWidth, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    // Columns: #, Code, Product Name, Category, Stock, Purchase Rate (PKR), Sale Rate (PKR)
    doc.text("#", margin + 2, y + 5.5);
    doc.text("CODE", margin + 10, y + 5.5);
    doc.text("PRODUCT DESCRIPTION", margin + 34, y + 5.5);
    doc.text("CATEGORY", margin + 96, y + 5.5);
    doc.text("STOCK", margin + 130, y + 5.5, { align: "right" });
    doc.text("PURCHASE (PKR)", margin + 160, y + 5.5, { align: "right" });
    doc.text("SALE (PKR)", margin + contentWidth - 2, y + 5.5, { align: "right" });

    return y + 8;
  };

  let currentY = renderHeader(true);

  safeProducts.forEach((prod, index) => {
    // Check if new page needed
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = renderHeader(false);
    }

    // Row zebra background
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, currentY, contentWidth, 6.5, "F");
    }

    // Thin bottom line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.15);
    doc.line(margin, currentY + 6.5, margin + contentWidth, currentY + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85); // slate-700

    // Item #
    doc.text(String(index + 1), margin + 2, currentY + 4.5);

    // Product Code
    doc.setFont("courier", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    const codeStr = String(prod.productCode || `PRD-${String(index + 1).padStart(3, "0")}`).trim();
    doc.text(codeStr, margin + 10, currentY + 4.5);

    // Product Name (truncated safely)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.0);
    doc.setTextColor(15, 23, 42);
    const maxNameWidth = 58;
    const rawName = String(prod.name || "Unnamed Product").trim();
    const splitNames = doc.splitTextToSize(rawName, maxNameWidth);
    const truncatedName = splitNames && splitNames.length > 0 ? splitNames[0] : rawName;
    doc.text(truncatedName, margin + 34, currentY + 4.5);

    // Category (truncated safely)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const rawCat = String(prod.category || "General").trim();
    const splitCats = doc.splitTextToSize(rawCat, 25);
    const truncatedCat = splitCats && splitCats.length > 0 ? splitCats[0] : rawCat;
    doc.text(truncatedCat, margin + 96, currentY + 4.5);

    // Stock
    const pId = prod.id || "";
    const pNameNorm = (prod.name || "").toLowerCase().trim();
    const availStock = stockMap.get(pId) ?? stockMap.get(pNameNorm) ?? 0;
    doc.setFont("helvetica", availStock > 0 ? "bold" : "normal");
    doc.setFontSize(7);
    if (availStock <= 0) {
      doc.setTextColor(239, 68, 68); // red
      doc.text("0", margin + 130, currentY + 4.5, { align: "right" });
    } else {
      doc.setTextColor(16, 185, 129); // green
      doc.text(Number(availStock).toLocaleString(), margin + 130, currentY + 4.5, { align: "right" });
    }

    // Purchase Rate (PKR)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(4, 120, 87); // emerald-700
    const costPrice = prod.costPrice !== undefined ? prod.costPrice : Math.round(prod.price * 0.78);
    doc.text(
      `Rs. ${costPrice.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`,
      margin + 160,
      currentY + 4.5,
      { align: "right" }
    );

    // Sale / Master Rate (PKR)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42); // slate-900
    const pPrice = Number(prod.price) || 0;
    doc.text(
      `Rs. ${pPrice.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`,
      margin + contentWidth - 2,
      currentY + 4.5,
      { align: "right" }
    );

    currentY += 6.5;
  });

  // Final summary box on last page if space allows, else on bottom
  if (currentY > pageHeight - 25) {
    doc.addPage();
    currentY = renderHeader(false);
  }

  currentY += 4;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, currentY, contentWidth, 12, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 12, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`TOTAL CATALOG PRODUCTS: ${safeProducts.length} Items`, margin + 5, currentY + 5);
  const totalCatalogPrice = safeProducts.reduce((s, p) => s + (Number(p.price) || 0), 0);
  doc.text(
    `CUMULATIVE BASELINE VALUATION: Rs. ${totalCatalogPrice.toLocaleString("en-PK")}`,
    margin + contentWidth - 5,
    currentY + 5,
    { align: "right" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "All rates quoted in Pakistani Rupees (PKR). Subject to change in revised price list editions.",
    margin + 5,
    currentY + 9.5
  );

  // Accurate Two-Pass Page Numbering across all pages
  const totalDocPages = doc.internal.pages.length - 1;
  for (let pNum = 1; pNum <= totalDocPages; pNum++) {
    doc.setPage(pNum);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${pNum} of ${totalDocPages} • AK Pharmacy Master Inventory Catalog • Generated: ${dtInfo.fullDateTime}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  return doc;
}

/**
 * Generates an authentic, professional Price Quotation PDF
 */
export function generateQuotationPdf(
  quotation: Quotation,
  settings: PharmacySettings
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const isPurchaseRate = quotation.quotationRateType === "purchase_rate";

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, margin, contentWidth, 26, "F");

  // Pharmacy Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(settings.pharmacyName || "AK PHARMACY", margin + 5, margin + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${settings.address || "16, Sahiwal Estate, Arif Road, Sahiwal"} • Ph: ${settings.phone || "040-4500933"}`, margin + 5, margin + 14);
  doc.text(`Lic. No: ${settings.licenseNo || "Direct"} • NTN: ${settings.ntn || "Direct"}`, margin + 5, margin + 19.5);

  // Quotation Title & Number on Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(isPurchaseRate ? 251 : 56, isPurchaseRate ? 191 : 189, isPurchaseRate ? 36 : 248);
  doc.text("PRICE QUOTATION", pageWidth - margin - 5, margin + 8, { align: "right" });

  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`NO: ${quotation.quotationNumber}`, pageWidth - margin - 5, margin + 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date: ${quotation.quotationDate} • Valid Until: ${quotation.validUntil}`, pageWidth - margin - 5, margin + 20, { align: "right" });

  // Rate Basis Indicator Banner
  let y = margin + 28;
  doc.setFillColor(isPurchaseRate ? 254 : 236, isPurchaseRate ? 243 : 253, isPurchaseRate ? 199 : 245);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setDrawColor(isPurchaseRate ? 245 : 16, isPurchaseRate ? 158 : 185, isPurchaseRate ? 11 : 129);
  doc.rect(margin, y, contentWidth, 7, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(isPurchaseRate ? 146 : 6, isPurchaseRate ? 64 : 95, isPurchaseRate ? 14 : 70);
  doc.text(
    isPurchaseRate
      ? "* RATE BASIS: PURCHASE / COST RATE QUOTATION"
      : "* RATE BASIS: STANDARD SELLING RATE QUOTATION",
    margin + 4,
    y + 4.8
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    `Salesman: ${quotation.salesman || settings.defaultSalesman || "ADNAN"}`,
    pageWidth - margin - 4,
    y + 4.8,
    { align: "right" }
  );

  // Customer Details Block
  y += 9.5;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 16, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 16, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("QUOTATION PREPARED FOR:", margin + 3.5, y + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(quotation.customerName || "WALK-IN CUSTOMER", margin + 3.5, y + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${quotation.customerAddress ? quotation.customerAddress + ", " : ""}${quotation.customerCity || "Sahiwal"}${quotation.customerPhone ? " • Ph: " + quotation.customerPhone : ""}`,
    margin + 3.5,
    y + 13.5
  );

  if (quotation.subject) {
    doc.setFont("helvetica", "bold");
    doc.text(`Subject: ${quotation.subject}`, pageWidth - margin - 4, y + 9.5, { align: "right" });
  }

  // Items Table Header
  y += 18.5;
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("#", margin + 3, y + 4.8);
  doc.text("CODE", margin + 12, y + 4.8);
  doc.text("ITEM DESCRIPTION & SPECS", margin + 36, y + 4.8);
  doc.text("QTY", margin + 126, y + 4.8, { align: "right" });
  doc.text("UNIT RATE", margin + 155, y + 4.8, { align: "right" });
  doc.text("NET AMOUNT", margin + contentWidth - 3, y + 4.8, { align: "right" });

  y += 7;

  quotation.items.forEach((item, idx) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin + 10;
    }

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 6.5, "F");
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(String(idx + 1), margin + 3, y + 4.5);

    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.text(item.productCode || `ITM-${idx + 1}`, margin + 12, y + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(item.productName, margin + 36, y + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.text(item.quantity.toLocaleString(), margin + 126, y + 4.5, { align: "right" });

    doc.text(`Rs. ${item.rate.toLocaleString()}`, margin + 155, y + 4.5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${item.amount.toLocaleString()}`, margin + contentWidth - 3, y + 4.5, { align: "right" });

    y += 6.5;
  });

  // Grand Total & Terms Box
  y += 3;
  if (y > pageHeight - 45) {
    doc.addPage();
    y = margin + 10;
  }

  // Summary box
  doc.setFillColor(241, 245, 249);
  doc.rect(pageWidth - margin - 75, y, 75, 22, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(pageWidth - margin - 75, y, 75, 22, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal:", pageWidth - margin - 70, y + 5);
  doc.text(`Rs. ${quotation.subtotal.toLocaleString()}`, pageWidth - margin - 4, y + 5, { align: "right" });

  if (quotation.discount > 0) {
    doc.text("Discount:", pageWidth - margin - 70, y + 9.5);
    doc.text(`- Rs. ${quotation.discount.toLocaleString()}`, pageWidth - margin - 4, y + 9.5, { align: "right" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("GRAND TOTAL:", pageWidth - margin - 70, y + 16);
  doc.text(`Rs. ${quotation.grandTotal.toLocaleString()}`, pageWidth - margin - 4, y + 16, { align: "right" });

  // Amount in words and Terms
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total in Words: ${quotation.grandTotalInWords}`, margin, y + 5);
  doc.text(`Terms & Conditions: ${quotation.termsConditions || "Prices valid for 15 days from issue date."}`, margin, y + 10);
  if (quotation.notes) {
    doc.text(`Notes: ${quotation.notes}`, margin, y + 15);
  }

  // Signature Line
  y += 28;
  doc.setDrawColor(148, 163, 184);
  doc.line(pageWidth - margin - 50, y, pageWidth - margin, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("Authorized Signature & Stamp", pageWidth - margin - 25, y + 4, { align: "center" });

  return doc;
}

/**
 * Generates an official Payment Receiving Receipt PDF for a Daily Recovery record
 * Supports both 'voucher' (A4 Dual Copy) and 'slip' (80mm Compact Thermal Slip)
 */
export function generateRecoveryReceiptPdf(
  recovery: RecoveryRecord,
  settings: PharmacySettings,
  layoutMode: "voucher" | "slip" = "voucher"
): jsPDF {
  if (layoutMode === "slip") {
    return generateCompactRecoverySlipPdf(recovery, settings);
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const currency = settings.currencySymbol || "Rs.";

  const renderReceiptCopy = (startY: number, copyLabel: string) => {
    let y = startY;

    // Outer Voucher Border
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 128, 2, 2, "S");

    // Top Header Band
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 21, "F");

    if (settings.logoUrl) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin + 3, y + 2.5, 16, 16, 1.5, 1.5, "F");
        doc.addImage(settings.logoUrl, margin + 4, y + 3.5, 14, 14);
      } catch {
        // Ignore logo embed issues
      }
    }

    const titleX = settings.logoUrl ? margin + 23 : margin + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text((settings.pharmacyName || DEFAULT_SETTINGS.pharmacyName).toUpperCase(), titleX, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(settings.address || DEFAULT_SETTINGS.address, titleX, y + 13);
    doc.text(
      `Tel: ${settings.phone || DEFAULT_SETTINGS.phone}  |  Lic: ${settings.licenseNo || DEFAULT_SETTINGS.licenseNo}`,
      titleX,
      y + 17.5
    );

    // Right Badge in Header
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(pageWidth - margin - 52, y + 3.5, 48, 8.5, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("RECEIVING RECEIPT", pageWidth - margin - 28, y + 9, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(copyLabel, pageWidth - margin - 28, y + 16.5, { align: "center" });

    y += 24;

    // Receipt Metadata Row
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 4, y, contentWidth - 8, 11, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.rect(margin + 4, y, contentWidth - 8, 11, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Receipt No: ${recovery.receiptNumber}`, margin + 8, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const timeStr = recovery.recoveryTime ? `  (${recovery.recoveryTime})` : "";
    doc.text(`Date: ${recovery.recoveryDate}${timeStr}`, pageWidth / 2 - 12, y + 7);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(`Mode: ${recovery.paymentMethod}`, pageWidth - margin - 8, y + 7, { align: "right" });

    y += 15;

    // Two Columns: Received From + Account Balance Box
    const leftW = 98;
    const rightX = margin + 4 + leftW + 4;
    const rightW = contentWidth - 8 - leftW - 4;

    // Left Box: Customer Info
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 4, y, leftW, 38, 1.5, 1.5, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("RECEIVED WITH THANKS FROM", margin + 8, y + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(recovery.customerName || "Walk-In Customer", margin + 8, y + 12, { maxWidth: leftW - 8 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    const metaLines: string[] = [];
    if (recovery.customerCode) metaLines.push(`Code: ${recovery.customerCode}`);
    if (recovery.customerPhone) metaLines.push(`Phone: ${recovery.customerPhone}`);
    if (recovery.customerAddress || recovery.customerCity) {
      metaLines.push(
        `Address: ${[recovery.customerAddress, recovery.customerCity].filter(Boolean).join(", ")}`
      );
    }
    if (recovery.linkedOrderNumber) metaLines.push(`Against Invoice: ${recovery.linkedOrderNumber}`);
    if (recovery.referenceNo) metaLines.push(`Ref / TXN / Cheque #: ${recovery.referenceNo}`);
    if (recovery.receivedBy) metaLines.push(`Paid By / Rep: ${recovery.receivedBy}`);

    let metaY = y + 18;
    metaLines.slice(0, 4).forEach((line) => {
      doc.text(line, margin + 8, metaY, { maxWidth: leftW - 8 });
      metaY += 4.6;
    });

    // Right Box: Balance Summary
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(rightX, y, rightW, 38, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    doc.text("Previous Pending:", rightX + 4, y + 7);
    doc.text(`${currency} ${Number(recovery.previousDue || 0).toLocaleString("en-PK")}`, rightX + rightW - 4, y + 7, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(5, 150, 105);
    doc.text("Amount Received:", rightX + 4, y + 15);
    doc.text(`${currency} ${Number(recovery.recoveredAmount || 0).toLocaleString("en-PK")}`, rightX + rightW - 4, y + 15, { align: "right" });

    let nextBalanceY = y + 21;
    if ((recovery.discountOrAdjustment || 0) > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      doc.setTextColor(71, 85, 105);
      doc.text("Discount / Adj:", rightX + 4, nextBalanceY);
      doc.text(`- ${currency} ${Number(recovery.discountOrAdjustment || 0).toLocaleString("en-PK")}`, rightX + rightW - 4, nextBalanceY, { align: "right" });
      nextBalanceY += 6;
    }

    doc.setDrawColor(167, 243, 208);
    doc.line(rightX + 4, nextBalanceY - 1.5, rightX + rightW - 4, nextBalanceY - 1.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(recovery.remainingDue > 0 ? 180 : 15, recovery.remainingDue > 0 ? 83 : 23, recovery.remainingDue > 0 ? 9 : 42);
    doc.text("Remaining Due:", rightX + 4, nextBalanceY + 4.5);
    doc.text(
      recovery.remainingDue > 0
        ? `${currency} ${Number(recovery.remainingDue).toLocaleString("en-PK")}`
        : `${currency} 0 (Settled)`,
      rightX + rightW - 4,
      nextBalanceY + 4.5,
      { align: "right" }
    );

    y += 42;

    // Amount in Words Bar
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 4, y, contentWidth - 8, 12, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Amount in Words:", margin + 8, y + 5);
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const words = recovery.amountInWords || convertRupeesToWords(Number(recovery.recoveredAmount) || 0);
    doc.text(words, margin + 8, y + 9.8, { maxWidth: contentWidth - 16 });

    y += 15;

    // Notes if any
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Remarks: ${recovery.notes ? recovery.notes : "Payment received with thanks and credited to customer account."}`,
      margin + 4,
      y + 3,
      { maxWidth: contentWidth - 8 }
    );

    // Signatures at bottom of voucher
    const sigY = startY + 114;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(margin + 10, sigY, margin + 62, sigY);
    doc.line(pageWidth - margin - 62, sigY, pageWidth - margin - 10, sigY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Collected By: ${recovery.collectedBy || settings.defaultSalesman || "Staff"}`, margin + 36, sigY + 4.5, { align: "center" });
    doc.text("Customer / Receiver Signature", pageWidth - margin - 36, sigY + 4.5, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated by ${settings.pharmacyName || "AK Pharmacy"} on ${getFormattedDateTime().fullDateTime}`,
      pageWidth / 2,
      startY + 124.5,
      { align: "center" }
    );
  };

  // Customer Copy on Top Half & Office Copy on Bottom Half of A4
  renderReceiptCopy(12, "CUSTOMER COPY");

  // Perforation Cut Line
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, 148.5, pageWidth - margin, 148.5);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("✂ Cut Here / Perforated Line", pageWidth / 2, 147.2, { align: "center" });

  renderReceiptCopy(156, "OFFICE / RECORD COPY");

  return doc;
}

/**
 * Generates an 80mm thermal / POS Compact Receiving Receipt Slip PDF
 */
function generateCompactRecoverySlipPdf(
  recovery: RecoveryRecord,
  settings: PharmacySettings
): jsPDF {
  const slipWidth = 80;
  const margin = 5;
  const contentWidth = slipWidth - margin * 2;
  const currency = settings.currencySymbol || "Rs.";

  // Pre-measure wrapped lines using temporary doc
  const measureDoc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 200],
  });
  measureDoc.setFont("helvetica", "normal");
  measureDoc.setFontSize(7.5);
  const addressLines: string[] = measureDoc.splitTextToSize(
    settings.address || DEFAULT_SETTINGS.address,
    contentWidth
  );
  const words = recovery.amountInWords || convertRupeesToWords(Number(recovery.recoveredAmount) || 0);
  measureDoc.setFontSize(7.5);
  const wordLines: string[] = measureDoc.splitTextToSize(words, contentWidth - 4);
  const noteLines: string[] = recovery.notes
    ? measureDoc.splitTextToSize(`Note: ${recovery.notes}`, contentWidth - 4)
    : [];

  const estimatedHeight = Math.max(
    132,
    102 +
      addressLines.length * 3.5 +
      wordLines.length * 3.6 +
      (noteLines.length > 0 ? noteLines.length * 3.6 + 6 : 0) +
      (recovery.referenceNo ? 4.5 : 0) +
      (recovery.linkedOrderNumber ? 4.5 : 0) +
      ((recovery.discountOrAdjustment || 0) > 0 ? 5 : 0)
  );

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [slipWidth, estimatedHeight],
  });

  let y = 7;

  // Store Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text((settings.pharmacyName || DEFAULT_SETTINGS.pharmacyName).toUpperCase(), slipWidth / 2, y, {
    align: "center",
    maxWidth: contentWidth,
  });
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  addressLines.forEach((line) => {
    doc.text(line, slipWidth / 2, y, { align: "center" });
    y += 3.3;
  });
  doc.text(`Tel: ${settings.phone || DEFAULT_SETTINGS.phone}`, slipWidth / 2, y, {
    align: "center",
  });
  y += 4;

  // Slip Badge
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin + 12, y, contentWidth - 24, 6, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("RECEIVING RECEIPT", slipWidth / 2, y + 4.1, { align: "center" });
  y += 8.5;

  const drawDashedSep = (lineY: number) => {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(margin, lineY, slipWidth - margin, lineY);
    doc.setLineDashPattern([], 0);
  };

  drawDashedSep(y);
  y += 4;

  // Metadata rows
  const drawKv = (label: string, value: string, boldVal = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y);
    doc.setFont("helvetica", boldVal ? "bold" : "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(value, slipWidth - margin, y, { align: "right", maxWidth: 44 });
    y += 4.2;
  };

  drawKv("Receipt #:", recovery.receiptNumber, true);
  drawKv(
    "Date:",
    `${recovery.recoveryDate}${recovery.recoveryTime ? ` ${recovery.recoveryTime}` : ""}`
  );
  drawKv("Mode:", recovery.paymentMethod, true);
  if (recovery.referenceNo) drawKv("Ref #:", recovery.referenceNo);

  drawDashedSep(y);
  y += 4;

  // Customer info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text("RECEIVED FROM", margin, y);
  y += 3.8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(recovery.customerName || "Walk-In Customer", margin, y, { maxWidth: contentWidth });
  y += 4.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  if (recovery.customerPhone) {
    doc.text(`Ph: ${recovery.customerPhone}`, margin, y);
    y += 3.8;
  }
  if (recovery.linkedOrderNumber) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(`Invoice: ${recovery.linkedOrderNumber}`, margin, y);
    y += 4;
  }

  drawDashedSep(y);
  y += 4.5;

  // Amounts
  drawKv(
    "Previous Due:",
    `${currency} ${Number(recovery.previousDue || 0).toLocaleString("en-PK")}`
  );

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, y - 3.2, contentWidth, 7.5, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text("RECEIVED:", margin + 2, y + 1.8);
  doc.text(
    `${currency} ${Number(recovery.recoveredAmount || 0).toLocaleString("en-PK")}`,
    slipWidth - margin - 2,
    y + 1.8,
    { align: "right" }
  );
  y += 7.5;

  if ((recovery.discountOrAdjustment || 0) > 0) {
    drawKv(
      "Discount/Adj:",
      `- ${currency} ${Number(recovery.discountOrAdjustment).toLocaleString("en-PK")}`
    );
  }

  drawKv(
    "Remaining Due:",
    recovery.remainingDue > 0
      ? `${currency} ${Number(recovery.remainingDue).toLocaleString("en-PK")}`
      : `${currency} 0 (Settled)`,
    true
  );

  drawDashedSep(y);
  y += 4;

  // Amount in words
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  wordLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 3.4;
  });

  if (noteLines.length > 0) {
    y += 1.5;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 2.5, contentWidth, noteLines.length * 3.5 + 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    noteLines.forEach((line) => {
      doc.text(line, margin + 1.5, y + 0.5);
      y += 3.5;
    });
    y += 2;
  }

  y += 2;
  drawDashedSep(y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(5, 150, 105);
  doc.text("Payment Verified & Recorded", slipWidth / 2, y, { align: "center" });
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Collected By: ${recovery.collectedBy || settings.defaultSalesman || "Staff"}`,
    slipWidth / 2,
    y,
    { align: "center" }
  );
  y += 4;

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Printed: ${getFormattedDateTime().fullDateTime}`, slipWidth / 2, y, {
    align: "center",
  });

  return doc;
}

function sanitizeExportFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || `PharmaFlow_${Date.now()}`;
}

async function saveAndShareNativeBase64(base64Data: string, safeName: string): Promise<boolean> {
  let savedToDocuments = false;
  try {
    await Filesystem.writeFile({
      path: `PharmaFlow/${safeName}`,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
    savedToDocuments = true;
  } catch (docErr) {
    console.warn("Could not write to Documents/PharmaFlow, continuing with Cache share:", docErr);
  }

  await Filesystem.writeFile({
    path: safeName,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    directory: Directory.Cache,
    path: safeName,
  });

  try {
    await Share.share({
      title: safeName,
      files: [uri],
      dialogTitle: "Save or Share File",
    });
    return true;
  } catch (shareErr) {
    const msg = shareErr instanceof Error ? shareErr.message : String(shareErr);
    if (savedToDocuments || /cancel/i.test(msg)) {
      return true;
    }
    throw shareErr;
  }
}

/**
 * Safely triggers download of a jsPDF document on Web and Capacitor Android APKs
 */
export async function downloadPdfSafely(doc: jsPDF, filename: string): Promise<boolean> {
  const safeName = sanitizeExportFilename(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);

  if (Capacitor.isNativePlatform()) {
    try {
      const dataUri = doc.output("datauristring");
      const base64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;
      return await saveAndShareNativeBase64(base64, safeName);
    } catch (nativeErr) {
      console.error("Native Capacitor PDF export failed:", nativeErr);
      return false;
    }
  }

  try {
    doc.save(safeName);
    return true;
  } catch (err) {
    console.warn("doc.save() direct call failed, triggering Blob URL fallback:", err);
    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);
      return true;
    } catch (fallbackErr) {
      console.error("All PDF download mechanisms failed:", fallbackErr);
      return false;
    }
  }
}

/**
 * Safely exports UTF-8 text files (CSV / JSON) on both Web browsers and Capacitor Android APKs
 */
export async function downloadTextFileSafely(
  content: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
): Promise<boolean> {
  const safeName = sanitizeExportFilename(filename);

  if (Capacitor.isNativePlatform()) {
    let savedToDocuments = false;
    try {
      await Filesystem.writeFile({
        path: `PharmaFlow/${safeName}`,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      savedToDocuments = true;
    } catch (docErr) {
      console.warn("Could not write text file to Documents/PharmaFlow:", docErr);
    }

    try {
      await Filesystem.writeFile({
        path: safeName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      const { uri } = await Filesystem.getUri({
        directory: Directory.Cache,
        path: safeName,
      });

      try {
        await Share.share({
          title: safeName,
          files: [uri],
          dialogTitle: "Save or Share File",
        });
        return true;
      } catch (shareErr) {
        const msg = shareErr instanceof Error ? shareErr.message : String(shareErr);
        if (savedToDocuments || /cancel/i.test(msg)) {
          return true;
        }
        throw shareErr;
      }
    } catch (nativeErr) {
      console.error("Native Capacitor text export failed:", nativeErr);
      return false;
    }
  }

  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.error("Text file download failed:", err);
    return false;
  }
}

/**
 * Safely exports base64 binary files (e.g., XLSX spreadsheets) on Web and Capacitor Android APKs
 */
export async function downloadBinaryBase64Safely(
  base64Data: string,
  filename: string,
  mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
): Promise<boolean> {
  const safeName = sanitizeExportFilename(filename);

  if (Capacitor.isNativePlatform()) {
    try {
      return await saveAndShareNativeBase64(base64Data, safeName);
    } catch (nativeErr) {
      console.error("Native Capacitor binary export failed:", nativeErr);
      return false;
    }
  }

  try {
    const byteChars = atob(base64Data);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  } catch (err) {
    console.error("Binary file download failed:", err);
    return false;
  }
}

/**
 * Generates an object URL for the PDF for viewing in modal iframe or new tab
 */
export function getPdfBlobUrl(doc: jsPDF): string {
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
