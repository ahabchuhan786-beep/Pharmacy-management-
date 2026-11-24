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
 * Shared footer pagination stamp helper across all invoice templates
 */
function stampInvoicePageNumbers(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  fullDateTime: string
) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Printed: ${fullDateTime}`, margin, pageHeight - 5);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    doc.text("PharmaFlow Invoice", pageWidth - margin, pageHeight - 5, { align: "right" });
  }
}

/**
 * 1. NAFEES / AK PHARMACY INVOICE TEMPLATE
 * Centered, large-text A4 layout with dynamic row wrapping and height-aware pagination:
 * [# | Item Description | Batch | Rate | Qty | Bon | Gross | Disc % | Net Amt]
 */
function renderNafeesAkInvoiceTemplate(doc: jsPDF, order: Order, settings: PharmacySettings) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const printableWidth = pageWidth - margin * 2; // 190mm (strictly centered on 210mm A4)
  const dtInfo = getFormattedDateTime(order.orderDate);
  const maxPageBottom = pageHeight - 13;

  // 9 columns summing strictly to 190mm
  const cols = [
    { label: "#", width: 9, align: "center" as const },
    { label: "Item Description", width: 68, align: "left" as const },
    { label: "Batch", width: 16, align: "center" as const },
    { label: "Rate", width: 19, align: "right" as const },
    { label: "Qty", width: 13, align: "center" as const },
    { label: "Bon", width: 11, align: "center" as const },
    { label: "Gross", width: 20, align: "right" as const },
    { label: "Disc %", width: 13, align: "right" as const },
    { label: "Net Amt", width: 21, align: "right" as const },
  ];

  let currentY = margin;

  // --- PAGE 1: CENTERED HEADER SECTION ---
  if (settings.logoUrl) {
    try {
      const logoSize = 18;
      doc.addImage(settings.logoUrl, (pageWidth - logoSize) / 2, currentY, logoSize, logoSize);
      currentY += logoSize + 2.5;
    } catch (e) {
      console.warn("Could not embed logo in PDF", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text((settings.pharmacyName || "AK PHARMACY").toUpperCase(), pageWidth / 2, currentY + 4, {
    align: "center",
    baseline: "middle",
  });
  currentY += 8.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  const addrLines = doc.splitTextToSize(
    settings.address || "16, Sahiwal Estate, Arif Road, Sahiwal",
    printableWidth - 10
  );
  addrLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, currentY, { align: "center", baseline: "middle" });
    currentY += 4.5;
  });

  const contactLine = `Phone: ${settings.phone || "040-4500933, 34"}  |  Lic. No.: ${
    settings.licenseNo || "02-367-0154-110890D"
  }  |  NTN #: ${settings.ntn || "3159783-1"}`;
  doc.setFontSize(8.8);
  const contactLines = doc.splitTextToSize(contactLine, printableWidth - 6);
  contactLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, currentY, { align: "center", baseline: "middle" });
    currentY += 4.2;
  });

  currentY += 1;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Centered Title Pill
  currentY += 3;
  const badgeW = 68;
  const badgeH = 7.5;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.roundedRect((pageWidth - badgeW) / 2, currentY, badgeW, badgeH, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("SALE ORDER / INVOICE", pageWidth / 2, currentY + badgeH / 2, {
    align: "center",
    baseline: "middle",
  });

  // --- CUSTOMER & ORDER INFO GRID ---
  currentY += badgeH + 3.5;
  const infoBoxY = currentY;
  const midX = margin + printableWidth * 0.56;
  const leftValMaxW = printableWidth * 0.56 - 35;
  const rightValMaxW = printableWidth * 0.44 - 28;

  doc.setFontSize(8.8);
  const custNameText = order.customerName || "WALK-IN / COUNTER PHARMACY";
  const addrStr = [order.customerAddress, order.customerCity].filter(Boolean).join(", ") || "---";
  const licNtnPhone = `${order.customerLicenseNo || "---"} / ${order.customerNtn || "---"}${
    order.customerPhone ? " | Ph: " + order.customerPhone : ""
  }`;

  doc.setFont("helvetica", "normal");
  const custLines = doc.splitTextToSize(custNameText, leftValMaxW);
  const addrBoxLines = doc.splitTextToSize(addrStr, leftValMaxW);
  const licLines = doc.splitTextToSize(licNtnPhone, leftValMaxW);
  const priceLines = doc.splitTextToSize(order.priceListVersion || "Price List v1", rightValMaxW);

  const linePitch = 4.6;
  const leftContentLines = Math.max(1, custLines.length) + 1 + Math.max(1, addrBoxLines.length) + Math.max(1, licLines.length);
  const rightContentLines = 3 + Math.max(1, priceLines.length);
  const infoBoxHeight = Math.max(leftContentLines, rightContentLines) * linePitch + 5;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(margin, infoBoxY, printableWidth, infoBoxHeight);
  doc.line(midX, infoBoxY, midX, infoBoxY + infoBoxHeight);

  // Left Column - Customer Details
  const leftX = margin + 3;
  const leftValX = leftX + 29;
  let leftY = infoBoxY + 4.5;

  const drawInfoRow = (label: string, lines: string[], x: number, valX: number, yStart: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(51, 65, 85);
    doc.text(label, x, yStart, { baseline: "middle" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    lines.forEach((ln, idx) => {
      doc.text(ln, valX, yStart + idx * linePitch, { baseline: "middle" });
    });
    return yStart + Math.max(1, lines.length) * linePitch;
  };

  leftY = drawInfoRow("Customer:", custLines, leftX, leftValX, leftY);
  leftY = drawInfoRow("Cust. Code:", [order.customerCode || "---"], leftX, leftValX, leftY);
  leftY = drawInfoRow("Address:", addrBoxLines, leftX, leftValX, leftY);
  drawInfoRow("Lic. / NTN:", licLines, leftX, leftValX, leftY);

  // Right Column - Order, Date & Salesman Details
  const rightX = midX + 3;
  const rightValX = rightX + 23;
  let rightY = infoBoxY + 4.5;

  rightY = drawInfoRow("Order No.:", [order.orderNumber || "ORD-0001"], rightX, rightValX, rightY);
  rightY = drawInfoRow("Order Date:", [dtInfo.formattedDate], rightX, rightValX, rightY);
  rightY = drawInfoRow("Salesman:", [order.salesman || settings.defaultSalesman || "ADNAN"], rightX, rightValX, rightY);
  drawInfoRow("Price List:", priceLines, rightX, rightValX, rightY);

  // --- ITEM TABLE ---
  currentY = infoBoxY + infoBoxHeight + 3.5;
  const headerHeight = 7.5;
  const baseRowHeight = 6.5;

  const drawTableHeader = (y: number) => {
    doc.setFillColor(235, 240, 248);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, printableWidth, headerHeight, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    let colX = margin;
    cols.forEach((col) => {
      const textX =
        colX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2 : 2);
      doc.text(col.label, textX, y + headerHeight / 2, { align: col.align, baseline: "middle" });
      colX += col.width;
      if (colX < margin + printableWidth) {
        doc.line(colX, y, colX, y + headerHeight);
      }
    });
  };

  const drawContinuationHeader = (pageNumber: number) => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(margin, margin, printableWidth, 14, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${(settings.pharmacyName || "AK PHARMACY").toUpperCase()} — SALE ORDER / INVOICE (Cont. Pg ${pageNumber})`,
      pageWidth / 2,
      margin + 4.8,
      { align: "center", baseline: "middle" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Order #: ${order.orderNumber}   |   Date: ${dtInfo.formattedDate}   |   Customer: ${
        order.customerName || "Counter Sale"
      }`,
      pageWidth / 2,
      margin + 10.2,
      { align: "center", baseline: "middle" }
    );

    currentY = margin + 16.5;
    drawTableHeader(currentY);
    currentY += headerHeight;
  };

  drawTableHeader(currentY);
  currentY += headerHeight;

  let totalQty = 0;
  let pageCount = 1;

  order.items.forEach((item, index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const itemRate = Number(item.rate) || 0;
    const itemQty = Number(item.quantity) || 0;
    const gross = itemRate * itemQty;
    const net = item.amount !== undefined ? Number(item.amount) || 0 : gross;
    const discPercent = Number(item.disc2 || item.disc1 || 0);
    const prodName = String(item.productName || "Item");
    totalQty += itemQty;

    const wrappedName = doc.splitTextToSize(prodName, cols[1].width - 4);
    const thisRowHeight = Math.max(baseRowHeight, wrappedName.length * 4.2 + 2.4);

    // Reserve ~11mm at bottom of overflowing page for clean continuation banner
    if (currentY + thisRowHeight > maxPageBottom - 10) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, currentY + 2, printableWidth, 7, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(30, 64, 175);
      doc.text(
        `--- CONTINUED ON PAGE ${pageCount + 1} (Remaining ${order.items.length - index} items) ---`,
        pageWidth / 2,
        currentY + 5.5,
        { align: "center", baseline: "middle" }
      );

      doc.addPage();
      pageCount++;
      drawContinuationHeader(pageCount);
    }

    const isEven = index % 2 === 1;
    doc.setDrawColor(180, 188, 200);
    doc.setLineWidth(0.2);
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, thisRowHeight, "FD");
    } else {
      doc.rect(margin, currentY, printableWidth, thisRowHeight);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    const values: Array<string | string[]> = [
      (index + 1).toString(),
      wrappedName,
      item.batch || "-",
      itemRate.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      itemQty.toString(),
      (item.bon || 0).toString(),
      gross.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      discPercent > 0 ? discPercent.toFixed(2) : "0.00",
      net.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
    ];

    let rowX = margin;
    const rowMidY = currentY + thisRowHeight / 2;
    cols.forEach((col, cIdx) => {
      const textX =
        rowX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2 : 2);
      const val = values[cIdx];

      if (cIdx === 8) {
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFont("helvetica", "normal");
      }

      if (Array.isArray(val)) {
        const blockH = (val.length - 1) * 4.2;
        const firstLineY = rowMidY - blockH / 2;
        val.forEach((lineStr, lIdx) => {
          doc.text(lineStr, textX, firstLineY + lIdx * 4.2, { align: col.align, baseline: "middle" });
        });
      } else {
        doc.text(val, textX, rowMidY, { align: col.align, baseline: "middle" });
      }

      rowX += col.width;
      if (rowX < margin + printableWidth) {
        doc.setDrawColor(180, 188, 200);
        doc.line(rowX, currentY, rowX, currentY + thisRowHeight);
      }
    });

    currentY += thisRowHeight;
  });

  // Pad minimum rows when only a few items exist on Page 1 for balanced invoice frame
  if (pageCount === 1 && order.items.length < 5) {
    const emptyRows = 5 - order.items.length;
    for (let r = 0; r < emptyRows; r++) {
      if (currentY + baseRowHeight > maxPageBottom - 68) break;
      doc.setDrawColor(180, 188, 200);
      doc.rect(margin, currentY, printableWidth, baseRowHeight);
      let rX = margin;
      cols.forEach((col) => {
        rX += col.width;
        if (rX < margin + printableWidth) {
          doc.line(rX, currentY, rX, currentY + baseRowHeight);
        }
      });
      currentY += baseRowHeight;
    }
  }

  // Estimate totals + footer height; move cleanly to new page if insufficient room
  const estTotalsH = 36;

  const remarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const splitRemarks = doc.splitTextToSize(remarksText, printableWidth - 22);
  const estRemarksH = Math.max(11, splitRemarks.length * 3.8 + 5);
  const estFooterH = estRemarksH + 14;
  const totalSummaryHeight = 3 + estTotalsH + 3 + estFooterH;

  if (currentY + totalSummaryHeight > maxPageBottom) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, currentY + 2, printableWidth, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.setTextColor(30, 64, 175);
    doc.text(
      `--- SUMMARY & TOTALS CONTINUED ON PAGE ${pageCount + 1} ---`,
      pageWidth / 2,
      currentY + 5.5,
      { align: "center", baseline: "middle" }
    );

    doc.addPage();
    pageCount++;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(148, 163, 184);
    doc.rect(margin, margin, printableWidth, 14, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${(settings.pharmacyName || "AK PHARMACY").toUpperCase()} — INVOICE SUMMARY (Pg ${pageCount})`,
      pageWidth / 2,
      margin + 5,
      { align: "center", baseline: "middle" }
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Order #: ${order.orderNumber}   |   Date: ${dtInfo.formattedDate}   |   Customer: ${order.customerName || "Counter Sale"}`,
      pageWidth / 2,
      margin + 10.2,
      { align: "center", baseline: "middle" }
    );
    currentY = margin + 17;
  }

  renderTotalsAndFooter(doc, order, settings, currentY, margin, printableWidth, pageWidth, totalQty, dtInfo);
  stampInvoicePageNumbers(doc, margin, pageWidth, pageHeight, dtInfo.fullDateTime);
}

