import fs from "fs";
import path from "path";
import type { Order, PurchaseOrder, Product, ReturnRecord, StockSummaryItem, StockAdjustment } from "../src/types.ts";
import {
  INITIAL_PURCHASES,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS_V1,
  INITIAL_RETURNS,
  INITIAL_STOCK_ADJUSTMENTS,
} from "../src/data/defaultData.ts";

export interface DBState {
  orders: Order[];
  purchases: PurchaseOrder[];
  products: Product[];
  returns: ReturnRecord[];
  stockAdjustments: StockAdjustment[];
}

// Storage path for atomic database persistence
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "pharmacy_store.json");

// In-memory working state
let memoryState: DBState = {
  orders: INITIAL_ORDERS,
  purchases: INITIAL_PURCHASES,
  products: INITIAL_PRODUCTS_V1,
  returns: INITIAL_RETURNS,
  stockAdjustments: INITIAL_STOCK_ADJUSTMENTS,
};

let isInitialized = false;

// Concurrency mutex lock to ensure all purchases and sales are strictly atomic operations
let lockPromise = Promise.resolve();
export async function runWithLock<T>(action: () => Promise<T> | T): Promise<T> {
  const nextLock = lockPromise.then(
    () => action(),
    () => action()
  );
  lockPromise = nextLock.then(
    () => {},
    () => {}
  );
  return nextLock;
}

// Ensure database file directory exists and initialize state
export function initStore(): DBState {
  if (isInitialized) return memoryState;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.orders) && Array.isArray(parsed.purchases)) {
        memoryState = {
          orders: parsed.orders,
          purchases: parsed.purchases,
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS_V1,
          returns: Array.isArray(parsed.returns) ? parsed.returns : INITIAL_RETURNS,
          stockAdjustments: Array.isArray(parsed.stockAdjustments) ? parsed.stockAdjustments : INITIAL_STOCK_ADJUSTMENTS,
        };
        isInitialized = true;
        return memoryState;
      }
    }
  } catch (err) {
    console.warn("Could not read database file, initializing with baseline seed data:", err);
  }

  // Fallback / First run
  memoryState = {
    orders: INITIAL_ORDERS,
    purchases: INITIAL_PURCHASES,
    products: INITIAL_PRODUCTS_V1,
    returns: INITIAL_RETURNS,
    stockAdjustments: INITIAL_STOCK_ADJUSTMENTS,
  };

  persistStoreToDisk();
  isInitialized = true;
  return memoryState;
}

// Write current state to persistent storage
function persistStoreToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(memoryState, null, 2), "utf-8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error("Error writing persistent store to disk:", err);
  }
}

// Calculate precise stock metrics for a single item
export function calculateItemStock(
  productId?: string,
  productName?: string,
  state: DBState = memoryState,
  excludeOrderId?: string
) {
  initStore();
  const norm = (productName || "").toLowerCase().trim();

  // 1. Total purchased quantity
  let totalPurchased = 0;
  for (const pur of state.purchases) {
    for (const it of pur.items) {
      const itNorm = (it.productName || "").toLowerCase().trim();
      if ((productId && it.productId === productId) || (norm && itNorm === norm)) {
        totalPurchased += (Number(it.quantity) || 0) + (Number(it.bon) || 0);
      }
    }
  }

  // 2. Total sold quantity (excluding specific order if currently being re-saved/updated)
  let totalSold = 0;
  for (const ord of state.orders) {
    if (excludeOrderId && ord.id === excludeOrderId) continue;
    for (const it of ord.items) {
      const itNorm = (it.productName || "").toLowerCase().trim();
      if ((productId && it.productId === productId) || (norm && itNorm === norm)) {
        totalSold += (Number(it.quantity) || 0) + (Number(it.bon) || 0);
      }
    }
  }

  // 3. Returns adjustment
  let totalSaleReturns = 0;
  let totalPurchaseReturns = 0;
  if (state.returns) {
    for (const ret of state.returns) {
      for (const it of ret.items) {
        const itNorm = (it.productName || "").toLowerCase().trim();
        if ((productId && it.productId === productId) || (norm && itNorm === norm)) {
          const qty = Number(it.quantity) || 0;
          if (ret.returnType === "Sale Return" && it.condition === "Restockable") {
            totalSaleReturns += qty;
          } else if (ret.returnType === "Purchase Return") {
            totalPurchaseReturns += qty;
          }
        }
      }
    }
  }

  // 4. Stock Adjustments (+ increase, - decrease)
  let totalAdjustedIncrease = 0;
  let totalAdjustedDecrease = 0;
  if (state.stockAdjustments) {
    for (const adj of state.stockAdjustments) {
      const itNorm = (adj.productName || "").toLowerCase().trim();
      if ((productId && adj.productId === productId) || (norm && itNorm === norm)) {
        const qty = Number(adj.quantity) || 0;
        if (adj.type === "Increase") {
          totalAdjustedIncrease += qty;
        } else if (adj.type === "Decrease") {
          totalAdjustedDecrease += qty;
        }
      }
    }
  }
  const netAdjusted = totalAdjustedIncrease - totalAdjustedDecrease;

  // 5. Strict Stock Calculation: Available Stock = Total Purchased - Total Sold + Returns + Net Adjustments
  const availableStock = Math.max(0, totalPurchased - totalSold + totalSaleReturns - totalPurchaseReturns + netAdjusted);

  let status: "In Stock" | "Low Stock" | "Out of Stock" = "Out of Stock";
  if (availableStock === 0) {
    status = "Out of Stock";
  } else if (availableStock < 10) {
    status = "Low Stock";
  } else {
    status = "In Stock";
  }

  return {
    productId,
    productName,
    totalPurchased,
    totalSold,
    totalReturned: totalSaleReturns + totalPurchaseReturns,
    totalAdjusted: netAdjusted,
    availableStock,
    currentStock: availableStock,
    hasPurchaseRecord: (totalPurchased + totalAdjustedIncrease) > 0,
    status,
  };
}

