import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./config";
import { handleFirestoreError, OperationType } from "./errorHandler";
import {
  Customer,
  Expense,
  Investor,
  MonthlyProfitDistribution,
  Order,
  PharmacySettings,
  Product,
  PurchaseOrder,
  Quotation,
  RecoveryRecord,
  ReturnRecord,
  StockAdjustment,
} from "../types";

// User root path helper
export const getUserPath = (userId: string) => `users/${userId}`;

// Subcollection path helpers
export const getSubcollectionPath = (userId: string, subcollection: string) =>
  `users/${userId}/${subcollection}`;

// 1. Settings
export const saveSettingsToFirestore = async (userId: string, settings: PharmacySettings): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "settings")}/general`;
  try {
    await setDoc(doc(db, "users", userId, "settings", "general"), {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const loadSettingsFromFirestore = async (userId: string): Promise<PharmacySettings | null> => {
  const path = `${getSubcollectionPath(userId, "settings")}/general`;
  try {
    const snap = await getDoc(doc(db, "users", userId, "settings", "general"));
    if (snap.exists()) {
      return snap.data() as PharmacySettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

// 2. Orders
export const saveOrderToFirestore = async (userId: string, order: Order): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "orders")}/${order.id}`;
  try {
    await setDoc(doc(db, "users", userId, "orders", order.id), {
      ...order,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteOrderFromFirestore = async (userId: string, orderId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "orders")}/${orderId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "orders", orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadOrdersFromFirestore = async (userId: string): Promise<Order[]> => {
  const path = getSubcollectionPath(userId, "orders");
  try {
    const snap = await getDocs(collection(db, "users", userId, "orders"));
    return snap.docs.map((d) => d.data() as Order);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 3. Products
export const saveProductToFirestore = async (userId: string, product: Product): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "products")}/${product.id}`;
  try {
    await setDoc(doc(db, "users", userId, "products", product.id), {
      ...product,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteProductFromFirestore = async (userId: string, productId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "products")}/${productId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "products", productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadProductsFromFirestore = async (userId: string): Promise<Product[]> => {
  const path = getSubcollectionPath(userId, "products");
  try {
    const snap = await getDocs(collection(db, "users", userId, "products"));
    return snap.docs.map((d) => d.data() as Product);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 4. Purchases
export const savePurchaseToFirestore = async (userId: string, purchase: PurchaseOrder): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "purchases")}/${purchase.id}`;
  try {
    await setDoc(doc(db, "users", userId, "purchases", purchase.id), {
      ...purchase,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deletePurchaseFromFirestore = async (userId: string, purchaseId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "purchases")}/${purchaseId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "purchases", purchaseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadPurchasesFromFirestore = async (userId: string): Promise<PurchaseOrder[]> => {
  const path = getSubcollectionPath(userId, "purchases");
  try {
    const snap = await getDocs(collection(db, "users", userId, "purchases"));
    return snap.docs.map((d) => d.data() as PurchaseOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 5. Customers
export const saveCustomerToFirestore = async (userId: string, customer: Customer): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "customers")}/${customer.id}`;
  try {
    await setDoc(doc(db, "users", userId, "customers", customer.id), {
      ...customer,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteCustomerFromFirestore = async (userId: string, customerId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "customers")}/${customerId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "customers", customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadCustomersFromFirestore = async (userId: string): Promise<Customer[]> => {
  const path = getSubcollectionPath(userId, "customers");
  try {
    const snap = await getDocs(collection(db, "users", userId, "customers"));
    return snap.docs.map((d) => d.data() as Customer);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 6. Quotations
export const saveQuotationToFirestore = async (userId: string, quotation: Quotation): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "quotations")}/${quotation.id}`;
  try {
    await setDoc(doc(db, "users", userId, "quotations", quotation.id), {
      ...quotation,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteQuotationFromFirestore = async (userId: string, quotationId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "quotations")}/${quotationId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "quotations", quotationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadQuotationsFromFirestore = async (userId: string): Promise<Quotation[]> => {
  const path = getSubcollectionPath(userId, "quotations");
  try {
    const snap = await getDocs(collection(db, "users", userId, "quotations"));
    return snap.docs.map((d) => d.data() as Quotation);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 7. Returns
export const saveReturnToFirestore = async (userId: string, ret: ReturnRecord): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "returns")}/${ret.id}`;
  try {
    await setDoc(doc(db, "users", userId, "returns", ret.id), {
      ...ret,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteReturnFromFirestore = async (userId: string, returnId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "returns")}/${returnId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "returns", returnId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadReturnsFromFirestore = async (userId: string): Promise<ReturnRecord[]> => {
  const path = getSubcollectionPath(userId, "returns");
  try {
    const snap = await getDocs(collection(db, "users", userId, "returns"));
    return snap.docs.map((d) => d.data() as ReturnRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 8. Expenses
export const saveExpenseToFirestore = async (userId: string, exp: Expense): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "expenses")}/${exp.id}`;
  try {
    await setDoc(doc(db, "users", userId, "expenses", exp.id), {
      ...exp,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteExpenseFromFirestore = async (userId: string, expenseId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "expenses")}/${expenseId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "expenses", expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadExpensesFromFirestore = async (userId: string): Promise<Expense[]> => {
  const path = getSubcollectionPath(userId, "expenses");
  try {
    const snap = await getDocs(collection(db, "users", userId, "expenses"));
    return snap.docs.map((d) => d.data() as Expense);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 9. Stock Adjustments
export const saveStockAdjustmentToFirestore = async (
  userId: string,
  adj: StockAdjustment
): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "stockAdjustments")}/${adj.id}`;
  try {
    await setDoc(doc(db, "users", userId, "stockAdjustments", adj.id), {
      ...adj,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteStockAdjustmentFromFirestore = async (
  userId: string,
  adjId: string
): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "stockAdjustments")}/${adjId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "stockAdjustments", adjId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadStockAdjustmentsFromFirestore = async (
  userId: string
): Promise<StockAdjustment[]> => {
  const path = getSubcollectionPath(userId, "stockAdjustments");
  try {
    const snap = await getDocs(collection(db, "users", userId, "stockAdjustments"));
    return snap.docs.map((d) => d.data() as StockAdjustment);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 10. Investors & Distributions
export const saveInvestorToFirestore = async (userId: string, investor: Investor): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "investors")}/${investor.id}`;
  try {
    await setDoc(doc(db, "users", userId, "investors", investor.id), {
      ...investor,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteInvestorFromFirestore = async (userId: string, investorId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "investors")}/${investorId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "investors", investorId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadInvestorsFromFirestore = async (userId: string): Promise<Investor[]> => {
  const path = getSubcollectionPath(userId, "investors");
  try {
    const snap = await getDocs(collection(db, "users", userId, "investors"));
    return snap.docs.map((d) => d.data() as Investor);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const saveDistributionToFirestore = async (
  userId: string,
  dist: MonthlyProfitDistribution
): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "distributions")}/${dist.id}`;
  try {
    await setDoc(doc(db, "users", userId, "distributions", dist.id), {
      ...dist,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteDistributionFromFirestore = async (userId: string, distId: string): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "distributions")}/${distId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "distributions", distId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadDistributionsFromFirestore = async (
  userId: string
): Promise<MonthlyProfitDistribution[]> => {
  const path = getSubcollectionPath(userId, "distributions");
  try {
    const snap = await getDocs(collection(db, "users", userId, "distributions"));
    return snap.docs.map((d) => d.data() as MonthlyProfitDistribution);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// 11. Daily Recoveries & Receiving Receipts
export const saveRecoveryToFirestore = async (
  userId: string,
  recovery: RecoveryRecord
): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "recoveries")}/${recovery.id}`;
  try {
    const cleanPayload = Object.fromEntries(
      Object.entries({
        ...recovery,
        updatedAt: new Date().toISOString(),
      }).filter(([, val]) => val !== undefined)
    );
    await setDoc(doc(db, "users", userId, "recoveries", recovery.id), cleanPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteRecoveryFromFirestore = async (
  userId: string,
  recoveryId: string
): Promise<void> => {
  const path = `${getSubcollectionPath(userId, "recoveries")}/${recoveryId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "recoveries", recoveryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const loadRecoveriesFromFirestore = async (
  userId: string
): Promise<RecoveryRecord[]> => {
  const path = getSubcollectionPath(userId, "recoveries");
  try {
    const snap = await getDocs(collection(db, "users", userId, "recoveries"));
    return snap.docs.map((d) => d.data() as RecoveryRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

// Bulk backup / sync all local store state to Cloud Firestore
export const bulkUploadToFirestore = async (
  userId: string,
  data: {
    settings: PharmacySettings;
    products: Product[];
    orders: Order[];
    purchases: PurchaseOrder[];
    customers: Customer[];
    quotations: Quotation[];
    returns: ReturnRecord[];
    expenses: Expense[];
    stockAdjustments: StockAdjustment[];
    investors: Investor[];
    distributions: MonthlyProfitDistribution[];
    recoveries: RecoveryRecord[];
  },
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> => {
  try {
    onProgress?.("Saving user account and settings...");
    await setDoc(
      doc(db, "users", userId),
      {
        uid: userId,
        email: auth.currentUser?.email || "",
        displayName: auth.currentUser?.displayName || "Pharmacy User",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    await saveSettingsToFirestore(userId, data.settings);

    // Save orders in batches and clean up deleted orders
    onProgress?.(`Uploading ${data.orders.length} orders...`);
    const existingOrders = await loadOrdersFromFirestore(userId).catch(() => []);
    const newOrderIds = new Set(data.orders.map((o) => o.id));
    for (const oldOrd of (existingOrders || [])) {
      if (!newOrderIds.has(oldOrd.id)) {
        await deleteOrderFromFirestore(userId, oldOrd.id).catch(() => {});
      }
    }
    for (const order of data.orders) {
      await saveOrderToFirestore(userId, order);
    }

    // Save products and clean up deleted products
    onProgress?.(`Uploading ${data.products.length} products...`);
    const existingProducts = await loadProductsFromFirestore(userId).catch(() => []);
    const newProductIds = new Set(data.products.map((p) => p.id));
    for (const oldProd of (existingProducts || [])) {
      if (!newProductIds.has(oldProd.id)) {
        await deleteProductFromFirestore(userId, oldProd.id).catch(() => {});
      }
    }
    for (const product of data.products) {
      await saveProductToFirestore(userId, product);
    }

    // Save purchases and clean up deleted purchases
    onProgress?.(`Uploading ${data.purchases.length} purchases...`);
    const existingPurchases = await loadPurchasesFromFirestore(userId).catch(() => []);
    const newPurchaseIds = new Set(data.purchases.map((p) => p.id));
    for (const oldPur of (existingPurchases || [])) {
      if (!newPurchaseIds.has(oldPur.id)) {
        await deletePurchaseFromFirestore(userId, oldPur.id).catch(() => {});
      }
    }
    for (const purchase of data.purchases) {
      await savePurchaseToFirestore(userId, purchase);
    }

    // Save customers
    onProgress?.(`Uploading ${data.customers.length} customers...`);
    for (const customer of data.customers) {
      await saveCustomerToFirestore(userId, customer);
    }

    // Save quotations
    onProgress?.(`Uploading ${data.quotations.length} quotations...`);
    for (const quotation of data.quotations) {
      await saveQuotationToFirestore(userId, quotation);
    }

    // Save returns
    onProgress?.(`Uploading ${data.returns.length} returns...`);
    for (const ret of data.returns) {
      await saveReturnToFirestore(userId, ret);
    }

    // Save expenses
    onProgress?.(`Uploading ${data.expenses.length} expenses...`);
    for (const exp of data.expenses) {
      await saveExpenseToFirestore(userId, exp);
    }

    // Save stock adjustments and clean up deleted adjustments
    onProgress?.(`Uploading ${data.stockAdjustments.length} stock adjustments...`);
    const existingAdjustments = await loadStockAdjustmentsFromFirestore(userId).catch(() => []);
    const newAdjIds = new Set(data.stockAdjustments.map((a) => a.id));
    for (const oldAdj of (existingAdjustments || [])) {
      if (!newAdjIds.has(oldAdj.id)) {
        await deleteStockAdjustmentFromFirestore(userId, oldAdj.id).catch(() => {});
      }
    }
    for (const adj of data.stockAdjustments) {
      await saveStockAdjustmentToFirestore(userId, adj);
    }

    // Save investors & distributions
    onProgress?.(`Uploading investors and distributions...`);
    for (const inv of data.investors) {
      await saveInvestorToFirestore(userId, inv);
    }
    for (const dist of data.distributions) {
      await saveDistributionToFirestore(userId, dist);
    }

    // Save daily recoveries and clean up deleted recoveries
    onProgress?.(`Uploading ${data.recoveries.length} daily recoveries...`);
    const existingRecoveries = await loadRecoveriesFromFirestore(userId).catch(() => []);
    const newRecoveryIds = new Set(data.recoveries.map((r) => r.id));
    for (const oldRec of (existingRecoveries || [])) {
      if (!newRecoveryIds.has(oldRec.id)) {
        await deleteRecoveryFromFirestore(userId, oldRec.id).catch(() => {});
      }
    }
    for (const rec of data.recoveries) {
      await saveRecoveryToFirestore(userId, rec);
    }

    onProgress?.("All data successfully uploaded to Firebase Cloud Firestore!");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
};
