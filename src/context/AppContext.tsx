import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Customer,
  Expense,
  Investor,
  MonthlyProfitDistribution,
  Order,
  OrderItem,
  PharmacySettings,
  PriceListVersion,
  Product,
  PurchaseOrder,
  PurchaseItem,
  ReturnRecord,
  StockSummaryItem,
  Quotation,
  QuotationItem,
  StockAdjustment,
  StockAdjustmentType,
  StockAdjustmentReason,
  ProductHistoryEntry,
  RecoveryRecord,
  RecoveryOrderDeduction,
} from "../types";
import { generateNextProductCode, sanitizeProductsWithCodes } from "../utils/productCodeGenerator";
import {
  DEFAULT_SETTINGS,
  INITIAL_PRICE_LIST_VERSION,
  INITIAL_PRODUCTS_V1,
  INITIAL_PURCHASES,
  INITIAL_ORDERS,
  INITIAL_RETURNS,
  INITIAL_CUSTOMERS,
  INITIAL_EXPENSES,
  INITIAL_INVESTORS,
  INITIAL_DISTRIBUTIONS,
  INITIAL_QUOTATIONS,
  INITIAL_STOCK_ADJUSTMENTS,
  INITIAL_RECOVERIES,
} from "../data/defaultData";
import { convertRupeesToWords } from "../utils/numberToWords";
import { findMatchingProducts } from "../utils/fuzzyMatch";

interface AppContextType {
  settings: PharmacySettings;
  updateSettings: (newSettings: Partial<PharmacySettings>) => void;
  priceListVersions: PriceListVersion[];
  activeVersionId: string;
  setActiveVersionId: (id: string) => void;
  currentProducts: Product[];
  saveNewPriceListVersion: (
    versionName: string,
    products: Array<{ name: string; category: string; price: number; productCode?: string }>,
    sourceFileName?: string,
    notes?: string
  ) => PriceListVersion;
  addProductToMaster: (product: Omit<Product, "id" | "createdAt" | "updatedAt" | "sourcePriceListVersion" | "normalizedName">) => void;
  updateProductInMaster: (productId: string, updates: Partial<Product>) => void;
  deleteProductFromMaster: (productId: string) => void;
  generateProductCode: (categoryOrProducts?: any, category?: string) => string;
  getProductMovementHistory: (productIdOrName: string) => ProductHistoryEntry[];
  
  // Orders / Sales
  orders: Order[];
  saveOrder: (order: Order) => { success: boolean; order?: Order; error?: string };
  duplicateOrder: (orderId: string) => Order | null;
  loadOrderIntoDraft: (order: Order) => void;
  loadPreviousInvoiceIntoNewOrder: (
    orderNumberOrId: string,
    mode?: "replace" | "append"
  ) => {
    success: boolean;
    sourceOrder?: Order;
    lowStockWarnings?: Array<{
      productName: string;
      requested: number;
      available: number;
      hasPurchaseRecord: boolean;
    }>;
    error?: string;
  };
  deleteOrder: (orderId: string) => void;
  deleteMultipleOrders: (orderIds: string[]) => void;
  recordOrderPayment: (orderId: string, amount: number, method?: string, notes?: string) => void;
  updateOrderPayment: (
    orderId: string,
    updates: {
      paymentStatus?: "Paid" | "Partial" | "Unpaid";
      paidAmount?: number;
      paymentMethod?: "Cash" | "Bank Transfer" | "Cheque" | "Credit / Pay Later" | "Online / Card";
      dueDate?: string;
      paymentNotes?: string;
    }
  ) => void;
  draftOrder: Order;
  setDraftOrder: React.Dispatch<React.SetStateAction<Order>>;
  resetDraftOrder: () => void;
  addItemToDraft: (productName: string, rate: number, quantity: number, productId?: string) => { success: boolean; error?: string };
  updateDraftItem: (itemId: string, updates: Partial<OrderItem>) => { success: boolean; error?: string };
  removeDraftItem: (itemId: string) => void;
  deleteMultipleDraftItems: (itemIds: string[]) => void;
  
  // Purchases
  purchases: PurchaseOrder[];
  savePurchase: (purchase: PurchaseOrder) => { success: boolean; error?: string };
  deletePurchase: (purchaseId: string) => void;
  deleteMultiplePurchases: (purchaseIds: string[]) => void;
  generateNextPurchaseNumber: () => string;

  // Returns (Sale & Purchase Returns)
  returns: ReturnRecord[];
  saveReturn: (record: ReturnRecord) => void;
  deleteReturn: (returnId: string) => void;
  deleteMultipleReturns: (returnIds: string[]) => void;
  generateNextReturnNumber: () => string;
  preselectedReturnOrderNumber: string | null;
  setPreselectedReturnOrderNumber: (orderNumber: string | null) => void;
  preselectedReturnPurchaseRef: string | null;
  setPreselectedReturnPurchaseRef: (purchaseRef: string | null) => void;

  // Order Calculations
  recalculateOrder: (order: Order) => Order;

  // Stock Summary & Ledger
  getStockSummaries: () => StockSummaryItem[];
  getItemAvailableStock: (
    productId?: string,
    productName?: string,
    excludeOrderId?: string
  ) => {
    availableStock: number;
    totalPurchased: number;
    totalSold: number;
    totalSaleReturns: number;
    totalPurchaseReturns: number;
    totalAdjustedIncrease: number;
    totalAdjustedDecrease: number;
    netAdjusted: number;
    hasPurchaseRecord: boolean;
    status: "In Stock" | "Low Stock" | "Out of Stock";
  };
  zeroOutItemStock: (
    productId: string,
    productName: string,
    reason?: string
  ) => { success: boolean; error?: string };

  // Price List Reset
  resetToDefaultCatalog: () => void;
  deleteMultipleProducts: (productIds: string[]) => void;

  // Customers & Client Directory
  customers: Customer[];
  saveCustomer: (customer: Customer) => void;
  deleteCustomer: (customerId: string) => void;
  deleteMultipleCustomers: (customerIds: string[]) => void;
  getCustomerPendingDues: (customerName: string, excludeOrderId?: string) => number;
  findMatchingCustomers: (query: string) => Customer[];
  startNewOrderWithCustomer: (customer: Customer) => void;
  resetCustomersToDefault: () => void;

  // Daily Expenses & Monthly Reporting
  expenses: Expense[];
  saveExpense: (expense: Expense) => void;
  deleteExpense: (expenseId: string) => void;
  deleteMultipleExpenses: (expenseIds: string[]) => void;
  generateNextExpenseNumber: () => string;
  resetExpensesToDefault: () => void;

  // Investors & Monthly Profit Distribution
  investors: Investor[];
  saveInvestor: (investor: Investor) => void;
  deleteInvestor: (investorId: string) => void;
  resetInvestorsToDefault: () => void;
  distributions: MonthlyProfitDistribution[];
  saveDistribution: (distribution: MonthlyProfitDistribution) => void;
  deleteDistribution: (distributionId: string) => void;

  // Quotations (Estimates & Proforma Invoices)
  quotations: Quotation[];
  saveQuotation: (quotation: Quotation) => void;
  deleteQuotation: (quotationId: string) => void;
  deleteMultipleQuotations: (quotationIds: string[]) => void;
  generateNextQuotationNumber: () => string;
  convertQuotationToOrder: (quotationId: string) => { success: boolean; orderId?: string; error?: string };
  loadQuotationIntoDraft: (quotationId: string) => void;
  duplicateQuotation: (quotationId: string) => void;
  resetQuotationsToDefault: () => void;

  // Stock Adjustments (Increase / Decrease Physical Inventory Reconciliation)
  stockAdjustments: StockAdjustment[];
  saveStockAdjustment: (adjustment: StockAdjustment) => { success: boolean; error?: string };
  deleteStockAdjustment: (adjId: string, revertStock?: boolean) => void;
  deleteMultipleStockAdjustments: (adjIds: string[], revertStock?: boolean) => void;
  generateNextAdjustmentNumber: () => string;
  resetStockAdjustmentsToDefault: () => void;

  // Daily Recoveries & Receiving Receipts
  recoveries: RecoveryRecord[];
  saveRecovery: (recovery: RecoveryRecord, applyToLinkedOrder?: boolean) => RecoveryRecord;
  deleteRecovery: (recoveryId: string) => void;
  deleteMultipleRecoveries: (recoveryIds: string[]) => void;
  generateNextReceiptNumber: () => string;
  preselectedRecoveryCustomer: string | null;
  setPreselectedRecoveryCustomer: (customerName: string | null) => void;