// Get stock summaries for all catalog products and purchased items
export function getStockSummaries(): StockSummaryItem[] {
  initStore();
  const products = memoryState.products;
  const purchases = memoryState.purchases;

  // Build a unique catalog of all known products from master + any custom items purchased
  const itemMap = new Map<string, { id: string; name: string; category: string; code?: string; price: number }>();

  for (const p of products) {
    itemMap.set(p.name.toLowerCase().trim(), {
      id: p.id,
      name: p.name,
      category: p.category,
      code: p.productCode,
      price: p.price,
    });
  }

  for (const pur of purchases) {
    for (const it of pur.items) {
      const key = it.productName.toLowerCase().trim();
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          id: it.productId || `custom-${key}`,
          name: it.productName,
          category: it.category || "General Supplies",
          price: it.salePrice || Math.round(it.costRate * 1.25),
        });
      }
    }
  }

  const summaries: StockSummaryItem[] = [];

  for (const item of itemMap.values()) {
    const stock = calculateItemStock(item.id, item.name, memoryState);

    // Calculate weighted average cost from purchases
    let costSum = 0;
    let count = 0;
    for (const pur of purchases) {
      for (const it of pur.items) {
        if (it.productId === item.id || it.productName.toLowerCase().trim() === item.name.toLowerCase().trim()) {
          costSum += Number(it.costRate) || 0;
          count++;
        }
      }
    }
    const unitCost = count > 0 ? Math.round(costSum / count) : Math.round(item.price * 0.78);

    summaries.push({
      productId: item.id,
      productName: item.name,
      productCode: item.code,
      category: item.category,
      totalPurchased: stock.totalPurchased,
      totalSold: stock.totalSold,
      totalReturned: stock.totalReturned,
      availableStock: stock.availableStock,
      currentStock: stock.availableStock,
      hasPurchaseRecord: stock.hasPurchaseRecord,
      unitCost,
      salePrice: item.price,
      stockValueCost: stock.availableStock * unitCost,
      stockValueRetail: stock.availableStock * item.price,
      status: stock.status,
    });
  }

  return summaries;
}

// Atomically validate and save a Sale Order
export async function saveOrderAtomic(order: Order): Promise<{ order: Order; stockSummaries: StockSummaryItem[] }> {
  return runWithLock(async () => {
    initStore();

    if (!order.id) {
      order.id = `ord-${Date.now()}`;
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      throw new Error("Sale order must contain at least one item.");
    }

    // Strict validation of each item in the order
    for (const item of order.items) {
      const requestedQty = (Number(item.quantity) || 0) + (Number(item.bon) || 0);
      if (requestedQty <= 0) {
        throw new Error(`Quantity for "${item.productName}" must be greater than 0.`);
      }

      // Calculate stock excluding this order if it is an existing order being updated
      const stock = calculateItemStock(item.productId, item.productName, memoryState, order.id);

      // Rule 2: Only In-Stock Inventory Can Be Sold. Item must have recorded inventory or purchase.
      if (!stock.hasPurchaseRecord) {
        throw new Error(
          `Cannot sell "${item.productName}". No inventory or purchase record exists for this item. An item can only be sold if stock is recorded.`
        );
      }

      // Rule 2: If an item's available quantity is 0, the sale must be blocked.
      if (stock.availableStock <= 0) {
        throw new Error(
          `Insufficient stock. Available quantity: 0. "${item.productName}" is currently out of stock.`
        );
      }

      // Rule 3: Sales Quantity Validation. Sale quantity must never be greater than available stock.
      if (requestedQty > stock.availableStock) {
        throw new Error(
          `Insufficient stock. Available quantity: ${stock.availableStock}`
        );
      }
    }

    // All items passed validation! Atomically save to store
    const existingIndex = memoryState.orders.findIndex((o) => o.id === order.id);
    const updatedOrder = {
      ...order,
      updatedAt: new Date().toISOString(),
      createdAt: order.createdAt || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      memoryState.orders[existingIndex] = updatedOrder;
    } else {
      memoryState.orders = [updatedOrder, ...memoryState.orders];
    }

    persistStoreToDisk();

    return {
      order: updatedOrder,
      stockSummaries: getStockSummaries(),
    };
  });
}

