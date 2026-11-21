export interface Product {
  id: string;
  name: string;
  normalizedName: string;
  category: string;
  price: number;
  costPrice?: number;
  productCode?: string;
  sourcePriceListVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListVersion {
  id: string;
  versionName: string; // e.g. "Price List v1"
  versionNumber: number;
  effectiveDate: string;
  isCurrent: boolean;
  sourceFileName?: string;
  itemCount: number;
  notes?: string;
  products: Product[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
  batch?: string;
  exp?: string;
  bon?: number;
  disc1?: number;
  disc2?: number;
  sTax?: number;
}

export interface Customer {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  phone?: string;
  licenseNo?: string;
  ntn?: string;
  notes?: string;
  openingBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PdfTemplateId = "nafees_ak" | "simple_list" | "professional_po";

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerCity?: string;
  customerPhone?: string;
  customerLicenseNo?: string;
  customerNtn?: string;
  orderDate: string;
  salesman: string;
  summaryNo?: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  advanceTax: number;
  grandTotal: number;
  grandTotalInWords: string;
  // Payment and Settlement Tracking
  paidAmount?: number;
  pendingAmount?: number;
  previousPendingAmount?: number;
  totalPayable?: number;
  paymentStatus?: "Paid" | "Partial" | "Unpaid";
  paymentMethod?: "Cash" | "Bank Transfer" | "Cheque" | "Credit / Pay Later" | "Online / Card";
  dueDate?: string;
  paymentNotes?: string;
  priceListVersion: string;
  pdfTemplate: PdfTemplateId;
  status: "Draft" | "Generated" | "Completed" | "Dispatched";
  createdAt: string;
  updatedAt: string;
}

export interface PharmacySettings {
  pharmacyName: string;
  address: string;
  phone: string;
  licenseNo: string;
  ntn: string;
  logoUrl?: string;
  defaultSalesman: string;
  preparedBy: string;
  printedBy: string;
  footerRemarks: string;
  defaultPdfTemplate: PdfTemplateId;
  currencySymbol: string;
  fullInvoiceReturnByDefault?: boolean;
  defaultSaleReturnCondition?: "Restockable" | "Damaged / Quarantine";
}

export interface MatchingCandidate {
  product: Product;
  score: number; // 0 to 100
  matchReason?: string;
}

export interface ExtractedProductItem {
  name: string;
  category: string;
  price: number;
  productCode?: string;
  isCategoryHeader: boolean;
  rawText?: string;
  isSelected?: boolean;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  batch?: string;
  exp?: string;
  costRate: number;
  salePrice: number;
  quantity: number;
  bon?: number;
  discPercent?: number;
  taxPercent?: number;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  purchaseNumber: string;
  supplierInvoiceNo: string;
  supplierName: string;
  supplierPhone?: string;
  supplierAddress?: string;
  purchaseDate: string;
  paymentStatus: "Paid" | "Credit" | "Partial" | "Unpaid";
  paymentMethod: "Cash" | "Bank Transfer" | "Cheque" | "Credit";
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  notes?: string;
  receivedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ReturnReason =
  | "Damaged / Broken"
  | "Expired / Near Expiry"
  | "Near Expiry / Expired"
  | "Shortage / Quantity Discrepancy"
  | "Wrong Item Supplied"
  | "Wrong Item Received"
  | "Excess Stock"
  | "Quality Defect"
  | "Customer Cancellation"
  | "Other";

export interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  batch?: string;
  quantity: number;
  unitRate: number;
  amount: number;
  reason: ReturnReason;
  condition: "Restockable" | "Damaged / Quarantine" | "Returned to Supplier";
}

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  returnType: "Sale Return" | "Purchase Return"; // Sale Return = Customer returning to us; Purchase Return = We returning to Supplier
  referenceNumber: string; // Order # or Purchase #
  partyName: string; // Customer name or Supplier name
  partyContact?: string;
  returnDate: string;
  items: ReturnItem[];
  totalAmount: number;
  status: "Approved" | "Pending Inspection" | "Completed" | "Rejected";
  actionTaken: "Cash Refund" | "Refund Cash" | "Credit Note / Ledger Adjustment" | "Stock Replacement";
  notes?: string;
  handledBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ReportTimeframe =
  | "day"
  | "daily"
  | "week"
  | "weekly"
  | "month"
  | "monthly"
  | "year"
  | "yearly"
  | "custom";


export interface StockSummaryItem {
  productId: string;
  productName: string;
  productCode?: string;
  category: string;
  currentStock: number;
  availableStock: number;
  hasPurchaseRecord: boolean;
  unitCost: number;
  salePrice: number;
  totalSold: number;
  totalPurchased: number;
  totalReturned: number;
  totalAdjusted?: number;
  totalAdjustedIncrease?: number;
  totalAdjustedDecrease?: number;
  stockValueCost: number;
  stockValueRetail: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

export type ExpenseCategory =
  | "Shop Rent"
  | "Electricity & Utilities"
  | "Staff Salaries & Wages"
  | "Tea & Refreshments"
  | "Transport & Delivery"
  | "Packaging & Stationery"
  | "Generator & Fuel"
  | "Cleaning & Maintenance"
  | "Government Taxes & Fees"
  | "Marketing & Promotion"
  | "Miscellaneous / Other";

export interface Expense {
  id: string;
  expenseNumber: string;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  date: string;
  paymentMethod: "Cash" | "Bank Transfer" | "EasyPaisa / JazzCash" | "Cheque" | "Other";
  paidBy?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Investor {
  id: string;
  name: string;
  phone?: string;
  cnic?: string;
  investmentAmount: number;
  investmentDate: string;
  sharePercentage?: number; // Custom override % or auto-calculated if undefined
  bankDetails?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorPayout {
  investorId: string;
  investorName: string;
  investmentAmount: number;
  sharePercentage: number;
  payoutAmount: number;
  status: "Paid" | "Pending";
  paidDate?: string;
  paymentMethod?: "Cash" | "Bank Transfer" | "Cheque" | "EasyPaisa / JazzCash";
  reference?: string;
  notes?: string;
}

export interface MonthlyProfitDistribution {
  id: string;
  month: string; // YYYY-MM e.g. "2026-09"
  totalSales: number;
  totalPurchasesCost: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  retainedReservePercent: number; // e.g. 10%
  retainedReserveAmount: number;
  distributableProfit: number;
  payouts: InvestorPayout[];
  notes?: string;
  status: "Draft" | "Finalized";
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type QuotationRateType = "sell_rate" | "purchase_rate";

export interface QuotationItem {
  id: string;
  productId?: string;
  productCode?: string;
  productName: string;
  quantity: number;
  rate: number;
  costRate?: number;
  sellRate?: number;
  amount: number;
  category?: string;
  batch?: string;
  exp?: string;
  bon?: number;
  disc1?: number;
  disc2?: number;
  sTax?: number;
}

export type QuotationStatus =
  | "Draft"
  | "Sent"
  | "Accepted"
  | "Rejected"
  | "Converted to Order"
  | "Expired";

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerCity?: string;
  customerPhone?: string;
  customerLicenseNo?: string;
  customerNtn?: string;
  quotationDate: string;
  validUntil: string; // Validity expiry date
  quotationRateType?: QuotationRateType; // "sell_rate" (default customer rate) or "purchase_rate" (cost/supplier inquiry)
  salesman?: string;
  subject?: string;
  termsConditions?: string;
  notes?: string;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  advanceTax?: number;
  grandTotal: number;
  grandTotalInWords: string;
  status: QuotationStatus;
  convertedOrderId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductHistoryEntry {
  id: string;
  date: string;
  type: "Purchase" | "Sale" | "Sale Return" | "Purchase Return" | "Stock Adjustment";
  referenceNumber: string; // e.g. PUR-2026-0001, ORD-2026-0001, ADJ-2026-0001
  partyName: string; // Customer, Supplier, or Adjuster
  quantityChange: number; // positive (+) for inward/add, negative (-) for outward/deduct
  quantity: number;
  rate: number;
  amount: number;
  batch?: string;
  exp?: string;
  reason?: string;
  runningStock?: number;
  notes?: string;
}

export type StockAdjustmentType = "Increase" | "Decrease";

export type StockAdjustmentReason =
  | "Physical Count / Audit Reconcile"
  | "Damaged / Broken in Store"
  | "Expired / Near Expiry Discard"
  | "Found Stock / Unrecorded Surplus"
  | "Correction / Opening Stock"
  | "Theft / Unexplained Shortage"
  | "Sample / Marketing Issue"
  | "Customer Return Unbilled"
  | "Supplier Return Replacement"
  | "Other";

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string; // e.g. "ADJ-2026-0001"
  date: string; // YYYY-MM-DD
  productId: string;
  productName: string;
  productCode?: string;
  category?: string;
  type: StockAdjustmentType; // "Increase" adds to stock; "Decrease" subtracts from stock
  quantity: number; // positive number of units
  previousStock: number; // stock before adjustment
  newStock: number; // stock after adjustment
  unitCost: number; // cost rate for valuation
  totalValue: number; // quantity * unitCost
  batch?: string;
  exp?: string;
  reason: StockAdjustmentReason | string;
  adjustedBy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecoveryPaymentMethod =
  | "Cash"
  | "Bank Transfer"
  | "EasyPaisa / JazzCash"
  | "Cheque"
  | "Online / Card";

export interface RecoveryOrderDeduction {
  orderId: string;
  orderNumber?: string;
  amount: number;
}

export interface RecoveryRecord {
  id: string;
  receiptNumber: string; // e.g. RCV-2026-0001
  recoveryDate: string; // YYYY-MM-DD
  recoveryTime?: string; // e.g. "02:45 PM"
  customerId?: string;
  customerName: string;
  customerCode?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerCity?: string;
  previousDue: number;
  recoveredAmount: number;
  discountOrAdjustment?: number;
  remainingDue: number;
  paymentMethod: RecoveryPaymentMethod;
  referenceNo?: string;
  linkedOrderId?: string;
  linkedOrderNumber?: string;
  appliedOrderDeductions?: RecoveryOrderDeduction[];
  collectedBy: string;
  receivedBy?: string;
  notes?: string;
  amountInWords: string;
  createdAt: string;
  updatedAt: string;
}