  // Database Backup / Restore
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonStr: string) => boolean;
  selectedPreviewOrder: Order | null;
  setSelectedPreviewOrder: (order: Order | null) => void;
  activeNavTab: string;
  setActiveNavTab: (tab: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const SETTINGS_KEY = "ak_pharmacy_settings_v1";
const VERSIONS_KEY = "ak_pharmacy_price_versions_v1";
const ACTIVE_VERSION_KEY = "ak_pharmacy_active_version_v1";
const ORDERS_KEY = "ak_pharmacy_orders_v1";
const PURCHASES_KEY = "ak_pharmacy_purchases_v1";
const RETURNS_KEY = "ak_pharmacy_returns_v1";
const CUSTOMERS_KEY = "ak_pharmacy_customers_v1";
const EXPENSES_KEY = "ak_pharmacy_expenses_v1";
const INVESTORS_KEY = "ak_pharmacy_investors_v1";
const DISTRIBUTIONS_KEY = "ak_pharmacy_distributions_v1";
const QUOTATIONS_KEY = "ak_pharmacy_quotations_v1";
const STOCK_ADJUSTMENTS_KEY = "ak_pharmacy_stock_adjustments_v1";
const RECOVERIES_KEY = "ak_pharmacy_recoveries_v1";
const DB_INITIALIZED_KEY = "ak_pharmacy_db_initialized_v2";

const normalizeStockKey = (val?: string): string =>
  (val || "").toLowerCase().replace(/\s+/g, " ").trim();

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeNavTab, setActiveNavTab] = useState<string>("new-order");
  const [selectedPreviewOrder, setSelectedPreviewOrder] = useState<Order | null>(null);
  const [preselectedRecoveryCustomer, setPreselectedRecoveryCustomer] = useState<string | null>(null);
  const [preselectedReturnOrderNumber, setPreselectedReturnOrderNumber] = useState<string | null>(null);
  const [preselectedReturnPurchaseRef, setPreselectedReturnPurchaseRef] = useState<string | null>(null);

  // Check if system has completed its baseline first-time setup
  const isAlreadyInitialized = (() => {
    try {
      return localStorage.getItem(DB_INITIALIZED_KEY) === "true";
    } catch {
      return false;
    }
  })();

  // Mark initialized so baseline demo data never overwrites user deletions/modifications
  useEffect(() => {
    try {
      localStorage.setItem(DB_INITIALIZED_KEY, "true");
    } catch (e) {
      console.warn("Storage notice:", e);
    }
  }, []);

  // Settings State
  const [settings, setSettings] = useState<PharmacySettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If the saved remarks was the old placeholder or empty, upgrade to the new legal remark
        if (!parsed.footerRemarks || parsed.footerRemarks === "ORDER — AVAILABILITY FOR 30 DAYS") {
          parsed.footerRemarks = DEFAULT_SETTINGS.footerRemarks;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Price List Versions State (Guaranteed with auto-generated clean Product Codes)
  const [priceListVersions, setPriceListVersions] = useState<PriceListVersion[]>(() => {
    try {
      const saved = localStorage.getItem(VERSIONS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((v: PriceListVersion) => ({
            ...v,
            products: sanitizeProductsWithCodes(v.products || []),
          }));
        }
      }
    } catch (e) {
      console.warn("Failed to load saved price lists", e);
    }
    return [
      {
        ...INITIAL_PRICE_LIST_VERSION,
        products: sanitizeProductsWithCodes(INITIAL_PRODUCTS_V1),
      },
    ];
  });

  const [activeVersionId, setActiveVersionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_VERSION_KEY);
      if (savedId && priceListVersions.some((v) => v.id === savedId)) {
        return savedId;
      }
    } catch {
      // ignore
    }
    const currentVer = priceListVersions.find((v) => v.isCurrent);
    return currentVer?.id || priceListVersions[0]?.id || "ver-1";
  });

  // Orders State (Sales) - Strict persistence so sold quantities never automatically re-add
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(ORDERS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved orders", e);
    }
    return isAlreadyInitialized ? [] : INITIAL_ORDERS;
  });

  // Purchases State - Strict persistence so deleted purchases never resurrect
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem(PURCHASES_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved purchases", e);
    }
    return isAlreadyInitialized ? [] : INITIAL_PURCHASES;
  });

  // Returns State
  const [returns, setReturns] = useState<ReturnRecord[]>(() => {
    try {
      const saved = localStorage.getItem(RETURNS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved returns", e);
    }
    return isAlreadyInitialized ? [] : INITIAL_RETURNS;
  });

  // Customers State (Loaded from storage or initialized from default customers + past orders)
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMERS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved customers", e);
    }
    return INITIAL_CUSTOMERS;
  });

  // Expenses State (Daily Expenses & Ledger)
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem(EXPENSES_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved expenses", e);
    }
    return INITIAL_EXPENSES;
  });

  // Investors State (Partners & Capital Shares)
  const [investors, setInvestors] = useState<Investor[]>(() => {
    try {
      const saved = localStorage.getItem(INVESTORS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved investors", e);
    }
    return INITIAL_INVESTORS;
  });

  // Monthly Profit Distributions State
  const [distributions, setDistributions] = useState<MonthlyProfitDistribution[]>(() => {
    try {
      const saved = localStorage.getItem(DISTRIBUTIONS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved distributions", e);
    }
    return INITIAL_DISTRIBUTIONS;
  });

  // Quotations State (Estimates & Proforma Invoices)
  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    try {
      const saved = localStorage.getItem(QUOTATIONS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved quotations", e);
    }
    return isAlreadyInitialized ? [] : INITIAL_QUOTATIONS;
  });

  // Stock Adjustments State (Physical Inventory Reconciliations) - Never resurrect deleted adjustments
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    try {
      const saved = localStorage.getItem(STOCK_ADJUSTMENTS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved stock adjustments", e);
    }
    return isAlreadyInitialized ? [] : INITIAL_STOCK_ADJUSTMENTS;
  });

  // Daily Recoveries State
  const [recoveries, setRecoveries] = useState<RecoveryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(RECOVERIES_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Failed to load saved recoveries", e);
    }
    return isAlreadyInitialized ? [] : INITIAL_RECOVERIES;
  });

  // Generate Next Order Number (always max existing sequence + 1 so numbers never duplicate)
  const generateNextOrderNumber = (currentOrders: Order[]): string => {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    let maxSeq = currentOrders.length;
    currentOrders.forEach((o) => {
      if (o.orderNumber && o.orderNumber.startsWith(prefix)) {
        const num = parseInt(o.orderNumber.slice(prefix.length), 10);
        if (!isNaN(num) && num >= maxSeq) {
          maxSeq = num;
        }
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  };

  // Generate Next Quotation Number
  const generateNextQuotationNumber = (): string => {
    const nextSeq = quotations.length + 1;
    const year = new Date().getFullYear();
    return `QT-${year}-${String(nextSeq).padStart(4, "0")}`;
  };

  // Generate Next Purchase Number
  const generateNextPurchaseNumber = (): string => {
    const nextSeq = purchases.length + 1;
    const year = new Date().getFullYear();
    return `PUR-${year}-${String(nextSeq).padStart(4, "0")}`;
  };

  // Generate Next Return Number
  const generateNextReturnNumber = (): string => {
    const nextSeq = returns.length + 1;
    const year = new Date().getFullYear();
    return `RET-${year}-${String(nextSeq).padStart(4, "0")}`;
  };

  // Generate Next Expense Number
  const generateNextExpenseNumber = (): string => {
    const nextSeq = expenses.length + 1;
    const year = new Date().getFullYear();
    return `EXP-${year}-${String(nextSeq).padStart(4, "0")}`;
  };

  // Generate Next Stock Adjustment Number
  const generateNextAdjustmentNumber = (): string => {
    const nextSeq = stockAdjustments.length + 1;
    const year = new Date().getFullYear();
    return `ADJ-${year}-${String(nextSeq).padStart(4, "0")}`;
  };

  // Generate Next Receiving Receipt Number
  const generateNextReceiptNumber = (): string => {
    const year = new Date().getFullYear();
    const prefix = `RCV-${year}-`;
    let maxSeq = recoveries.length;
    recoveries.forEach((r) => {
      if (r.receiptNumber && r.receiptNumber.startsWith(prefix)) {
        const num = parseInt(r.receiptNumber.slice(prefix.length), 10);
        if (!isNaN(num) && num >= maxSeq) {
          maxSeq = num;
        }
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
  };

  // Draft Order State
  const createBlankDraft = (ordersSnapshot?: Order[]): Order => {
    const today = new Date().toISOString().split("T")[0];
    const activeVer = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];
    return {
      id: "draft-" + Date.now(),
      orderNumber: generateNextOrderNumber(ordersSnapshot || orders),
      customerName: "",
      customerCode: "",
      customerAddress: "",
      customerCity: "Sahiwal",
      customerPhone: "",
      customerLicenseNo: "",
      customerNtn: "",
      orderDate: today,
      salesman: settings.defaultSalesman || "ADNAN",
      summaryNo: "",
      notes: "",
      items: [],
      subtotal: 0,
      discount: 0,
      tax: 0,
      advanceTax: 0,
      grandTotal: 0,
      grandTotalInWords: "Rupee Zero",
      paidAmount: 0,
      pendingAmount: 0,
      previousPendingAmount: 0,
      carriedLedgerPending: 0,
      paymentStatus: "Paid",
      paymentMethod: "Cash",
      dueDate: "",
      paymentNotes: "",
      priceListVersion: activeVer ? activeVer.versionName : "Price List v1",
      pdfTemplate: settings.defaultPdfTemplate || "nafees_ak",
      status: "Draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const [draftOrder, setDraftOrder] = useState<Order>(createBlankDraft);

  // Recalculate order totals whenever items, discount, tax, or previous pending change
  const recalculateOrder = (order: Order): Order => {
    const previousPendingAmount = Number(order.previousPendingAmount) || 0;
    const subtotal = order.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const discount = Number(order.discount) || 0;
    const tax = Number(order.tax) || 0;
    const advanceTax = Number(order.advanceTax) || 0;
    // Pending amount is added directly into the Net Amount / Grand Total
    const grandTotal = Math.max(0, subtotal - discount + tax + advanceTax + previousPendingAmount);
    const grandTotalInWords = convertRupeesToWords(grandTotal);

    // Payment settlement math
    let paymentStatus = order.paymentStatus || "Paid";
    let paidAmount = order.paidAmount !== undefined ? Number(order.paidAmount) : undefined;
    let pendingAmount = order.pendingAmount !== undefined ? Number(order.pendingAmount) : undefined;

    if (paidAmount === undefined && pendingAmount !== undefined) {
      paidAmount = Math.max(0, grandTotal - pendingAmount);
    } else if (paidAmount === undefined && pendingAmount === undefined) {
      if (paymentStatus === "Unpaid") {
        paidAmount = 0;
      } else if (paymentStatus === "Partial") {
        paidAmount = Math.round(grandTotal / 2);
      } else {
        paidAmount = grandTotal;
      }
    }

    paidAmount = Math.min(grandTotal, Math.max(0, Number(paidAmount) || 0));
    pendingAmount = Math.max(0, grandTotal - paidAmount);

    if (grandTotal > 0) {
      if (pendingAmount === 0) {
        paymentStatus = "Paid";
      } else if (paidAmount > 0 && pendingAmount > 0) {
        paymentStatus = "Partial";
      } else if (paidAmount === 0) {
        paymentStatus = "Unpaid";
      }
    } else {
      paymentStatus = "Paid";
    }

    return {
      ...order,
      subtotal,
      discount,
      tax,
      advanceTax,
      previousPendingAmount,
      carriedLedgerPending: Math.min(Number(order.carriedLedgerPending) || 0, previousPendingAmount),
      grandTotal,
      grandTotalInWords,
      paidAmount,
      pendingAmount,
      totalPayable: grandTotal,
      paymentStatus,
      paymentMethod: order.paymentMethod || "Cash",
      updatedAt: new Date().toISOString(),
    };
  };

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(priceListVersions));
  }, [priceListVersions]);

  useEffect(() => {
    if (activeVersionId) {
      localStorage.setItem(ACTIVE_VERSION_KEY, activeVersionId);
    }
  }, [activeVersionId]);

  useEffect(() => {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    localStorage.setItem(RETURNS_KEY, JSON.stringify(returns));
  }, [returns]);

  useEffect(() => {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(INVESTORS_KEY, JSON.stringify(investors));
  }, [investors]);

  useEffect(() => {
    localStorage.setItem(DISTRIBUTIONS_KEY, JSON.stringify(distributions));
  }, [distributions]);

  useEffect(() => {
    localStorage.setItem(QUOTATIONS_KEY, JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem(STOCK_ADJUSTMENTS_KEY, JSON.stringify(stockAdjustments));
  }, [stockAdjustments]);

  useEffect(() => {
    localStorage.setItem(RECOVERIES_KEY, JSON.stringify(recoveries));
  }, [recoveries]);

  const updateSettings = (newSettings: Partial<PharmacySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // Active Products helper
  const currentActiveVersion = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];
  const currentProducts = currentActiveVersion?.products || INITIAL_PRODUCTS_V1;

  // Add new version of price list
  const saveNewPriceListVersion = (
    versionName: string,
    rawItems: Array<{ name: string; category: string; price: number; productCode?: string }>,
    sourceFileName?: string,
    notes?: string
  ): PriceListVersion => {
    const nextVerNum = priceListVersions.length + 1;
    const finalVerName = versionName.trim() || `Price List v${nextVerNum}`;
    const verId = `ver-${Date.now()}`;

    const newProducts: Product[] = rawItems.map((item, idx) => ({
      id: `prod-${verId}-${idx + 1}`,
      name: item.name.trim(),
      normalizedName: item.name.toLowerCase().trim(),
      category: item.category || "General Supplies",
      price: Number(item.price) || 0,
      productCode: item.productCode || `ITM-${String(idx + 1).padStart(3, "0")}`,
      sourcePriceListVersion: finalVerName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const newVersion: PriceListVersion = {
      id: verId,
      versionName: finalVerName,
      versionNumber: nextVerNum,
      effectiveDate: new Date().toISOString().split("T")[0],
      isCurrent: true,
      sourceFileName: sourceFileName || "Uploaded_Catalog.pdf",
      itemCount: newProducts.length,
      notes: notes || `Extracted & approved version with ${newProducts.length} items.`,
      products: newProducts,
    };

    setPriceListVersions((prev) => [newVersion, ...prev.map((v) => ({ ...v, isCurrent: false }))]);
    setActiveVersionId(verId);
    return newVersion;
  };

  // Add Product to Current Master Price List (Auto-generates unique product code if empty)
  const addProductToMaster = (productData: Omit<Product, "id" | "createdAt" | "updatedAt" | "sourcePriceListVersion" | "normalizedName">) => {
    const finalCode = (productData.productCode || "").trim() || generateNextProductCode(currentProducts, productData.category);
    const defaultCost = productData.costPrice !== undefined 
      ? Number(productData.costPrice) 
      : Math.round((Number(productData.price) || 0) * 0.78);
    const newProduct: Product = {
      ...productData,
      costPrice: defaultCost,
      productCode: finalCode,
      id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      normalizedName: productData.name.toLowerCase().trim(),
      sourcePriceListVersion: currentActiveVersion.versionName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPriceListVersions((prev) =>
      prev.map((ver) => {
        if (ver.id === activeVersionId) {
          const updatedProds = [newProduct, ...ver.products];
          return {
            ...ver,
            itemCount: updatedProds.length,
            products: updatedProds,
          };
        }
        return ver;
      })
    );
  };

  // Update Product in Master
  const updateProductInMaster = (productId: string, updates: Partial<Product>) => {
    setPriceListVersions((prev) =>
      prev.map((ver) => {
        if (ver.id === activeVersionId) {
          const updatedProds = ver.products.map((p) => {
            if (p.id === productId) {
              const finalCode = updates.productCode !== undefined 
                ? (updates.productCode.trim() || p.productCode || generateNextProductCode(ver.products, updates.category || p.category))
                : p.productCode;
              const finalCost = updates.costPrice !== undefined 
                ? Number(updates.costPrice) 
                : (p.costPrice !== undefined ? Number(p.costPrice) : Math.round(p.price * 0.78));
              const updated = { 
                ...p, 
                ...updates, 
                productCode: finalCode, 
                costPrice: finalCost,
                updatedAt: new Date().toISOString() 
              };
              if (updates.name) updated.normalizedName = updates.name.toLowerCase().trim();
              return updated;
            }
            return p;
          });
          return { ...ver, products: updatedProds };
        }
        return ver;
      })
    );
  };

  const generateProductCode = (arg1?: any, arg2?: string) => {
    if (Array.isArray(arg1)) {
      return generateNextProductCode(arg1, typeof arg2 === "string" ? arg2 : undefined);
    }
    const category = typeof arg1 === "string" ? arg1 : undefined;
    return generateNextProductCode(currentProducts, category);
  };

  // Delete Product from Master
  const deleteProductFromMaster = (productId: string) => {
    const prodToDelete = currentProducts.find((p) => p.id === productId);
    const prodName = prodToDelete?.name.toLowerCase().trim();

    setPriceListVersions((prev) =>
      prev.map((ver) => {
        if (ver.id === activeVersionId) {
          const updatedProds = ver.products.filter((p) => p.id !== productId);
          return { ...ver, itemCount: updatedProds.length, products: updatedProds };
        }
        return ver;
      })
    );

    // Clean up corresponding purchases so deleted product stock does not linger or resurrect
    setPurchases((prev) =>
      prev
        .map((pur) => ({
          ...pur,
          items: pur.items.filter(
            (it) =>
              it.productId !== productId &&
              (!prodName || it.productName.toLowerCase().trim() !== prodName)
          ),
        }))
        .filter((pur) => pur.items.length > 0)
    );

    if (prodToDelete) {
      setStockAdjustments((prev) =>
        prev.filter(
          (adj) =>
            adj.productId !== productId &&
            (!prodName || adj.productName.toLowerCase().trim() !== prodName)
        )
      );
    }
  };

  const deleteMultipleProducts = (productIds: string[]) => {
    const prodsToDelete = currentProducts.filter((p) => productIds.includes(p.id));
    const prodNames = prodsToDelete.map((p) => p.name.toLowerCase().trim());

    setPriceListVersions((prev) =>
      prev.map((ver) => {
        if (ver.id === activeVersionId) {
          const updatedProds = ver.products.filter((p) => !productIds.includes(p.id));
          return { ...ver, itemCount: updatedProds.length, products: updatedProds };
        }
        return ver;
      })
    );

    // Clean up corresponding purchases
    setPurchases((prev) =>
      prev
        .map((pur) => ({
          ...pur,
          items: pur.items.filter(
            (it) =>
              !productIds.includes(it.productId) &&
              !prodNames.includes(it.productName.toLowerCase().trim())
          ),
        }))
        .filter((pur) => pur.items.length > 0)
    );

    setStockAdjustments((prev) =>
      prev.filter(
        (adj) =>
          !productIds.includes(adj.productId) &&
          !prodNames.includes(adj.productName.toLowerCase().trim())
      )
    );
  };

  // Order Draft Management
  const resetDraftOrder = () => {
    setDraftOrder(createBlankDraft());
  };

  // Active catalog lookup sets to guard against cross-product ID collisions
  const catalogNormSet = new Set(currentProducts.map((p) => normalizeStockKey(p.name)));
  const isSameStockItem = (
    targetId?: string,
    targetNorm?: string,
    candId?: string,
    candName?: string
  ): boolean => {
    const candNorm = normalizeStockKey(candName);
    if (targetNorm && candNorm && candNorm === targetNorm) return true;
    if (targetId && candId && candId === targetId) {
      if (candNorm && targetNorm && candNorm !== targetNorm && catalogNormSet.has(candNorm)) {
        return false;
      }
      return true;
    }
    return false;
  };

  // Backfill any previously saved purchased/adjusted custom items missing from master product list
  useEffect(() => {
    const activeVer = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];
    if (!activeVer) return;

    const existingProds = activeVer.products || [];
    const existingIds = new Set(existingProds.map((p) => p.id));
    const existingNorms = new Set(existingProds.map((p) => normalizeStockKey(p.name)));
    const addedProducts: Product[] = [];
    const nowIso = new Date().toISOString();

    purchases.forEach((pur) => {
      pur.items.forEach((item) => {
        const norm = normalizeStockKey(item.productName);
        if (!norm) return;
        const alreadyInCatalog =
          existingNorms.has(norm) ||
          (item.productId && !item.productId.startsWith("prod-custom-") && existingIds.has(item.productId));
        if (!alreadyInCatalog) {
          const costVal = Math.max(0, Number(item.costRate) || 0);
          const saleVal =
            Number(item.salePrice) > 0
              ? Number(item.salePrice)
              : costVal > 0
              ? Math.round(costVal / 0.78)
              : 0;
          const newId =
            item.productId && !existingIds.has(item.productId)
              ? item.productId
              : `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const code = generateNextProductCode([...existingProds, ...addedProducts], item.category || "General Supplies");
          const newProd: Product = {
            id: newId,
            name: item.productName.trim(),
            normalizedName: norm,
            category: (item.category || "General Supplies").trim(),
            price: saleVal,
            costPrice: costVal,
            productCode: code,
            sourcePriceListVersion: activeVer.versionName,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          addedProducts.push(newProd);
          existingIds.add(newId);
          existingNorms.add(norm);
        }
      });
    });

    stockAdjustments.forEach((adj) => {
      if (adj.type !== "Increase") return;
      const norm = normalizeStockKey(adj.productName);
      if (!norm) return;
      const alreadyInCatalog =
        existingNorms.has(norm) ||
        (adj.productId && !adj.productId.startsWith("prod-custom-") && existingIds.has(adj.productId));
      if (!alreadyInCatalog) {
        const costVal = Math.max(0, Number(adj.unitCost) || 0);
        const saleVal = costVal > 0 ? Math.round(costVal / 0.78) : 0;
        const newId =
          adj.productId && !existingIds.has(adj.productId)
            ? adj.productId
            : `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const code = generateNextProductCode([...existingProds, ...addedProducts], adj.category || "General Supplies");
        const newProd: Product = {
          id: newId,
          name: adj.productName.trim(),
          normalizedName: norm,
          category: (adj.category || "General Supplies").trim(),
          price: saleVal,
          costPrice: costVal,
          productCode: adj.productCode || code,
          sourcePriceListVersion: activeVer.versionName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        addedProducts.push(newProd);
        existingIds.add(newId);
        existingNorms.add(norm);
      }
    });

    if (addedProducts.length > 0) {
      setPriceListVersions((prev) =>
        prev.map((ver) => {
          if (ver.id === activeVer.id) {
            const updatedProds = [...addedProducts, ...ver.products];
            return {
              ...ver,
              itemCount: updatedProds.length,
              products: updatedProds,
            };
          }
          return ver;
        })
      );
    }
  }, [purchases.length, stockAdjustments.length, activeVersionId]);

  // Calculate precise available stock for any item
  const getItemAvailableStock = (
    productId?: string,
    productName?: string,
    excludeOrderId?: string
  ): {
    availableStock: number;
    totalPurchased: number;
    totalSold: number;
    totalSaleReturns: number;
    totalPurchaseReturns: number;
    totalAdjustedIncrease: number;
    totalAdjustedDecrease: number;
    netAdjusted: number;
    hasPurchaseRecord: boolean;
    status: "In Stock" | "Low Stock" | "Out of Stock";
  } => {
    const normName = normalizeStockKey(productName);

    // 1. Total purchased
    let totalPurchased = 0;
    purchases.forEach((pur) => {
      pur.items.forEach((item) => {
        if (isSameStockItem(productId, normName, item.productId, item.productName)) {
          totalPurchased += (Number(item.quantity) || 0) + (Number(item.bon) || 0);
        }
      });
    });

    // 2. Total sold
    let totalSold = 0;
    orders.forEach((ord) => {
      if (excludeOrderId && ord.id === excludeOrderId) return;
      ord.items.forEach((item) => {
        if (isSameStockItem(productId, normName, item.productId, item.productName)) {
          totalSold += (Number(item.quantity) || 0) + (Number(item.bon) || 0);
        }
      });
    });

    // 3. Returns adjustment
    let totalSaleReturns = 0;
    let totalPurchaseReturns = 0;
    returns.forEach((ret) => {
      ret.items.forEach((item) => {
        if (isSameStockItem(productId, normName, item.productId, item.productName)) {
          const qty = Number(item.quantity) || 0;
          if (ret.returnType === "Sale Return" && item.condition === "Restockable") {
            totalSaleReturns += qty;
          } else if (ret.returnType === "Purchase Return") {
            totalPurchaseReturns += qty;
          }
        }
      });
    });

    // 4. Stock Adjustments (+ increases, - decreases)
    let totalAdjustedIncrease = 0;
    let totalAdjustedDecrease = 0;
    stockAdjustments.forEach((adj) => {
      if (isSameStockItem(productId, normName, adj.productId, adj.productName)) {
        const qty = Number(adj.quantity) || 0;
        if (adj.type === "Increase") {
          totalAdjustedIncrease += qty;
        } else if (adj.type === "Decrease") {
          totalAdjustedDecrease += qty;
        }
      }
    });
    const netAdjusted = totalAdjustedIncrease - totalAdjustedDecrease;

    // Strict stock calculation: Available Stock = Total Purchased Quantity - Total Sold Quantity + Returns + Net Adjustments
    const availableStock = Math.max(0, totalPurchased - totalSold + totalSaleReturns - totalPurchaseReturns + netAdjusted);
    const hasPurchaseRecord = (totalPurchased + totalAdjustedIncrease) > 0;

    let status: "In Stock" | "Low Stock" | "Out of Stock" = "Out of Stock";
    if (availableStock === 0) {
      status = "Out of Stock";
    } else if (availableStock < 10) {
      status = "Low Stock";
    } else {
      status = "In Stock";
    }

    return {
      availableStock,
      totalPurchased,
      totalSold,
      totalSaleReturns,
      totalPurchaseReturns,
      totalAdjustedIncrease,
      totalAdjustedDecrease,
      netAdjusted,
      hasPurchaseRecord,
      status,
    };
  };

  // Zero out / permanently clear available stock for an item
  const zeroOutItemStock = (
    productId: string,
    productName: string,
    reason?: string
  ): { success: boolean; error?: string } => {
    const stock = getItemAvailableStock(productId, productName);
    if (stock.availableStock <= 0) {
      return { success: true };
    }

    const currentVer = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];
    const product = currentVer?.products.find(
      (p) => p.id === productId || p.name.toLowerCase().trim() === (productName || "").toLowerCase().trim()
    );

    const adjNumber = `ADJ-${new Date().getFullYear()}-${String(stockAdjustments.length + 1).padStart(4, "0")}`;
    const qtyToDeduct = stock.availableStock;

    const zeroAdjustment: StockAdjustment = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      adjustmentNumber: adjNumber,
      date: new Date().toISOString().split("T")[0],
      productId: productId || product?.id || `prod-${Date.now()}`,
      productName: productName || product?.name || "Product",
      productCode: product?.productCode,
      category: product?.category || "General",
      type: "Decrease",
      quantity: qtyToDeduct,
      previousStock: qtyToDeduct,
      newStock: 0,
      unitCost: product ? Math.round(product.price * 0.78) : 0,
      totalValue: product ? Math.round(qtyToDeduct * product.price * 0.78) : 0,
      reason: reason || "Physical Count / Audit Reconcile",
      adjustedBy: settings.defaultSalesman || "Store In-charge",
      notes: `Permanently cleared remaining ${qtyToDeduct} units to 0.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setStockAdjustments((prev) => [zeroAdjustment, ...prev]);

    // Sync to backend API
    fetch("/api/stock-adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zeroAdjustment),
    }).catch(() => {});

    return { success: true };
  };

  const addItemToDraft = (
    productName: string,
    rate: number,
    quantity: number,
    productId?: string
  ): { success: boolean; error?: string } => {
    const trimmedName = productName.trim();
    const stock = getItemAvailableStock(productId, trimmedName);
    const numQty = Number(quantity) || 1;

    // Rule 2: Only In-Stock Inventory Can Be Sold. Item must have a purchase or stock adjustment record.
    if (!stock.hasPurchaseRecord) {
      const msg = `Cannot sell "${trimmedName}". No purchase or inventory record exists for this item. An item can only be sold if it has recorded stock.`;
      return { success: false, error: msg };
    }

    // Rule 2: If an item's available quantity is 0, the sale must be blocked.
    if (stock.availableStock <= 0) {
      const msg = `Insufficient stock. Available quantity: 0. "${trimmedName}" is out of stock.`;
      return { success: false, error: msg };
    }

    // Calculate current quantity already in the draft order for this item
    const normName = trimmedName.toLowerCase();
    const currentInDraft = draftOrder.items
      .filter((it) => (productId && it.productId === productId) || it.productName.toLowerCase().trim() === normName)
      .reduce((sum, it) => sum + (Number(it.quantity) || 0) + (Number(it.bon) || 0), 0);

    const remainingAvailable = Math.max(0, stock.availableStock - currentInDraft);

    // Rule 3: Sales Quantity Validation. Sale quantity must never be greater than available stock.
    if (numQty > remainingAvailable) {
      const msg = `Insufficient stock. Available quantity: ${remainingAvailable}`;
      return { success: false, error: msg };
    }

    const numRate = Number(rate) || 0;
    const amount = numQty * numRate;

    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: productId || `custom-${Date.now()}`,
      productName: trimmedName,
      quantity: numQty,
      rate: numRate,
      amount,
      batch: "",
      exp: "",
      bon: 0,
      disc1: 0,
      disc2: 0,
      sTax: 0,
    };

    setDraftOrder((prev) => {
      // IMPORTANT: Append to exact sequence!
      const updatedItems = [...prev.items, newItem];
      return recalculateOrder({ ...prev, items: updatedItems });
    });

    return { success: true };
  };

  const updateDraftItem = (
    itemId: string,
    updates: Partial<OrderItem>
  ): { success: boolean; error?: string } => {
    const targetItem = draftOrder.items.find((it) => it.id === itemId);
    if (!targetItem) return { success: false, error: "Item not found" };

    if (updates.quantity !== undefined || updates.bon !== undefined) {
      const newQty = updates.quantity !== undefined ? Number(updates.quantity) || 0 : targetItem.quantity;
      const newBon = updates.bon !== undefined ? Number(updates.bon) || 0 : (targetItem.bon || 0);
      const totalRequested = newQty + newBon;

      const stock = getItemAvailableStock(targetItem.productId, targetItem.productName);

      // Sum quantities of OTHER rows with same product in draft
      const otherInDraft = draftOrder.items
        .filter(
          (it) =>
            it.id !== itemId &&
            ((targetItem.productId && it.productId === targetItem.productId) ||
              it.productName.toLowerCase().trim() === targetItem.productName.toLowerCase().trim())
        )
        .reduce((sum, it) => sum + (Number(it.quantity) || 0) + (Number(it.bon) || 0), 0);

      const maxAllowed = Math.max(0, stock.availableStock - otherInDraft);

      if (totalRequested > maxAllowed) {
        const msg = `Insufficient stock. Available quantity: ${maxAllowed}`;
        return { success: false, error: msg };
      }
    }

    setDraftOrder((prev) => {
      const updatedItems = prev.items.map((item) => {
        if (item.id === itemId) {
          const merged = { ...item, ...updates };
          merged.amount = (Number(merged.quantity) || 0) * (Number(merged.rate) || 0);
          return merged;
        }
        return item;
      });
      return recalculateOrder({ ...prev, items: updatedItems });
    });

    return { success: true };
  };

  const removeDraftItem = (itemId: string) => {
    setDraftOrder((prev) => {
      const updatedItems = prev.items.filter((item) => item.id !== itemId);
      return recalculateOrder({ ...prev, items: updatedItems });
    });
  };

  const deleteMultipleDraftItems = (itemIds: string[]) => {
    setDraftOrder((prev) => {
      const updatedItems = prev.items.filter((item) => !itemIds.includes(item.id));
      return recalculateOrder({ ...prev, items: updatedItems });
    });
  };

  // Save Order to History
  const saveOrder = (finalOrder: Order): { success: boolean; order?: Order; error?: string } => {
    // If the order has a temporary draft ID, assign a permanent unique order ID
    const isNewDraft = !finalOrder.id || finalOrder.id.startsWith("draft-");
    const persistentId = isNewDraft
      ? `ord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
      : finalOrder.id;

    const orderToProcess: Order = {
      ...finalOrder,
      id: persistentId,
      orderNumber: finalOrder.orderNumber || generateNextOrderNumber(orders),
    };

    const recalculated = recalculateOrder(orderToProcess);

    // Validate all items before saving (aggregate requested qty+bon per product)
    const aggregatedRequests = new Map<string, { productId?: string; productName: string; requested: number }>();
    for (const it of recalculated.items) {
      const key = (it.productName || "").toLowerCase().trim() || it.productId;
      const requested = (Number(it.quantity) || 0) + (Number(it.bon) || 0);
      const existing = aggregatedRequests.get(key);
      if (existing) {
        existing.requested += requested;
      } else {
        aggregatedRequests.set(key, {
          productId: it.productId,
          productName: it.productName,
          requested,
        });
      }
    }

    for (const entry of aggregatedRequests.values()) {
      const stock = getItemAvailableStock(entry.productId, entry.productName, recalculated.id);

      if (!stock.hasPurchaseRecord) {
        return {
          success: false,
          error: `Cannot sell "${entry.productName}". No inventory or purchase record exists for this item. An item can only be sold if stock is recorded.`,
        };
      }

      if (stock.availableStock <= 0) {
        return {
          success: false,
          error: `Insufficient stock for "${entry.productName}". Available quantity: 0`,
        };
      }

      if (entry.requested > stock.availableStock) {
        return {
          success: false,
          error: `Insufficient stock for "${entry.productName}". Requested: ${entry.requested}, Available: ${stock.availableStock}`,
        };
      }
    }

    // Sync with backend API
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recalculated),
    }).catch((err) => console.warn("Backend order sync notice:", err));

    const existingIdx = orders.findIndex((o) => o.id === recalculated.id);
    const updatedOrdersList =
      existingIdx >= 0
        ? orders.map((o, i) => (i === existingIdx ? recalculated : o))
        : [recalculated, ...orders];

    setOrders(updatedOrdersList);

    // Reset draft order immediately with updated ordersSnapshot so next invoice gets next sequential #
    if (isNewDraft || draftOrder.id === finalOrder.id) {
      setDraftOrder(createBlankDraft(updatedOrdersList));
    }

    // Auto-update or register customer into customers directory
    if (recalculated.customerName && recalculated.customerName.trim()) {
      const cName = recalculated.customerName.trim();
      setCustomers((prev) => {
        const existingIdx = prev.findIndex(
          (c) => c.name.toLowerCase().trim() === cName.toLowerCase()
        );
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const updated: Customer = {
            ...existing,
            name: cName,
            code: recalculated.customerCode || existing.code,
            address: recalculated.customerAddress || existing.address,
            city: recalculated.customerCity || existing.city,
            phone: recalculated.customerPhone || existing.phone,
            licenseNo: recalculated.customerLicenseNo || existing.licenseNo,
            ntn: recalculated.customerNtn || existing.ntn,
            updatedAt: new Date().toISOString(),
          };
          const copy = [...prev];
          copy[existingIdx] = updated;
          return copy;
        } else {
          const newCust: Customer = {
            id: `cust-${Date.now()}`,
            name: cName,
            code: recalculated.customerCode || `CUST-${String(prev.length + 1).padStart(3, "0")}`,
            address: recalculated.customerAddress || "",
            city: recalculated.customerCity || "Sahiwal",
            phone: recalculated.customerPhone || "",
            licenseNo: recalculated.customerLicenseNo || "",
            ntn: recalculated.customerNtn || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return [newCust, ...prev];
        }
      });
    }

    return { success: true, order: recalculated };
  };

  // Customer Directory Helper Methods
  const saveCustomer = (customer: Customer) => {
    setCustomers((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.id === customer.id || (c.name && c.name.toLowerCase().trim() === customer.name.toLowerCase().trim())
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          ...customer,
          updatedAt: new Date().toISOString(),
        };
        return copy;
      }
      return [
        {
          ...customer,
          id: customer.id || `cust-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  };

  const deleteCustomer = (customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  const deleteMultipleCustomers = (customerIds: string[]) => {
    setCustomers((prev) => prev.filter((c) => !customerIds.includes(c.id)));
  };

  const getCustomerPendingDues = (customerName: string, excludeOrderId?: string): number => {
    if (!customerName || !customerName.trim()) return 0;
    const target = customerName.trim().toLowerCase();
    const matchedCust = customers.find(
      (c) => c.name && c.name.trim().toLowerCase() === target
    );
    const opening = matchedCust && matchedCust.openingBalance ? Number(matchedCust.openingBalance) : 0;
    const ordersPending = orders
      .filter((o) => o.customerName && o.customerName.trim().toLowerCase() === target && o.id !== excludeOrderId)
      .reduce((sum, o) => {
        const p = o.pendingAmount !== undefined ? Number(o.pendingAmount) : Math.max(0, Number(o.grandTotal) - (Number(o.paidAmount) || 0));
        const carried = Math.min(Number(o.carriedLedgerPending) || 0, Number(o.previousPendingAmount) || 0);
        return sum + (p - carried);
      }, 0);
    // Deduct unapplied recovery credits so linked-order settlements are never double-counted
    const unappliedRecoveryCredit = recoveries
      .filter((r) => r.customerName && r.customerName.trim().toLowerCase() === target)
      .reduce((sum, r) => {
        const totalSettled = (Number(r.recoveredAmount) || 0) + (Number(r.discountOrAdjustment) || 0);
        const appliedSum = (r.appliedOrderDeductions || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
        return sum + Math.max(0, totalSettled - appliedSum);
      }, 0);
    return Math.max(0, opening + ordersPending - unappliedRecoveryCredit);
  };

  const findMatchingCustomers = (query: string): Customer[] => {
    if (!query || !query.trim()) return customers.slice(0, 10);
    const q = query.toLowerCase().trim();
    return customers.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const code = (c.code || "").toLowerCase();
      const addr = (c.address || "").toLowerCase();
      const city = (c.city || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        phone.includes(q) ||
        addr.includes(q) ||
        city.includes(q)
      );
    });
  };

  const startNewOrderWithCustomer = (customer: Customer) => {
    const pending = getCustomerPendingDues(customer.name, draftOrder.id);
    setDraftOrder((prev) =>
      recalculateOrder({
        ...prev,
        customerName: customer.name,
        customerCode: customer.code || prev.customerCode || "",
        customerAddress: customer.address || prev.customerAddress || "",
        customerCity: customer.city || prev.customerCity || "Sahiwal",
        customerPhone: customer.phone || prev.customerPhone || "",
        customerLicenseNo: customer.licenseNo || prev.customerLicenseNo || "",
        customerNtn: customer.ntn || prev.customerNtn || "",
        previousPendingAmount: pending,
        carriedLedgerPending: pending,
      })
    );
    setActiveNavTab("new-order");
  };

  const resetCustomersToDefault = () => {
    setCustomers(INITIAL_CUSTOMERS);
  };

  // Duplicate Order
  const duplicateOrder = (orderId: string): Order | null => {
    const existing = orders.find((o) => o.id === orderId);
    if (!existing) return null;

    const newOrderNumber = generateNextOrderNumber(orders);
    const duplicated: Order = recalculateOrder({
      ...existing,
      id: `draft-${Date.now()}`,
      orderNumber: newOrderNumber,
      orderDate: new Date().toISOString().split("T")[0],
      status: "Draft",
      previousPendingAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      paymentStatus: "Paid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: existing.items.map((it) => ({
        ...it,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      })),
    });

    setDraftOrder(duplicated);
    setActiveNavTab("new-order");
    return duplicated;
  };

  // Load any previous invoice by Invoice # or ID into a brand-new draft order
  const loadPreviousInvoiceIntoNewOrder = (
    orderNumberOrId: string,
    mode: "replace" | "append" = "replace"
  ): {
    success: boolean;
    sourceOrder?: Order;
    lowStockWarnings?: Array<{
      productName: string;
      requested: number;
      available: number;
      hasPurchaseRecord: boolean;
    }>;
    error?: string;
  } => {
    const query = (orderNumberOrId || "").trim().toLowerCase();
    if (!query) {
      return { success: false, error: "Please enter or select a previous Invoice #." };
    }

    const source =
      orders.find(
        (o) =>
          o.id === orderNumberOrId ||
          o.orderNumber.trim().toLowerCase() === query
      ) ||
      orders.find((o) => o.orderNumber.trim().toLowerCase().includes(query));

    if (!source) {
      return {
        success: false,
        error: `No previous invoice found matching "${orderNumberOrId}".`,
      };
    }

    const today = new Date().toISOString().split("T")[0];
    const freshDraftId =
      draftOrder.id && draftOrder.id.startsWith("draft-")
        ? draftOrder.id
        : `draft-${Date.now()}`;
    const freshOrderNumber =
      draftOrder.id && draftOrder.id.startsWith("draft-") && draftOrder.orderNumber
        ? draftOrder.orderNumber
        : generateNextOrderNumber(orders);

    const clonedItems: OrderItem[] = source.items.map((it, idx) => {
      const qty = Number(it.quantity) || 1;
      const rate = Number(it.rate) || 0;
      const disc1 = Number(it.disc1) || 0;
      const disc2 = Number(it.disc2) || 0;
      const gross = qty * rate;
      const afterDisc1 = gross * (1 - disc1 / 100);
      const netAmt = afterDisc1 * (1 - disc2 / 100);
      return {
        ...it,
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        amount: Math.round(netAmt * 100) / 100,
      };
    });

    const mergedItems =
      mode === "append" ? [...draftOrder.items, ...clonedItems] : clonedItems;

    // Check real-time stock against all target items
    const lowStockWarnings: Array<{
      productName: string;
      requested: number;
      available: number;
      hasPurchaseRecord: boolean;
    }> = [];

    mergedItems.forEach((it) => {
      const stock = getItemAvailableStock(it.productId, it.productName, freshDraftId);
      const requested = (Number(it.quantity) || 0) + (Number(it.bon) || 0);
      if (!stock.hasPurchaseRecord || stock.availableStock <= 0 || requested > stock.availableStock) {
        lowStockWarnings.push({
          productName: it.productName,
          requested,
          available: stock.availableStock,
          hasPurchaseRecord: stock.hasPurchaseRecord,
        });
      }
    });

    const targetCustName =
      mode === "append" && draftOrder.customerName.trim()
        ? draftOrder.customerName
        : source.customerName;
    const autoPending =
      mode === "append"
        ? draftOrder.previousPendingAmount || 0
        : getCustomerPendingDues(targetCustName, freshDraftId);
    const autoCarried =
      mode === "append"
        ? draftOrder.carriedLedgerPending || 0
        : autoPending;

    const nextDraft = recalculateOrder({
      ...(mode === "append" ? draftOrder : source),
      id: freshDraftId,
      orderNumber: freshOrderNumber,
      orderDate: mode === "append" ? draftOrder.orderDate || today : today,
      customerName: targetCustName,
      customerCode:
        mode === "append" && draftOrder.customerName.trim()
          ? draftOrder.customerCode
          : source.customerCode,
      customerAddress:
        mode === "append" && draftOrder.customerName.trim()
          ? draftOrder.customerAddress
          : source.customerAddress,
      customerCity:
        mode === "append" && draftOrder.customerName.trim()
          ? draftOrder.customerCity
          : source.customerCity,
      customerPhone:
        mode === "append" && draftOrder.customerName.trim()
          ? draftOrder.customerPhone
          : source.customerPhone,
      customerLicenseNo:
        mode === "append" && draftOrder.customerName.trim()
          ? draftOrder.customerLicenseNo
          : source.customerLicenseNo,
      customerNtn:
        mode === "append" && draftOrder.customerName.trim()
          ? draftOrder.customerNtn
          : source.customerNtn,
      salesman:
        mode === "append" && draftOrder.salesman
          ? draftOrder.salesman
          : source.salesman || settings.defaultSalesman || "ADNAN",
      previousPendingAmount: autoPending,
      carriedLedgerPending: autoCarried,
      paidAmount: 0,
      pendingAmount: 0,
      paymentStatus: "Paid",
      status: "Draft",
      items: mergedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setDraftOrder(nextDraft);
    return {
      success: true,
      sourceOrder: source,
      lowStockWarnings,
    };
  };

  // Load existing order into draft for editing
  const loadOrderIntoDraft = (order: Order) => {
    setDraftOrder(order);
    setActiveNavTab("new-order");
  };

  // Record an installment/payment against an existing order
  const recordOrderPayment = (orderId: string, additionalPayment: number, method?: string, notes?: string) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const currentPaid = Number(ord.paidAmount) || 0;
          const newPaid = Math.min(ord.grandTotal, currentPaid + Math.max(0, Number(additionalPayment) || 0));
          const newPending = Math.max(0, ord.grandTotal - newPaid);
          const newStatus: "Paid" | "Partial" | "Unpaid" =
            newPending === 0 ? "Paid" : newPaid > 0 ? "Partial" : "Unpaid";

          return {
            ...ord,
            paidAmount: newPaid,
            pendingAmount: newPending,
            paymentStatus: newStatus,
            paymentMethod: (method as any) || ord.paymentMethod || "Cash",
            paymentNotes: notes ? `${ord.paymentNotes ? ord.paymentNotes + " | " : ""}${notes}` : ord.paymentNotes,
            updatedAt: new Date().toISOString(),
          };
        }
        return ord;
      })
    );
  };

  // Update order payment status and amounts directly
  const updateOrderPayment = (
    orderId: string,
    updates: {
      paymentStatus?: "Paid" | "Partial" | "Unpaid";
      paidAmount?: number;
      pendingAmount?: number;
      paymentMethod?: "Cash" | "Bank Transfer" | "Cheque" | "Credit / Pay Later" | "Online / Card";
      dueDate?: string;
      paymentNotes?: string;
    }
  ) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          let paidAmount = updates.paidAmount !== undefined ? Number(updates.paidAmount) : undefined;
          let pendingAmount = updates.pendingAmount !== undefined ? Number(updates.pendingAmount) : undefined;
          let paymentStatus = updates.paymentStatus || ord.paymentStatus || "Paid";

          if (paidAmount === undefined && pendingAmount !== undefined) {
            paidAmount = Math.max(0, ord.grandTotal - pendingAmount);
          } else if (paidAmount !== undefined && pendingAmount === undefined) {
            pendingAmount = Math.max(0, ord.grandTotal - paidAmount);
          } else if (paidAmount === undefined && pendingAmount === undefined) {
            paidAmount = ord.paidAmount !== undefined ? Number(ord.paidAmount) : ord.grandTotal;
            pendingAmount = Math.max(0, ord.grandTotal - paidAmount);
          }

          paidAmount = Math.min(ord.grandTotal, Math.max(0, Number(paidAmount) || 0));
          pendingAmount = Math.max(0, ord.grandTotal - paidAmount);

          if (ord.grandTotal > 0) {
            if (pendingAmount === 0) {
              paymentStatus = "Paid";
            } else if (paidAmount > 0 && pendingAmount > 0) {
              paymentStatus = "Partial";
            } else if (paidAmount === 0) {
              paymentStatus = "Unpaid";
            }
          }

          return {
            ...ord,
            ...updates,
            paidAmount,
            pendingAmount,
            paymentStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return ord;
      })
    );
  };

  // Delete Order
  const deleteOrder = (orderId: string) => {
    fetch(`/api/orders/${orderId}`, { method: "DELETE" }).catch((err) =>
      console.warn("Backend delete order notice:", err)
    );
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const deleteMultipleOrders = (orderIds: string[]) => {
    orderIds.forEach((id) => {
      fetch(`/api/orders/${id}`, { method: "DELETE" }).catch((err) =>
        console.warn("Backend delete order notice:", err)
      );
    });
    setOrders((prev) => prev.filter((o) => !orderIds.includes(o.id)));
  };

  // Save Purchase (Immediately links/creates catalog products & increases available stock in real time!)
  const savePurchase = (purchase: PurchaseOrder): { success: boolean; error?: string } => {
    const activeVer = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];
    const nowIso = new Date().toISOString();
    const workingCatalog: Product[] = activeVer ? [...activeVer.products] : [];
    const newProductsCreated: Product[] = [];
    const updatedProductsMap = new Map<string, Product>();

    const normalizedItems: PurchaseItem[] = (purchase.items || []).map((item) => {
      const cleanName = (item.productName || "").trim();
      const norm = normalizeStockKey(cleanName);
      const itemCat = (item.category || "General Supplies").trim();
      const costVal = Math.max(0, Number(item.costRate) || 0);
      const rawSale = Number(item.salePrice) || 0;

      // Match existing master product by ID (if same product) or normalized name
      let matched = workingCatalog.find((p) => {
        if (norm && normalizeStockKey(p.name) === norm) return true;
        if (item.productId && !item.productId.startsWith("prod-custom-") && p.id === item.productId) {
          return !norm || normalizeStockKey(p.name) === norm;
        }
        return false;
      });

      if (matched) {
        const nextCost = costVal > 0 ? costVal : matched.costPrice;
        const nextPrice = matched.price > 0 ? matched.price : (rawSale > 0 ? rawSale : (costVal > 0 ? Math.round(costVal / 0.78) : 0));
        if (nextCost !== matched.costPrice || nextPrice !== matched.price) {
          const updatedProd: Product = {
            ...matched,
            costPrice: nextCost,
            price: nextPrice,
            updatedAt: nowIso,
          };
          updatedProductsMap.set(matched.id, updatedProd);
          const idx = workingCatalog.findIndex((p) => p.id === matched!.id);
          if (idx >= 0) workingCatalog[idx] = updatedProd;
          matched = updatedProd;
        }
        return {
          ...item,
          productId: matched.id,
          productName: matched.name,
          category: itemCat || matched.category,
          salePrice: rawSale > 0 ? rawSale : matched.price,
        };
      }

      // Brand-new product not yet in Master Price List -> auto-create so it appears in Stock immediately!
      const newProdId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const saleVal = rawSale > 0 ? rawSale : (costVal > 0 ? Math.round(costVal / 0.78) : 0);
      const newProd: Product = {
        id: newProdId,
        name: cleanName,
        normalizedName: norm,
        category: itemCat,
        price: saleVal,
        costPrice: costVal,
        productCode: generateNextProductCode(workingCatalog, itemCat),
        sourcePriceListVersion: activeVer?.versionName || "Price List v1",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      workingCatalog.unshift(newProd);
      newProductsCreated.push(newProd);

      return {
        ...item,
        productId: newProdId,
        productName: cleanName,
        category: itemCat,
        salePrice: saleVal,
      };
    });

    const normalizedPurchase: PurchaseOrder = {
      ...purchase,
      items: normalizedItems,
      updatedAt: nowIso,
    };

    // Sync any newly added or cost-updated products into active price list version
    if (activeVer && (newProductsCreated.length > 0 || updatedProductsMap.size > 0)) {
      setPriceListVersions((prev) =>
        prev.map((ver) => {
          if (ver.id === activeVer.id) {
            const refreshed = ver.products.map((p) => updatedProductsMap.get(p.id) || p);
            const finalProds = [...newProductsCreated, ...refreshed];
            return {
              ...ver,
              itemCount: finalProds.length,
              products: finalProds,
            };
          }
          return ver;
        })
      );
    }

    // Immediately update local React state -> All components immediately reflect new available stock without refresh!
    setPurchases((prev) => {
      const existingIdx = prev.findIndex((p) => p.id === normalizedPurchase.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = normalizedPurchase;
        return copy;
      }
      return [normalizedPurchase, ...prev];
    });

    // Sync to backend API
    fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedPurchase),
    }).catch((err) => console.warn("Backend purchase sync notice:", err));

    return { success: true };
  };

  // Delete Purchase (Verifies it won't cause negative stock)
  const deletePurchase = (purchaseId: string) => {
    fetch(`/api/purchases/${purchaseId}`, { method: "DELETE" }).catch((err) =>
      console.warn("Backend delete purchase notice:", err)
    );
    setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
  };

  const deleteMultiplePurchases = (purchaseIds: string[]) => {
    purchaseIds.forEach((id) => {
      fetch(`/api/purchases/${id}`, { method: "DELETE" }).catch((err) =>
        console.warn("Backend delete purchase notice:", err)
      );
    });
    setPurchases((prev) => prev.filter((p) => !purchaseIds.includes(p.id)));
  };

  // Save Return Record
  const saveReturn = (record: ReturnRecord) => {
    setReturns((prev) => {
      const existingIdx = prev.findIndex((r) => r.id === record.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = record;
        return copy;
      }
      return [record, ...prev];
    });
  };

  // Delete Return Record
  const deleteReturn = (returnId: string) => {
    setReturns((prev) => prev.filter((r) => r.id !== returnId));
  };

  const deleteMultipleReturns = (returnIds: string[]) => {
    setReturns((prev) => prev.filter((r) => !returnIds.includes(r.id)));
  };

  // Save Expense (Create or Update)
  const saveExpense = (expense: Expense) => {
    setExpenses((prev) => {
      const existingIdx = prev.findIndex((e) => e.id === expense.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = expense;
        return copy;
      }
      return [expense, ...prev];
    });
  };

  // Delete Expense
  const deleteExpense = (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  };

  const deleteMultipleExpenses = (expenseIds: string[]) => {
    setExpenses((prev) => prev.filter((e) => !expenseIds.includes(e.id)));
  };

  // Reset Expenses to Default Sample Data
  const resetExpensesToDefault = () => {
    setExpenses(INITIAL_EXPENSES);
  };

  // Daily Recoveries & Receiving Receipts CRUD (with order-deduction sync & clean reversal)
  const applyOrderDeductionReversal = (ordersList: Order[], deductions: RecoveryOrderDeduction[]): Order[] => {
    if (!deductions || deductions.length === 0) return ordersList;
    return ordersList.map((ord) => {
      const ded = deductions.find((d) => d.orderId === ord.id);
      if (!ded || ded.amount <= 0) return ord;
      const currentPaid = Number(ord.paidAmount) || 0;
      const newPaid = Math.max(0, currentPaid - ded.amount);
      const newPending = Math.max(0, Number(ord.grandTotal) - newPaid);
      const newStatus: "Paid" | "Partial" | "Unpaid" =
        newPending === 0 ? "Paid" : newPaid > 0 ? "Partial" : "Unpaid";
      const updatedOrd: Order = {
        ...ord,
        paidAmount: newPaid,
        pendingAmount: newPending,
        paymentStatus: newStatus,
        updatedAt: new Date().toISOString(),
      };
      return updatedOrd;
    });
  };

  const saveRecovery = (recovery: RecoveryRecord, applyToLinkedOrder = true): RecoveryRecord => {
    const existing = recoveries.find((r) => r.id === recovery.id);
    const nowIso = new Date().toISOString();
    const totalSettled = (Number(recovery.recoveredAmount) || 0) + (Number(recovery.discountOrAdjustment) || 0);

    let nextOrders = [...orders];
    if (existing?.appliedOrderDeductions && existing.appliedOrderDeductions.length > 0) {
      nextOrders = applyOrderDeductionReversal(nextOrders, existing.appliedOrderDeductions);
    }

    const newDeductions: RecoveryOrderDeduction[] = [];
    if (applyToLinkedOrder && recovery.linkedOrderId && totalSettled > 0) {
      nextOrders = nextOrders.map((ord) => {
        if (ord.id !== recovery.linkedOrderId) return ord;
        const currentPaid = ord.paidAmount !== undefined ? Number(ord.paidAmount) : 0;
        const currentPending =
          ord.pendingAmount !== undefined
            ? Number(ord.pendingAmount)
            : Math.max(0, Number(ord.grandTotal) - currentPaid);
        const applyAmt = Math.min(currentPending, totalSettled);
        if (applyAmt <= 0) return ord;

        const newPaid = Math.min(Number(ord.grandTotal), currentPaid + applyAmt);
        const newPending = Math.max(0, Number(ord.grandTotal) - newPaid);
        const newStatus: "Paid" | "Partial" | "Unpaid" =
          newPending === 0 ? "Paid" : newPaid > 0 ? "Partial" : "Unpaid";

        newDeductions.push({
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          amount: applyAmt,
        });

        const updatedOrd: Order = {
          ...ord,
          paidAmount: newPaid,
          pendingAmount: newPending,
          paymentStatus: newStatus,
          paymentMethod:
            recovery.paymentMethod === "EasyPaisa / JazzCash"
              ? "Online / Card"
              : (recovery.paymentMethod as Order["paymentMethod"]),
          paymentNotes: `${ord.paymentNotes ? ord.paymentNotes + " | " : ""}Recovery ${recovery.receiptNumber}: Rs. ${applyAmt.toLocaleString("en-PK")}`,
          updatedAt: nowIso,
        };
        return updatedOrd;
      });
    }

    if (
      (existing?.appliedOrderDeductions && existing.appliedOrderDeductions.length > 0) ||
      newDeductions.length > 0
    ) {
      setOrders(nextOrders);
    }

    const finalRecovery: RecoveryRecord = {
      ...recovery,
      id: recovery.id || `rcv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      receiptNumber: recovery.receiptNumber || generateNextReceiptNumber(),
      appliedOrderDeductions: newDeductions,
      amountInWords: recovery.amountInWords || convertRupeesToWords(Number(recovery.recoveredAmount) || 0),
      createdAt: recovery.createdAt || nowIso,
      updatedAt: nowIso,
    };

    setRecoveries((prev) => {
      const idx = prev.findIndex((r) => r.id === finalRecovery.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = finalRecovery;
        return copy;
      }
      return [finalRecovery, ...prev];
    });

    return finalRecovery;
  };

  const deleteRecovery = (recoveryId: string) => {
    const target = recoveries.find((r) => r.id === recoveryId);
    if (target?.appliedOrderDeductions && target.appliedOrderDeductions.length > 0) {
      setOrders((prev) => applyOrderDeductionReversal(prev, target.appliedOrderDeductions!));
    }
    setRecoveries((prev) => prev.filter((r) => r.id !== recoveryId));
  };

  const deleteMultipleRecoveries = (recoveryIds: string[]) => {
    const idSet = new Set(recoveryIds);
    const targets = recoveries.filter((r) => idSet.has(r.id));
    const allDeductions = targets.flatMap((t) => t.appliedOrderDeductions || []);
    if (allDeductions.length > 0) {
      setOrders((prev) => {
        let next = prev;
        for (const ded of allDeductions) {
          next = applyOrderDeductionReversal(next, [ded]);
        }
        return next;
      });
    }
    setRecoveries((prev) => prev.filter((r) => !idSet.has(r.id)));
  };

  // Investor Management (Save, Update, Delete)
  const saveInvestor = (investor: Investor) => {
    setInvestors((prev) => {
      const existingIdx = prev.findIndex((inv) => inv.id === investor.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = investor;
        return copy;
      }
      return [...prev, investor];
    });
  };

  const deleteInvestor = (investorId: string) => {
    setInvestors((prev) => prev.filter((inv) => inv.id !== investorId));
  };

  const resetInvestorsToDefault = () => {
    setInvestors(INITIAL_INVESTORS);
  };

  // Monthly Profit Distribution Management
  const saveDistribution = (distribution: MonthlyProfitDistribution) => {
    setDistributions((prev) => {
      const existingIdx = prev.findIndex((d) => d.id === distribution.id || d.month === distribution.month);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = distribution;
        return copy;
      }
      return [distribution, ...prev];
    });
  };

  const deleteDistribution = (distributionId: string) => {
    setDistributions((prev) => prev.filter((d) => d.id !== distributionId));
  };

  // Quotation Management (Estimates & Proforma Invoices)
  const saveQuotation = (quotation: Quotation) => {
    setQuotations((prev) => {
      const idx = prev.findIndex((q) => q.id === quotation.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...quotation, updatedAt: new Date().toISOString() };
        return copy;
      }
      return [quotation, ...prev];
    });
  };

  const deleteQuotation = (quotationId: string) => {
    setQuotations((prev) => prev.filter((q) => q.id !== quotationId));
  };

  const deleteMultipleQuotations = (quotationIds: string[]) => {
    setQuotations((prev) => prev.filter((q) => !quotationIds.includes(q.id)));
  };

  const duplicateQuotation = (quotationId: string) => {
    const source = quotations.find((q) => q.id === quotationId);
    if (!source) return;

    const newQuotation: Quotation = {
      ...source,
      id: `quot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      quotationNumber: generateNextQuotationNumber(),
      quotationDate: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
      status: "Draft",
      convertedOrderId: undefined,
      convertedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuotations((prev) => [newQuotation, ...prev]);
  };

  const convertQuotationToOrder = (
    quotationId: string
  ): { success: boolean; orderId?: string; error?: string } => {
    const quot = quotations.find((q) => q.id === quotationId);
    if (!quot) return { success: false, error: "Quotation not found" };

    if (quot.items.length === 0) {
      return { success: false, error: "Cannot convert an empty quotation with 0 items." };
    }

    // 1. Stock verification: Check if stock is available for every item
    const shortages: string[] = [];
    quot.items.forEach((item) => {
      const stock = getItemAvailableStock(item.productId, item.productName);
      const requested = (Number(item.quantity) || 0) + (Number(item.bon) || 0);

      if (!stock.hasPurchaseRecord) {
        shortages.push(
          `• "${item.productName}": No inventory record exists (Requested: ${requested}, Available: 0)`
        );
      } else if (stock.availableStock < requested) {
        shortages.push(
          `• "${item.productName}": Requested ${requested} units, but only ${stock.availableStock} in stock (Total Purchased: ${stock.totalPurchased}, Total Sold: ${stock.totalSold})`
        );
      }
    });

    if (shortages.length > 0) {
      return {
        success: false,
        error: `Insufficient stock to convert this quotation into a live sales order:\n\n${shortages.join(
          "\n"
        )}\n\nPlease purchase required inventory via Purchases first, or load into draft to adjust item quantities.`,
      };
    }

    // 2. Build the live Order
    const newOrderId = `ord-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newOrderNumber = generateNextOrderNumber(orders);

    const orderItems: OrderItem[] = quot.items.map((it, idx) => ({
      id: `ord-item-${Date.now()}-${idx}`,
      productId: it.productId || `prod-quot-${idx}`,
      productName: it.productName,
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
      amount: Number(it.amount) || 0,
      batch: it.batch || "",
      exp: it.exp || "",
      bon: Number(it.bon) || 0,
      disc1: Number(it.disc1) || 0,
      disc2: Number(it.disc2) || 0,
      sTax: Number(it.sTax) || 0,
    }));

    const convertedOrder: Order = recalculateOrder({
      id: newOrderId,
      orderNumber: newOrderNumber,
      customerName: quot.customerName,
      customerCode: quot.customerCode,
      customerAddress: quot.customerAddress,
      customerCity: quot.customerCity,
      customerPhone: quot.customerPhone,
      customerLicenseNo: quot.customerLicenseNo,
      customerNtn: quot.customerNtn,
      orderDate: new Date().toISOString().split("T")[0],
      salesman: quot.salesman || settings.defaultSalesman || "DIRECT",
      summaryNo: `QUOT-${quot.quotationNumber.replace(/[^a-zA-Z0-9]/g, "")}`,
      notes: `Order converted from Quotation #${quot.quotationNumber}. ${quot.notes || ""}`.trim(),
      items: orderItems,
      subtotal: quot.subtotal,
      discount: quot.discount,
      tax: quot.tax,
      advanceTax: quot.advanceTax || 0,
      grandTotal: quot.grandTotal,
      grandTotalInWords: quot.grandTotalInWords,
      paidAmount: 0,
      pendingAmount: quot.grandTotal,
      paymentStatus: "Unpaid",
      paymentMethod: "Cash",
      priceListVersion: currentActiveVersion.versionName,
      pdfTemplate: settings.defaultPdfTemplate || "nafees_ak",
      status: "Generated",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Save order: immediately reserves/deducts stock
    setOrders((prev) => [convertedOrder, ...prev]);

    // Update Quotation status
    setQuotations((prev) =>
      prev.map((q) =>
        q.id === quotationId
          ? {
              ...q,
              status: "Converted to Order",
              convertedOrderId: newOrderId,
              convertedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : q
      )
    );

    return { success: true, orderId: newOrderId };
  };

  const loadQuotationIntoDraft = (quotationId: string) => {
    const quot = quotations.find((q) => q.id === quotationId);
    if (!quot) return;

    const orderItems: OrderItem[] = quot.items.map((it, idx) => ({
      id: `draft-item-${Date.now()}-${idx}`,
      productId: it.productId || `prod-quot-${idx}`,
      productName: it.productName,
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
      amount: Number(it.amount) || 0,
      batch: it.batch || "",
      exp: it.exp || "",
      bon: Number(it.bon) || 0,
      disc1: Number(it.disc1) || 0,
      disc2: Number(it.disc2) || 0,
      sTax: Number(it.sTax) || 0,
    }));

    const draft: Order = recalculateOrder({
      id: "draft-" + Date.now(),
      orderNumber: generateNextOrderNumber(orders),
      customerName: quot.customerName,
      customerCode: quot.customerCode,
      customerAddress: quot.customerAddress,
      customerCity: quot.customerCity,
      customerPhone: quot.customerPhone,
      customerLicenseNo: quot.customerLicenseNo,
      customerNtn: quot.customerNtn,
      orderDate: new Date().toISOString().split("T")[0],
      salesman: quot.salesman || settings.defaultSalesman || "DIRECT",
      summaryNo: `QUOT-${quot.quotationNumber.replace(/[^a-zA-Z0-9]/g, "")}`,
      notes: `Loaded from Quotation #${quot.quotationNumber}. ${quot.notes || ""}`.trim(),
      items: orderItems,
      subtotal: quot.subtotal,
      discount: quot.discount,
      tax: quot.tax,
      advanceTax: quot.advanceTax || 0,
      grandTotal: quot.grandTotal,
      grandTotalInWords: quot.grandTotalInWords,
      paidAmount: 0,
      pendingAmount: quot.grandTotal,
      paymentStatus: "Unpaid",
      paymentMethod: "Cash",
      priceListVersion: currentActiveVersion.versionName,
      pdfTemplate: settings.defaultPdfTemplate || "nafees_ak",
      status: "Draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setDraftOrder(draft);
    setActiveNavTab("new-order");
  };

  const resetQuotationsToDefault = () => {
    setQuotations(INITIAL_QUOTATIONS);
    try {
      localStorage.setItem(QUOTATIONS_KEY, JSON.stringify(INITIAL_QUOTATIONS));
    } catch (e) {
      console.error("Failed to reset quotations", e);
    }
  };

  // Stock Adjustment Management (Manual Increase / Decrease)
  const saveStockAdjustment = (
    adjustment: StockAdjustment
  ): { success: boolean; error?: string } => {
    if (!adjustment.productId && !adjustment.productName) {
      return { success: false, error: "Product selection is required for stock adjustment." };
    }
    const rawQty = Number(adjustment.quantity) || 0;
    if (rawQty <= 0) {
      return { success: false, error: "Adjustment quantity must be greater than 0." };
    }

    const norm = normalizeStockKey(adjustment.productName);
    const activeVer = priceListVersions.find((v) => v.id === activeVersionId) || priceListVersions[0];
    const matchedProd = (activeVer?.products || []).find((p) => {
      if (norm && normalizeStockKey(p.name) === norm) return true;
      if (adjustment.productId && p.id === adjustment.productId) {
        return !norm || normalizeStockKey(p.name) === norm;
      }
      return false;
    });

    const canonicalId = matchedProd?.id || adjustment.productId;
    const canonicalName = matchedProd?.name || adjustment.productName.trim();
    const stockBefore = getItemAvailableStock(canonicalId, canonicalName);

    let finalQty = rawQty;
    let finalNotes = adjustment.notes;

    if (adjustment.type === "Decrease") {
      if (stockBefore.availableStock <= 0) {
        return {
          success: false,
          error: `Cannot decrease "${canonicalName}". Available stock is already 0 units.`,
        };
      }
      if (rawQty > stockBefore.availableStock) {
        finalQty = stockBefore.availableStock;
        const capNote = `(Requested -${rawQty}, capped at remaining ${stockBefore.availableStock} units)`;
        finalNotes = finalNotes ? `${finalNotes} ${capNote}` : capNote;
      }
    } else if (!matchedProd && activeVer && canonicalName) {
      // If Increase is recorded for an unlisted product, register it in active catalog so it's visible in Stock
      const costVal = Math.max(0, Number(adjustment.unitCost) || 0);
      const newProd: Product = {
        id: canonicalId || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: canonicalName,
        normalizedName: norm,
        category: adjustment.category || "General Supplies",
        price: costVal > 0 ? Math.round(costVal / 0.78) : 0,
        costPrice: costVal,
        productCode: adjustment.productCode || generateNextProductCode(activeVer.products, adjustment.category || "General Supplies"),
        sourcePriceListVersion: activeVer.versionName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setPriceListVersions((prev) =>
        prev.map((ver) =>
          ver.id === activeVer.id
            ? { ...ver, itemCount: ver.products.length + 1, products: [newProd, ...ver.products] }
            : ver
        )
      );
    }

    const finalNewStock =
      adjustment.type === "Increase"
        ? stockBefore.availableStock + finalQty
        : Math.max(0, stockBefore.availableStock - finalQty);

    const sanitizedAdjustment: StockAdjustment = {
      ...adjustment,
      productId: canonicalId,
      productName: canonicalName,
      productCode: matchedProd?.productCode || adjustment.productCode,
      category: matchedProd?.category || adjustment.category,
      quantity: finalQty,
      previousStock: stockBefore.availableStock,
      newStock: finalNewStock,
      totalValue: Math.round(finalQty * (Number(adjustment.unitCost) || 0)),
      notes: finalNotes,
      updatedAt: new Date().toISOString(),
    };

    setStockAdjustments((prev) => {
      const idx = prev.findIndex((a) => a.id === sanitizedAdjustment.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = sanitizedAdjustment;
        return copy;
      }
      return [sanitizedAdjustment, ...prev];
    });

    return { success: true };
  };

  const deleteStockAdjustment = (adjId: string, revertStock = false) => {
    const target = stockAdjustments.find((a) => a.id === adjId);
    
    // If it was a Decrease adjustment and revertStock is false, permanently deduct that quantity from purchases so stock does not bounce back
    if (target && target.type === "Decrease" && !revertStock) {
      const qty = Number(target.quantity) || 0;
      const prodName = (target.productName || "").toLowerCase().trim();
      let remainingToDeduct = qty;
      
      setPurchases((prev) =>
        prev.map((pur) => {
          if (remainingToDeduct <= 0) return pur;
          const updatedItems = pur.items.map((it) => {
            const itName = (it.productName || "").toLowerCase().trim();
            if ((target.productId && it.productId === target.productId) || (prodName && itName === prodName)) {
              const currentTotal = (Number(it.quantity) || 0);
              const deduct = Math.min(remainingToDeduct, currentTotal);
              remainingToDeduct -= deduct;
              return {
                ...it,
                quantity: Math.max(0, currentTotal - deduct),
              };
            }
            return it;
          });
          return { ...pur, items: updatedItems };
        })
      );
    }

    setStockAdjustments((prev) => prev.filter((a) => a.id !== adjId));
  };

  const deleteMultipleStockAdjustments = (adjIds: string[], revertStock = false) => {
    adjIds.forEach((id) => deleteStockAdjustment(id, revertStock));
  };

  const resetStockAdjustmentsToDefault = () => {
    setStockAdjustments(INITIAL_STOCK_ADJUSTMENTS);
    try {
      localStorage.setItem(STOCK_ADJUSTMENTS_KEY, JSON.stringify(INITIAL_STOCK_ADJUSTMENTS));
    } catch (e) {
      console.error("Failed to reset stock adjustments", e);
    }
  };

  // Complete Product Movement History across Purchases, Sales, Returns & Adjustments
  const getProductMovementHistory = (productIdOrName: string): ProductHistoryEntry[] => {
    if (!productIdOrName) return [];
    const matchedMaster = currentProducts.find(
      (p) => p.id === productIdOrName || normalizeStockKey(p.name) === normalizeStockKey(productIdOrName)
    );
    const targetId = matchedMaster?.id || productIdOrName;
    const targetNorm = normalizeStockKey(matchedMaster?.name || productIdOrName);
    const history: ProductHistoryEntry[] = [];

    // 1. Inward Purchases
    purchases.forEach((pur) => {
      pur.items.forEach((item) => {
        if (isSameStockItem(targetId, targetNorm, item.productId, item.productName)) {
          const qty = Number(item.quantity) || 0;
          const bon = Number(item.bon) || 0;
          const totalUnits = qty + bon;
          history.push({
            id: `hist-pur-${pur.id}-${item.id}`,
            date: pur.purchaseDate,
            type: "Purchase",
            referenceNumber: pur.purchaseNumber,
            partyName: pur.supplierName,
            quantityChange: totalUnits,
            quantity: totalUnits,
            rate: Number(item.costRate) || 0,
            amount: Number(item.amount) || 0,
            batch: item.batch,
            exp: item.exp,
            notes: bon > 0 ? `Includes +${bon} Bonus Units` : `Invoice #${pur.supplierInvoiceNo || ""}`.trim(),
          });
        }
      });
    });

    // 2. Outward Sales Orders
    orders.forEach((ord) => {
      ord.items.forEach((item) => {
        if (isSameStockItem(targetId, targetNorm, item.productId, item.productName)) {
          const qty = Number(item.quantity) || 0;
          history.push({
            id: `hist-ord-${ord.id}-${item.id}`,
            date: ord.orderDate,
            type: "Sale",
            referenceNumber: ord.orderNumber,
            partyName: ord.customerName,
            quantityChange: -qty,
            quantity: qty,
            rate: Number(item.rate) || 0,
            amount: Number(item.amount) || 0,
            batch: item.batch,
            exp: item.exp,
          });
        }
      });
    });

    // 3. Returns (Customer Return = +Stock; Supplier Return = -Stock)
    returns.forEach((ret) => {
      ret.items.forEach((item) => {
        if (isSameStockItem(targetId, targetNorm, item.productId, item.productName)) {
          const qty = Number(item.quantity) || 0;
          const isSaleReturn = ret.returnType === "Sale Return";
          history.push({
            id: `hist-ret-${ret.id}-${item.id}`,
            date: ret.returnDate,
            type: isSaleReturn ? "Sale Return" : "Purchase Return",
            referenceNumber: ret.returnNumber,
            partyName: ret.partyName,
            quantityChange: isSaleReturn ? qty : -qty,
            quantity: qty,
            rate: Number(item.unitRate) || 0,
            amount: Number(item.amount) || 0,
            reason: item.reason,
            batch: item.batch,
            notes: ret.actionTaken,
          });
        }
      });
    });

    // 4. Stock Adjustments (Increase = +Stock; Decrease = -Stock)
    stockAdjustments.forEach((adj) => {
      if (isSameStockItem(targetId, targetNorm, adj.productId, adj.productName)) {
        const qty = Number(adj.quantity) || 0;
        const isIncrease = adj.type === "Increase";
        history.push({
          id: `hist-adj-${adj.id}`,
          date: adj.date,
          type: "Stock Adjustment",
          referenceNumber: adj.adjustmentNumber,
          partyName: adj.adjustedBy || "Store Manager",
          quantityChange: isIncrease ? qty : -qty,
          quantity: qty,
          rate: Number(adj.unitCost) || 0,
          amount: Number(adj.totalValue) || 0,
          batch: adj.batch,
          exp: adj.exp,
          reason: typeof adj.reason === "string" ? adj.reason : undefined,
          notes: `${adj.type}: ${adj.previousStock} -> ${adj.newStock}`,
        });
      }
    });

    // Sort descending by date
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return history;
  };

  // Stock Summary & Inventory Health calculation (includes catalog + any purchased/adjusted items)
  const getStockSummaries = (): StockSummaryItem[] => {
    const buildSummaryForProduct = (product: Product): StockSummaryItem => {
      const normName = normalizeStockKey(product.normalizedName || product.name);

      // Total units purchased (including bonus)
      let totalPurchased = 0;
      let purchaseCostSum = 0;
      let purchaseCount = 0;

      purchases.forEach((pur) => {
        pur.items.forEach((item) => {
          if (isSameStockItem(product.id, normName, item.productId, item.productName)) {
            const qty = Number(item.quantity) || 0;
            const bon = Number(item.bon) || 0;
            totalPurchased += qty + bon;
            purchaseCostSum += Number(item.costRate) || 0;
            purchaseCount++;
          }
        });
      });

      // Total units sold
      let totalSold = 0;
      orders.forEach((ord) => {
        ord.items.forEach((item) => {
          if (isSameStockItem(product.id, normName, item.productId, item.productName)) {
            const qty = Number(item.quantity) || 0;
            const bon = Number(item.bon) || 0;
            totalSold += qty + bon;
          }
        });
      });

      // Total returns calculation
      let totalSaleReturns = 0;
      let totalPurchaseReturns = 0;

      returns.forEach((ret) => {
        ret.items.forEach((item) => {
          if (isSameStockItem(product.id, normName, item.productId, item.productName)) {
            const qty = Number(item.quantity) || 0;
            if (ret.returnType === "Sale Return") {
              if (item.condition === "Restockable") {
                totalSaleReturns += qty;
              }
            } else if (ret.returnType === "Purchase Return") {
              totalPurchaseReturns += qty;
            }
          }
        });
      });

      // Stock Adjustments (+ increases, - decreases)
      let totalAdjustedIncrease = 0;
      let totalAdjustedDecrease = 0;
      stockAdjustments.forEach((adj) => {
        if (isSameStockItem(product.id, normName, adj.productId, adj.productName)) {
          const qty = Number(adj.quantity) || 0;
          if (adj.type === "Increase") {
            totalAdjustedIncrease += qty;
          } else if (adj.type === "Decrease") {
            totalAdjustedDecrease += qty;
          }
        }
      });
      const netAdjusted = totalAdjustedIncrease - totalAdjustedDecrease;

      // Strict stock calculation: Available Stock = Total Purchased - Total Sold + Returns + Net Adjustments
      const availableStock = Math.max(0, totalPurchased - totalSold + totalSaleReturns - totalPurchaseReturns + netAdjusted);
      const defaultCost = product.costPrice !== undefined ? Number(product.costPrice) : product.price * 0.78;
      const avgUnitCost = purchaseCount > 0 ? purchaseCostSum / purchaseCount : defaultCost;
      const salePrice = product.price;

      let status: "In Stock" | "Low Stock" | "Out of Stock" = "Out of Stock";
      if (availableStock === 0) {
        status = "Out of Stock";
      } else if (availableStock < 10) {
        status = "Low Stock";
      } else {
        status = "In Stock";
      }

      return {
        productId: product.id,
        productName: product.name,
        productCode: product.productCode,
        category: product.category,
        currentStock: availableStock,
        availableStock,
        hasPurchaseRecord: (totalPurchased + totalAdjustedIncrease) > 0,
        unitCost: Math.round(avgUnitCost),
        salePrice,
        totalSold,
        totalPurchased,
        totalReturned: totalSaleReturns + totalPurchaseReturns,
        totalAdjusted: netAdjusted,
        totalAdjustedIncrease,
        totalAdjustedDecrease,
        stockValueCost: Math.round(availableStock * avgUnitCost),
        stockValueRetail: availableStock * salePrice,
        status,
      };
    };

    const summaries = currentProducts.map(buildSummaryForProduct);
    const coveredNorms = new Set(currentProducts.map((p) => normalizeStockKey(p.name)));
    const coveredIds = new Set(currentProducts.map((p) => p.id));

    // Also include any purchased/adjusted item not yet matched in currentProducts so nothing is ever hidden
    const extraProducts: Product[] = [];
    purchases.forEach((pur) => {
      pur.items.forEach((it) => {
        const norm = normalizeStockKey(it.productName);
        if (!norm || coveredNorms.has(norm) || coveredIds.has(it.productId)) return;
        coveredNorms.add(norm);
        coveredIds.add(it.productId);
        extraProducts.push({
          id: it.productId,
          name: it.productName.trim(),
          normalizedName: norm,
          category: it.category || "General Supplies",
          price: Number(it.salePrice) || Math.round((Number(it.costRate) || 0) / 0.78),
          costPrice: Number(it.costRate) || 0,
          sourcePriceListVersion: currentActiveVersion?.versionName || "Price List v1",
          createdAt: pur.createdAt,
          updatedAt: pur.updatedAt,
        });
      });
    });

    stockAdjustments.forEach((adj) => {
      const norm = normalizeStockKey(adj.productName);
      if (!norm || coveredNorms.has(norm) || coveredIds.has(adj.productId)) return;
      coveredNorms.add(norm);
      coveredIds.add(adj.productId);
      extraProducts.push({
        id: adj.productId,
        name: adj.productName.trim(),
        normalizedName: norm,
        category: adj.category || "General Supplies",
        price: adj.unitCost > 0 ? Math.round(adj.unitCost / 0.78) : 0,
        costPrice: Number(adj.unitCost) || 0,
        productCode: adj.productCode,
        sourcePriceListVersion: currentActiveVersion?.versionName || "Price List v1",
        createdAt: adj.createdAt,
        updatedAt: adj.updatedAt,
      });
    });

    return [...summaries, ...extraProducts.map(buildSummaryForProduct)];
  };

  // Export / Import
  const exportDatabaseJson = (): string => {
    return JSON.stringify(
      {
        settings,
        priceListVersions,
        activeVersionId,
        orders,
        purchases,
        returns,
        customers,
        expenses,
        investors,
        distributions,
        quotations,
        stockAdjustments,
        recoveries,
        exportedAt: new Date().toISOString(),
        version: "2.4",
      },
      null,
      2
    );
  };

  const importDatabaseJson = (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.priceListVersions)) {
        setPriceListVersions(data.priceListVersions);
        if (data.activeVersionId) {
          setActiveVersionId(data.activeVersionId);
        } else if (data.priceListVersions[0]) {
          setActiveVersionId(data.priceListVersions[0].id);
        }
      } else if (data.activeVersionId) {
        setActiveVersionId(data.activeVersionId);
      }
      if (Array.isArray(data.orders)) setOrders(data.orders);
      if (Array.isArray(data.purchases)) setPurchases(data.purchases);
      if (Array.isArray(data.returns)) setReturns(data.returns);
      if (Array.isArray(data.customers)) setCustomers(data.customers);
      if (Array.isArray(data.expenses)) setExpenses(data.expenses);
      if (Array.isArray(data.investors)) setInvestors(data.investors);
      if (Array.isArray(data.distributions)) setDistributions(data.distributions);
      if (Array.isArray(data.quotations)) setQuotations(data.quotations);
      if (Array.isArray(data.stockAdjustments)) setStockAdjustments(data.stockAdjustments);
      if (Array.isArray(data.recoveries)) setRecoveries(data.recoveries);
      try {
        localStorage.setItem(DB_INITIALIZED_KEY, "true");
      } catch {
        // Ignore storage errors
      }
      return true;
    } catch (e) {
      console.error("Failed to import JSON data", e);
      return false;
    }
  };

  const resetToDefaultCatalog = () => {
    setPriceListVersions([INITIAL_PRICE_LIST_VERSION]);
    setActiveVersionId(INITIAL_PRICE_LIST_VERSION.id);
    try {
      localStorage.setItem(VERSIONS_KEY, JSON.stringify([INITIAL_PRICE_LIST_VERSION]));
    } catch (e) {
      console.error("Failed to reset price list versions in localStorage", e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        priceListVersions,
        activeVersionId,
        setActiveVersionId,
        currentProducts,
        saveNewPriceListVersion,
        addProductToMaster,
        updateProductInMaster,
        deleteProductFromMaster,
        deleteMultipleProducts,
        resetToDefaultCatalog,
        recalculateOrder,
        orders,
        saveOrder,
        duplicateOrder,
        loadOrderIntoDraft,
        loadPreviousInvoiceIntoNewOrder,
        deleteOrder,
        deleteMultipleOrders,
        recordOrderPayment,
        updateOrderPayment,
        draftOrder,
        setDraftOrder,
        resetDraftOrder,
        addItemToDraft,
        updateDraftItem,
        removeDraftItem,
        deleteMultipleDraftItems,
        customers,
        saveCustomer,
        deleteCustomer,
        deleteMultipleCustomers,
        getCustomerPendingDues,
        findMatchingCustomers,
        startNewOrderWithCustomer,
        resetCustomersToDefault,
        purchases,
        savePurchase,
        deletePurchase,
        deleteMultiplePurchases,
        generateNextPurchaseNumber,
        returns,
        saveReturn,
        deleteReturn,
        deleteMultipleReturns,
        generateNextReturnNumber,
        preselectedReturnOrderNumber,
        setPreselectedReturnOrderNumber,
        preselectedReturnPurchaseRef,
        setPreselectedReturnPurchaseRef,
        expenses,
        saveExpense,
        deleteExpense,
        deleteMultipleExpenses,
        generateNextExpenseNumber,
        resetExpensesToDefault,
        investors,
        saveInvestor,
        deleteInvestor,
        resetInvestorsToDefault,
        distributions,
        saveDistribution,
        deleteDistribution,
        quotations,
        saveQuotation,
        deleteQuotation,
        deleteMultipleQuotations,
        generateNextQuotationNumber,
        convertQuotationToOrder,
        loadQuotationIntoDraft,
        duplicateQuotation,
        resetQuotationsToDefault,
        stockAdjustments,
        saveStockAdjustment,
        deleteStockAdjustment,
        deleteMultipleStockAdjustments,
        generateNextAdjustmentNumber,
        resetStockAdjustmentsToDefault,
        recoveries,
        saveRecovery,
        deleteRecovery,
        deleteMultipleRecoveries,
        generateNextReceiptNumber,
        preselectedRecoveryCustomer,
        setPreselectedRecoveryCustomer,
        getStockSummaries,
        getItemAvailableStock,
        zeroOutItemStock,
        generateProductCode,
        getProductMovementHistory,
        exportDatabaseJson,
        importDatabaseJson,
        selectedPreviewOrder,
        setSelectedPreviewOrder,
        activeNavTab,
        setActiveNavTab,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