// Atomically save a Purchase Order (Increases available stock immediately)
export async function savePurchaseAtomic(purchase: PurchaseOrder): Promise<{ purchase: PurchaseOrder; stockSummaries: StockSummaryItem[] }> {
  return runWithLock(async () => {
    initStore();

    if (!purchase.id) {
      purchase.id = `pur-${Date.now()}`;
    }

    if (!Array.isArray(purchase.items) || purchase.items.length === 0) {
      throw new Error("Purchase order must contain at least one item.");
    }

    for (const it of purchase.items) {
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) {
        throw new Error(`Purchase quantity for "${it.productName}" must be greater than 0.`);
      }
    }

    const existingIndex = memoryState.purchases.findIndex((p) => p.id === purchase.id);
    const updatedPurchase = {
      ...purchase,
      updatedAt: new Date().toISOString(),
      createdAt: purchase.createdAt || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      memoryState.purchases[existingIndex] = updatedPurchase;
    } else {
      memoryState.purchases = [updatedPurchase, ...memoryState.purchases];
    }

    persistStoreToDisk();

    return {
      purchase: updatedPurchase,
      stockSummaries: getStockSummaries(),
    };
  });
}

// Atomically delete a Sale Order
export async function deleteOrderAtomic(orderId: string): Promise<{ stockSummaries: StockSummaryItem[] }> {
  return runWithLock(async () => {
    initStore();
    memoryState.orders = memoryState.orders.filter((o) => o.id !== orderId);
    persistStoreToDisk();
    return { stockSummaries: getStockSummaries() };
  });
}

// Atomically delete a Purchase Order (with check to ensure it doesn't cause negative stock for sold items)
export async function deletePurchaseAtomic(purchaseId: string): Promise<{ stockSummaries: StockSummaryItem[] }> {
  return runWithLock(async () => {
    initStore();

    const target = memoryState.purchases.find((p) => p.id === purchaseId);
    if (!target) {
      return { stockSummaries: getStockSummaries() };
    }

    // Check if removing this purchase would result in negative available stock for any item
    const testPurchases = memoryState.purchases.filter((p) => p.id !== purchaseId);
    const testState: DBState = {
      ...memoryState,
      purchases: testPurchases,
    };

    for (const it of target.items) {
      const stock = calculateItemStock(it.productId, it.productName, testState);
      if (stock.availableStock < 0 || (stock.totalSold > 0 && stock.totalPurchased < stock.totalSold)) {
        throw new Error(
          `Cannot delete purchase "${target.purchaseNumber}". Items have already been sold in customer orders. Deleting this purchase would cause negative inventory.`
        );
      }
    }

    memoryState.purchases = testPurchases;
    persistStoreToDisk();
    return { stockSummaries: getStockSummaries() };
  });
}

// Atomically save or update a Stock Adjustment
export async function saveStockAdjustmentAtomic(
  adjustment: StockAdjustment
): Promise<{ adjustment: StockAdjustment; stockSummaries: StockSummaryItem[] }> {
  return runWithLock(async () => {
    initStore();

    if (!adjustment.productId && !adjustment.productName) {
      throw new Error("Product is required for stock adjustment.");
    }
    if ((Number(adjustment.quantity) || 0) <= 0) {
      throw new Error("Adjustment quantity must be greater than 0.");
    }

    const updatedAdj: StockAdjustment = {
      ...adjustment,
      updatedAt: new Date().toISOString(),
      createdAt: adjustment.createdAt || new Date().toISOString(),
    };

    const existingIndex = (memoryState.stockAdjustments || []).findIndex((a) => a.id === adjustment.id);
    if (existingIndex >= 0) {
      memoryState.stockAdjustments[existingIndex] = updatedAdj;
    } else {
      memoryState.stockAdjustments = [updatedAdj, ...(memoryState.stockAdjustments || [])];
    }

    persistStoreToDisk();
    return { adjustment: updatedAdj, stockSummaries: getStockSummaries() };
  });
}

// Atomically delete a Stock Adjustment
export async function deleteStockAdjustmentAtomic(
  adjId: string
): Promise<{ stockSummaries: StockSummaryItem[] }> {
  return runWithLock(async () => {
    initStore();
    memoryState.stockAdjustments = (memoryState.stockAdjustments || []).filter((a) => a.id !== adjId);
    persistStoreToDisk();
    return { stockSummaries: getStockSummaries() };
  });
}

// Access current state
export function getStoreState(): DBState {
  initStore();
  return memoryState;
}
