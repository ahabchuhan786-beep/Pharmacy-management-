import { Product } from "../types";

/**
 * Generates or guarantees a unique product code for any inventory product.
 * Standard format: PRD-001, PRD-002, etc., or category-based prefix if desired.
 */
export function generateNextProductCode(existingProducts?: Product[], category?: any): string {
  // Find all numeric sequences in existing product codes
  const usedNumbers = new Set<number>();
  const safeProducts = Array.isArray(existingProducts) ? existingProducts : [];

  safeProducts.forEach((p) => {
    if (p && p.productCode && typeof p.productCode === "string") {
      const match = p.productCode.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > 0) {
          usedNumbers.add(num);
        }
      }
    }
  });

  // Find lowest available positive number starting from 1
  let next = 1;
  while (usedNumbers.has(next)) {
    next++;
  }

  // Optional category prefix mapping
  let prefix = "PRD";
  if (typeof category === "string" && category.trim()) {
    const cat = category.toLowerCase().trim();
    if (cat.includes("strip") || cat.includes("diagnostic")) prefix = "DIA";
    else if (cat.includes("syringe") || cat.includes("needle")) prefix = "SYR";
    else if (cat.includes("dressing") || cat.includes("gauze") || cat.includes("cotton")) prefix = "DRS";
    else if (cat.includes("infusion") || cat.includes("iv") || cat.includes("cannula")) prefix = "IVS";
    else if (cat.includes("tape") || cat.includes("bandage")) prefix = "BND";
    else if (cat.includes("glove") || cat.includes("disposable")) prefix = "DSP";
    else if (cat.includes("device") || cat.includes("meter")) prefix = "DEV";
  }

  return `${prefix}-${String(next).padStart(3, "0")}`;
}

/**
 * Sanitizes an array of products ensuring EVERY single product has a guaranteed, non-empty unique product code.
 */
export function sanitizeProductsWithCodes(products: Product[]): Product[] {
  const seenCodes = new Set<string>();
  const updated: Product[] = [];

  products.forEach((p, idx) => {
    let code = (p.productCode || "").trim();
    if (!code || seenCodes.has(code.toUpperCase())) {
      code = `PRD-${String(idx + 1).padStart(3, "0")}`;
      let counter = idx + 1;
      while (seenCodes.has(code.toUpperCase())) {
        counter++;
        code = `PRD-${String(counter).padStart(3, "0")}`;
      }
    }

    seenCodes.add(code.toUpperCase());
    const cost = p.costPrice !== undefined ? Number(p.costPrice) : Math.round((Number(p.price) || 0) * 0.78);
    updated.push({
      ...p,
      productCode: code,
      costPrice: cost,
    });
  });

  return updated;
}