/**
 * Shared Totals & Summary Block + Centered 4-Column Signature Footer
 */
function renderTotalsAndFooter(
  doc: jsPDF,
  order: Order,
  settings: PharmacySettings,
  startY: number,
  margin: number,
  printableWidth: number,
  _pageWidth: number,
  totalQty: number,
  dtInfo: { formattedDate: string; formattedTime: string; fullDateTime: string }
) {
  let currentY = startY + 3;
  const totalsBoxY = currentY;

  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount) || 0;
  const tax = Number(order.tax) || 0;
  const advanceTax = Number(order.advanceTax) || 0;
  const invoiceNetAmount = Math.max(0, subtotal - discount + tax + advanceTax);

  const prevPending = Number(order.previousPendingAmount) || 0;
  const totalBalance = invoiceNetAmount + prevPending;
  const paid = order.paidAmount !== undefined ? Number(order.paidAmount) : Number(order.grandTotal);
  const pending = order.pendingAmount !== undefined ? Number(order.pendingAmount) : Math.max(0, Number(order.grandTotal) - paid);

  const wordsBoxWidth = printableWidth * 0.55;
  const financialBoxX = margin + wordsBoxWidth + 2.5;
  const financialBoxWidth = printableWidth - wordsBoxWidth - 2.5;

  const wordsText = convertRupeesToWords(totalBalance);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const wrappedWords = doc.splitTextToSize(wordsText, wordsBoxWidth - 6);

  const totalsBoxHeight = Math.max(36, 21 + wrappedWords.length * 4.2);

  const paymentStatus = order.paymentStatus || (pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");

  // Left Box: Counts, Status & Amount in Words
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(margin, totalsBoxY, wordsBoxWidth, totalsBoxHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  doc.text("Total Items:", margin + 3, totalsBoxY + 5, { baseline: "middle" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`${order.items.length} Lines   |   Total Qty: ${totalQty} Pcs`, margin + 25, totalsBoxY + 5, {
    baseline: "middle",
  });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("Status:", margin + 3, totalsBoxY + 10.2, { baseline: "middle" });
  doc.setTextColor(
    paymentStatus === "Paid" ? 16 : paymentStatus === "Partial" ? 180 : 200,
    paymentStatus === "Paid" ? 130 : paymentStatus === "Partial" ? 100 : 30,
    paymentStatus === "Paid" ? 60 : 30
  );
  doc.text(
    `${paymentStatus.toUpperCase()} (${order.paymentMethod || "Cash"})${
      order.dueDate && pending > 0 ? `  |  Due: ${order.dueDate}` : ""
    }`,
    margin + 25,
    totalsBoxY + 10.2,
    { baseline: "middle" }
  );

  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 3, totalsBoxY + 13.8, margin + wordsBoxWidth - 3, totalsBoxY + 13.8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Amount in Words:", margin + 3, totalsBoxY + 17.5, { baseline: "middle" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  wrappedWords.forEach((line: string, idx: number) => {
    doc.text(line, margin + 3, totalsBoxY + 22 + idx * 4.2, { baseline: "middle" });
  });

  // Right Box: Financial Breakdown
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.rect(financialBoxX, totalsBoxY, financialBoxWidth, totalsBoxHeight, "FD");

  const finLines: Array<{ label: string; val: string; bold?: boolean; alert?: boolean; highlight?: boolean }> = [
    { label: "Gross Amount:", val: `Rs. ${subtotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}` },
    { label: "Discount / Tax:", val: `Rs. ${discount > 0 ? `-${discount}` : "0.00"} / ${tax + advanceTax}` },
    {
      label: "Net Amount:",
      val: `Rs. ${invoiceNetAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      bold: true,
      highlight: true,
    },
    {
      label: "Previous Pending:",
      val: `Rs. ${prevPending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      bold: prevPending > 0,
    },
    {
      label: "Total Balance:",
      val: `Rs. ${totalBalance.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      bold: true,
      highlight: true,
    },
  ];

  const stepY = totalsBoxHeight / (finLines.length + 0.4);
  let finY = totalsBoxY + stepY * 0.7;
  finLines.forEach((fl) => {
    if (fl.highlight) {
      doc.setDrawColor(203, 213, 225);
      doc.line(financialBoxX + 2.5, finY - stepY * 0.45, financialBoxX + financialBoxWidth - 2.5, finY - stepY * 0.45);
    }
    doc.setFont("helvetica", fl.bold ? "bold" : "normal");
    doc.setFontSize(fl.highlight ? 10 : fl.bold ? 9 : 8.5);
    if (fl.alert) {
      doc.setTextColor(190, 20, 20);
    } else if (fl.highlight) {
      doc.setTextColor(15, 40, 120);
    } else if (fl.bold) {
      doc.setTextColor(15, 23, 42);
    } else {
      doc.setTextColor(51, 65, 85);
    }
    doc.text(fl.label, financialBoxX + 3, finY, { baseline: "middle" });
    doc.text(fl.val, financialBoxX + financialBoxWidth - 3, finY, { align: "right", baseline: "middle" });
    finY += stepY;
  });

  // --- FOOTER REMARKS & CENTERED 4-COLUMN SIGNATURE BAR ---
  currentY = totalsBoxY + totalsBoxHeight + 3;
  const remarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const splitRemarks = doc.splitTextToSize(remarksText, printableWidth - 22);
  const remarksBlockHeight = Math.max(11, splitRemarks.length * 3.8 + 5);
  const sigBarHeight = 14;
  const footerBoxHeight = remarksBlockHeight + sigBarHeight;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(margin, currentY, printableWidth, footerBoxHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);
  doc.text("Remark:", margin + 3, currentY + 4.5, { baseline: "middle" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  splitRemarks.forEach((line: string, idx: number) => {
    doc.text(line, margin + 19, currentY + 4.5 + idx * 3.8, { baseline: "middle" });
  });

  // Horizontal divider between remarks and 4-column personnel/signature bar
  const dividerY = currentY + remarksBlockHeight;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, dividerY, margin + printableWidth, dividerY);

  // Evenly divided 4 centered columns across printableWidth (each 47.5mm)
  const colW = printableWidth / 4;
  const labelY = dividerY + 4.5;
  const valY = dividerY + 9.8;

  const sigCols = [
    { title: "Prepared By", val: settings.preparedBy || "ADNAN" },
    { title: "Printed By", val: settings.printedBy || "ADNAN" },
    { title: "Date & Time", val: dtInfo.fullDateTime },
    { title: "Authorized Signature", val: "____________________" },
  ];

  sigCols.forEach((sc, idx) => {
    const colStart = margin + idx * colW;
    const colCenter = colStart + colW / 2;
    if (idx > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.line(colStart, dividerY, colStart, dividerY + sigBarHeight);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(sc.title, colCenter, labelY, { align: "center", baseline: "middle" });

    doc.setFont("helvetica", idx === 3 ? "normal" : "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sc.val, colCenter, valY, { align: "center", baseline: "middle" });
  });
}

/**
 * 2. SIMPLE ORDER LIST TEMPLATE (Centered & Enlarged Typography)
 */
function renderSimpleListTemplate(doc: jsPDF, order: Order, settings: PharmacySettings) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const printableWidth = pageWidth - margin * 2; // 190mm
  const dtInfo = getFormattedDateTime(order.orderDate);
  const maxPageBottom = pageHeight - 13;

  let currentY = margin;

  // Centered Header
  if (settings.logoUrl) {
    try {
      const logoSize = 16;
      doc.addImage(settings.logoUrl, (pageWidth - logoSize) / 2, currentY, logoSize, logoSize);
      currentY += logoSize + 2.5;
    } catch (e) {
      console.warn("Could not embed logo in Simple List PDF", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text((settings.pharmacyName || "AK Pharmacy").toUpperCase(), pageWidth / 2, currentY + 3.5, {
    align: "center",
    baseline: "middle",
  });
  currentY += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text("PURCHASE ORDER SLIP", pageWidth / 2, currentY, { align: "center", baseline: "middle" });
  currentY += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const metaText = `Order #: ${order.orderNumber}   |   Date: ${dtInfo.fullDateTime}   |   Customer: ${
    order.customerName || "Counter Sale"
  }`;
  const metaLines = doc.splitTextToSize(metaText, printableWidth - 6);
  metaLines.forEach((ln: string) => {
    doc.text(ln, pageWidth / 2, currentY, { align: "center", baseline: "middle" });
    currentY += 4.4;
  });

  currentY += 1.5;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.35);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  // Table (10 + 92 + 22 + 31 + 35 = 190mm)
  currentY += 4;
  const colWidths = [10, 92, 22, 31, 35];
  const headers = ["#", "Product Description", "Qty", "Rate (PKR)", "Total (PKR)"];
  const headerH = 8;
  const baseRowH = 6.8;

  const drawSimpleHeader = (y: number) => {
    doc.setFillColor(235, 240, 248);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, printableWidth, headerH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    let hX = margin;
    headers.forEach((h, i) => {
      const align = i >= 3 ? "right" : i === 0 || i === 2 ? "center" : "left";
      const tX = hX + (align === "center" ? colWidths[i] / 2 : align === "right" ? colWidths[i] - 2.5 : 2.5);
      doc.text(h, tX, y + headerH / 2, { align, baseline: "middle" });
      hX += colWidths[i];
      if (hX < margin + printableWidth) {
        doc.line(hX, y, hX, y + headerH);
      }
    });
  };

  drawSimpleHeader(currentY);
  currentY += headerH;

  let pageNum = 1;
  order.items.forEach((item, index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const wrappedProd = doc.splitTextToSize(String(item.productName || "Item"), colWidths[1] - 5);
    const rowH = Math.max(baseRowH, wrappedProd.length * 4.4 + 2.6);

    if (currentY + rowH > maxPageBottom - 10) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(30, 64, 175);
      doc.text(`--- CONTINUED ON PAGE ${pageNum + 1} ---`, pageWidth / 2, currentY + 5, {
        align: "center",
        baseline: "middle",
      });
      doc.addPage();
      pageNum++;
      currentY = margin + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${(settings.pharmacyName || "AK Pharmacy").toUpperCase()} — Order #${order.orderNumber} (Pg ${pageNum})`,
        pageWidth / 2,
        currentY,
        { align: "center", baseline: "middle" }
      );
      currentY += 6;
      drawSimpleHeader(currentY);
      currentY += headerH;
    }

    doc.setDrawColor(180, 188, 200);
    doc.setLineWidth(0.2);
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, rowH, "FD");
    } else {
      doc.rect(margin, currentY, printableWidth, rowH);
    }

    let rX = margin;
    const vals: Array<string | string[]> = [
      (index + 1).toString(),
      wrappedProd,
      item.quantity.toString(),
      item.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
    ];

    doc.setTextColor(15, 23, 42);
    const midY = currentY + rowH / 2;
    vals.forEach((v, i) => {
      const align = i >= 3 ? "right" : i === 0 || i === 2 ? "center" : "left";
      const tX = rX + (align === "center" ? colWidths[i] / 2 : align === "right" ? colWidths[i] - 2.5 : 2.5);
      doc.setFont("helvetica", i === 4 ? "bold" : "normal");
      doc.setFontSize(9);

      if (Array.isArray(v)) {
        const blockH = (v.length - 1) * 4.4;
        const firstY = midY - blockH / 2;
        v.forEach((ln, lIdx) => doc.text(ln, tX, firstY + lIdx * 4.4, { align, baseline: "middle" }));
      } else {
        doc.text(v, tX, midY, { align, baseline: "middle" });
      }
      rX += colWidths[i];
      if (rX < margin + printableWidth) {
        doc.line(rX, currentY, rX, currentY + rowH);
      }
    });

    currentY += rowH;
  });

  const remarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  const simpleRemarks = doc.splitTextToSize(remarksText, printableWidth - 22);
  const summaryH = 26 + simpleRemarks.length * 4;

  if (currentY + summaryH > maxPageBottom) {
    doc.addPage();
    currentY = margin + 4;
  }

  const simpleInvoiceNet = Math.max(
    0,
    (Number(order.subtotal) || 0) -
      (Number(order.discount) || 0) +
      (Number(order.tax) || 0) +
      (Number(order.advanceTax) || 0)
  );
  const simplePrevPending = Number(order.previousPendingAmount) || 0;
  const simpleTotalBalance = simpleInvoiceNet + simplePrevPending;
  const simpleSummaryBoxH = 22;

  currentY += 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.rect(margin, currentY, printableWidth, simpleSummaryBoxH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 40, 120);
  doc.text(
    `Gross Amount: Rs. ${(Number(order.subtotal) || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}   |   Net Amount: Rs. ${simpleInvoiceNet.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    pageWidth / 2,
    currentY + 5,
    { align: "center", baseline: "middle" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  doc.text(convertRupeesToWords(simpleTotalBalance), pageWidth / 2, currentY + 11, {
    align: "center",
    baseline: "middle",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 40, 120);
  doc.text(
    `Previous Pending: Rs. ${simplePrevPending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}   |   Total Balance: Rs. ${simpleTotalBalance.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    pageWidth / 2,
    currentY + 17,
    { align: "center", baseline: "middle" }
  );

  currentY += simpleSummaryBoxH + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Remark:", margin, currentY, { baseline: "middle" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  simpleRemarks.forEach((ln: string, idx: number) => {
    doc.text(ln, margin + 17, currentY + idx * 4, { baseline: "middle" });
  });

  stampInvoicePageNumbers(doc, margin, pageWidth, pageHeight, dtInfo.fullDateTime);
}

/**
 * 3. PROFESSIONAL PURCHASE ORDER TEMPLATE (Centered & Enlarged Typography)
 */
function renderProfessionalPoTemplate(doc: jsPDF, order: Order, settings: PharmacySettings) {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const printableWidth = pageWidth - margin * 2; // 190mm
  const dtInfo = getFormattedDateTime(order.orderDate);
  const maxPageBottom = pageHeight - 13;

  let currentY = margin;

  // Centered Header Banner
  const bannerH = settings.logoUrl ? 26 : 19;
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, printableWidth, bannerH, "F");

  if (settings.logoUrl) {
    try {
      const logoSize = 12;
      doc.addImage(settings.logoUrl, (pageWidth - logoSize) / 2, currentY + 2, logoSize, logoSize);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text((settings.pharmacyName || "AK PHARMACY SUPPLIES").toUpperCase(), pageWidth / 2, currentY + 17.5, {
        align: "center",
        baseline: "middle",
      });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(147, 197, 253);
      doc.text("OFFICIAL PURCHASE ORDER", pageWidth / 2, currentY + 22.8, {
        align: "center",
        baseline: "middle",
      });
    } catch (e) {
      console.warn("Could not embed logo in PO PDF", e);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text((settings.pharmacyName || "AK PHARMACY SUPPLIES").toUpperCase(), pageWidth / 2, currentY + 7, {
      align: "center",
      baseline: "middle",
    });
    doc.setFontSize(10);
    doc.setTextColor(147, 197, 253);
    doc.text("OFFICIAL PURCHASE ORDER", pageWidth / 2, currentY + 13.5, {
      align: "center",
      baseline: "middle",
    });
  }

  currentY += bannerH + 3.5;

  // Info Dual Box (Balanced symmetric halves)
  const halfW = (printableWidth - 4) / 2;
  const poInfoH = 22;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.rect(margin, currentY, halfW, poInfoH);
  doc.rect(margin + halfW + 4, currentY, halfW, poInfoH);

  // Left Vendor/Issuer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text("ISSUED BY / PHARMACY", margin + 3, currentY + 4.5, { baseline: "middle" });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.8);
  doc.text(settings.pharmacyName || "AK Pharmacy", margin + 3, currentY + 9.5, { baseline: "middle" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(settings.address || "Sahiwal Estate, Arif Road", margin + 3, currentY + 14, { baseline: "middle" });
  doc.text(`Tel: ${settings.phone || "040-4500933"}  |  Lic: ${settings.licenseNo || "02-367"}`, margin + 3, currentY + 18.5, {
    baseline: "middle",
  });

  // Right Recipient
  const rightBX = margin + halfW + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text("PURCHASER / CLIENT", rightBX + 3, currentY + 4.5, { baseline: "middle" });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.8);
  doc.text(order.customerName || "COUNTER SALE", rightBX + 3, currentY + 9.5, { baseline: "middle" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`PO Number: ${order.orderNumber}  |  Date: ${dtInfo.formattedDate}`, rightBX + 3, currentY + 14, {
    baseline: "middle",
  });
  doc.text(`Sales Representative: ${order.salesman || "ADNAN"}`, rightBX + 3, currentY + 18.5, {
    baseline: "middle",
  });

  currentY += poInfoH + 3.5;

  // Items Table (10 + 90 + 22 + 34 + 34 = 190mm)
  const pCols = [
    { label: "#", width: 10, align: "center" as const },
    { label: "Product Description", width: 90, align: "left" as const },
    { label: "Qty", width: 22, align: "center" as const },
    { label: "Unit Rate", width: 34, align: "right" as const },
    { label: "Line Total", width: 34, align: "right" as const },
  ];

  const poHeaderH = 8;
  const poBaseRowH = 6.8;

  const drawPoHeader = (y: number) => {
    doc.setFillColor(235, 240, 248);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, printableWidth, poHeaderH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    let phX = margin;
    pCols.forEach((col) => {
      const tX = phX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2.5 : 2.5);
      doc.text(col.label, tX, y + poHeaderH / 2, { align: col.align, baseline: "middle" });
      phX += col.width;
      if (phX < margin + printableWidth) {
        doc.line(phX, y, phX, y + poHeaderH);
      }
    });
  };

  drawPoHeader(currentY);
  currentY += poHeaderH;

  let poPage = 1;
  order.items.forEach((item, index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.8);
    const wrappedName = doc.splitTextToSize(String(item.productName || "Item"), pCols[1].width - 5);
    const rowH = Math.max(poBaseRowH, wrappedName.length * 4.4 + 2.6);

    if (currentY + rowH > maxPageBottom - 10) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.setTextColor(30, 64, 175);
      doc.text(`--- CONTINUED ON PAGE ${poPage + 1} ---`, pageWidth / 2, currentY + 5, {
        align: "center",
        baseline: "middle",
      });
      doc.addPage();
      poPage++;
      currentY = margin + 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${(settings.pharmacyName || "AK PHARMACY SUPPLIES").toUpperCase()} — PO #${order.orderNumber} (Pg ${poPage})`,
        pageWidth / 2,
        currentY,
        { align: "center", baseline: "middle" }
      );
      currentY += 6;
      drawPoHeader(currentY);
      currentY += poHeaderH;
    }

    doc.setDrawColor(180, 188, 200);
    doc.setLineWidth(0.2);
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, rowH, "FD");
    } else {
      doc.rect(margin, currentY, printableWidth, rowH);
    }

    let prX = margin;
    const pVals: Array<string | string[]> = [
      (index + 1).toString(),
      wrappedName,
      item.quantity.toString(),
      `Rs. ${item.rate.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      `Rs. ${item.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    ];

    doc.setTextColor(15, 23, 42);
    const midY = currentY + rowH / 2;
    pVals.forEach((pv, idx) => {
      const col = pCols[idx];
      const tX = prX + (col.align === "center" ? col.width / 2 : col.align === "right" ? col.width - 2.5 : 2.5);
      doc.setFont("helvetica", idx === 4 ? "bold" : "normal");
      doc.setFontSize(8.8);

      if (Array.isArray(pv)) {
        const blockH = (pv.length - 1) * 4.4;
        const firstY = midY - blockH / 2;
        pv.forEach((ln, lIdx) => doc.text(ln, tX, firstY + lIdx * 4.4, { align: col.align, baseline: "middle" }));
      } else {
        doc.text(pv, tX, midY, { align: col.align, baseline: "middle" });
      }
      prX += col.width;
      if (prX < margin + printableWidth) {
        doc.line(prX, currentY, prX, currentY + rowH);
      }
    });

    currentY += rowH;
  });

  const poRemarksText =
    settings.footerRemarks ||
    DEFAULT_SETTINGS.footerRemarks ||
    "All surgical items/stock must be checked immediately upon receipt of every supply. Any shortage, missing item, damaged item, or discrepancy must be reported immediately to the concerned person/supplier. Once the stock has been received and verified, any later claim regarding shortage or missing items may not be entertained.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  const poRemarks = doc.splitTextToSize(poRemarksText, printableWidth - 22);

  if (currentY + 28 + poRemarks.length * 4 > maxPageBottom) {
    doc.addPage();
    currentY = margin + 4;
  }

  const poInvoiceNet = Math.max(
    0,
    (Number(order.subtotal) || 0) -
      (Number(order.discount) || 0) +
      (Number(order.tax) || 0) +
      (Number(order.advanceTax) || 0)
  );
  const poPrevPending = Number(order.previousPendingAmount) || 0;
  const poTotalBalance = poInvoiceNet + poPrevPending;
  const poSummaryBoxH = 22;

  currentY += 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.rect(margin, currentY, printableWidth, poSummaryBoxH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 40, 120);
  doc.text(
    `Gross Amount: Rs. ${(Number(order.subtotal) || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}   |   Net Amount: Rs. ${poInvoiceNet.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    pageWidth / 2,
    currentY + 5,
    { align: "center", baseline: "middle" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  doc.text(convertRupeesToWords(poTotalBalance), pageWidth / 2, currentY + 11, {
    align: "center",
    baseline: "middle",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.8);
  doc.setTextColor(15, 40, 120);
  doc.text(
    `Previous Pending: Rs. ${poPrevPending.toLocaleString("en-PK", { minimumFractionDigits: 2 })}   |   Total Balance: Rs. ${poTotalBalance.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
    pageWidth / 2,
    currentY + 17,
    { align: "center", baseline: "middle" }
  );

  currentY += poSummaryBoxH + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Remark:", margin, currentY, { baseline: "middle" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(71, 85, 105);
  poRemarks.forEach((ln: string, idx: number) => {
    doc.text(ln, margin + 17, currentY + idx * 4, { baseline: "middle" });
  });

  stampInvoicePageNumbers(doc, margin, pageWidth, pageHeight, dtInfo.fullDateTime);
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
