import express from "express";
import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import {
  getStockSummaries,
  calculateItemStock,
  saveOrderAtomic,
  savePurchaseAtomic,
  deleteOrderAtomic,
  deletePurchaseAtomic,
  saveStockAdjustmentAtomic,
  deleteStockAdjustmentAtomic,
  getStoreState,
  initStore,
} from "./server/inventoryService.ts";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsing middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize persistent store on startup
initStore();

// Health check endpoints (both /health and /api/health for platform probes)
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Real-Time Stock Inventory API
app.get("/api/inventory/stock", (_req: Request, res: Response): void => {
  try {
    const summaries = getStockSummaries();
    res.json({ success: true, items: summaries });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/inventory/stock/:idOrName", (req: Request, res: Response): void => {
  try {
    const param = req.params.idOrName;
    const stock = calculateItemStock(param, param);
    res.json({ success: true, stock });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Orders (Sales) API with Backend Atomic Validation & Negative Stock Prevention
app.get("/api/orders", (_req: Request, res: Response): void => {
  try {
    const state = getStoreState();
    res.json({ success: true, orders: state.orders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/orders", async (req: Request, res: Response): Promise<void> => {
  try {
    const order = req.body;
    const result = await saveOrderAtomic(order);
    res.json({ success: true, ...result });
  } catch (err: any) {
    // 400 Bad Request when stock is insufficient or item has no purchase records
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put("/api/orders/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const order = { ...req.body, id: req.params.id };
    const result = await saveOrderAtomic(order);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/orders/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deleteOrderAtomic(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Purchases API with Immediate Inventory Increase
app.get("/api/purchases", (_req: Request, res: Response): void => {
  try {
    const state = getStoreState();
    res.json({ success: true, purchases: state.purchases });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/purchases", async (req: Request, res: Response): Promise<void> => {
  try {
    const purchase = req.body;
    const result = await savePurchaseAtomic(purchase);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/purchases/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deletePurchaseAtomic(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Stock Adjustments API (Increase / Decrease Physical Inventory Reconciliation)
app.get("/api/stock-adjustments", (_req: Request, res: Response): void => {
  try {
    const state = getStoreState();
    res.json({ success: true, adjustments: state.stockAdjustments || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/stock-adjustments", async (req: Request, res: Response): Promise<void> => {
  try {
    const adjustment = req.body;
    const result = await saveStockAdjustmentAtomic(adjustment);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/stock-adjustments/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await deleteStockAdjustmentAtomic(req.params.id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Initialize Gemini client lazily
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Extract price list endpoint using Gemini Document Understanding
app.post("/api/extract-price-list", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileData, mimeType, fileName, textContent } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({
        error: "Gemini API key is not configured on the server.",
      });
      return;
    }

    const systemInstruction = `You are an expert pharmacy and medical-surgical inventory data extraction specialist.
Your task is to extract all product names, categories, unit prices (in Pakistani Rupees / PKR), and optional product codes from the provided Pharmacy Inventory Price List document or text.

Strict Rules:
1. Extract only genuine pharmaceutical/medical products and supplies.
2. Accurately separate category headers/headings (e.g. "Dressing & Wound Care", "Syringes & Needles", "Diagnostic Devices", "Surgical Disposables") from actual products.
3. Mark detected category headers with isCategoryHeader: true and price: 0 so the user can filter them or view category structure.
4. Extract the exact numerical price without currency symbols (e.g., if it says "Rs. 1,530" or "1530/-" or "1530", price is 1530).
5. DO NOT invent prices. If a price is not listed, set price: 0.
6. Provide the raw line or item string for quality control verification.
7. Return total lines processed, total products detected, and total headings detected.`;

    const extractionSchema = {
      type: Type.OBJECT,
      properties: {
        totalLinesProcessed: { type: Type.INTEGER, description: "Total lines or items read" },
        totalProductsDetected: { type: Type.INTEGER, description: "Count of genuine sellable products" },
        totalHeadingsDetected: { type: Type.INTEGER, description: "Count of section headers/headings" },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Clean standardized product name" },
              category: { type: Type.STRING, description: "Product category (e.g. Syringes, Strips, Wound Care, General)" },
              price: { type: Type.NUMBER, description: "Price in PKR as a valid number" },
              productCode: { type: Type.STRING, description: "Optional product code/SKU if available" },
              isCategoryHeader: { type: Type.BOOLEAN, description: "True if this is a section header, not a sellable product" },
              rawText: { type: Type.STRING, description: "Original text representation from document" },
            },
            required: ["name", "category", "price", "isCategoryHeader"],
          },
        },
      },
      required: ["totalLinesProcessed", "totalProductsDetected", "totalHeadingsDetected", "items"],
    };

    let contents: any;

    if (fileData && mimeType) {
      // PDF or Image document
      contents = {
        parts: [
          {
            inlineData: {
              data: fileData,
              mimeType: mimeType,
            },
          },
          {
            text: `Please thoroughly parse and extract all pharmacy inventory products and their prices from this uploaded price list (${fileName || "document"}). Ensure all product names and exact prices are extracted without omission.`,
          },
        ],
      };
    } else if (textContent) {
      // Text or CSV dump
      contents = {
        parts: [
          {
            text: `Extract all pharmacy products and prices from the following text data:\n\n${textContent}`,
          },
        ],
      };
    } else {
      res.status(400).json({ error: "Missing fileData or textContent in request payload." });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        temperature: 0.1,
      },
    });

    const outputText = response.text?.trim() || "{}";
    let parsedData;
    try {
      parsedData = JSON.parse(outputText);
    } catch (e) {
      console.error("Failed to parse Gemini JSON output:", outputText);
      res.status(500).json({ error: "Failed to parse extraction response from AI model.", raw: outputText });
      return;
    }

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error("Error in /api/extract-price-list:", error);
    res.status(500).json({
      error: error.message || "An error occurred during price list extraction.",
    });
  }
});

// Smart Product Matching API endpoint
app.post("/api/smart-match", async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, products } = req.body;
    if (!query || !Array.isArray(products) || products.length === 0) {
      res.status(400).json({ error: "Query and a non-empty products list are required." });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(500).json({ error: "Gemini API key is not configured." });
      return;
    }

    const prompt = `User typed the following search query for a pharmacy item: "${query}".
Given this inventory list of product names and IDs:
${JSON.stringify(
  products.slice(0, 150).map((p: any) => ({ id: p.id, name: p.name, price: p.price, category: p.category })),
  null,
  2
)}

Determine the best matching product(s). Common shorthand in pharmacy:
- "Sufra tule" -> "Surfe Tulles"
- "Stripe 3cc" -> "Syringe 3cc Clinic"
- "B braun" -> "B Braun 1cc Insulin Syringe"
- "Oncall extra" -> "Oncall Extra (Strip)"
- "Branula 22" -> "Branula 22 Veinofix"
- "Fixomull" -> "Fixomull" or "Fixomull Life Care"

Return the top matched product IDs, confidence scores (0.0 to 1.0), and a brief explanation.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        bestMatchId: { type: Type.STRING, description: "ID of top matched product or null if none" },
        confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" },
        possibleMatches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productId: { type: Type.STRING },
              productName: { type: Type.STRING },
              price: { type: Type.NUMBER },
              score: { type: Type.NUMBER },
              reason: { type: Type.STRING },
            },
            required: ["productId", "productName", "price", "score"],
          },
        },
      },
      required: ["confidence", "possibleMatches"],
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json({ success: true, match: parsed });
  } catch (error: any) {
    console.error("Error in /api/smart-match:", error);
    res.status(500).json({ error: error.message || "Failed to perform AI smart match" });
  }
});

async function startServer() {
  // Determine if running in production mode (via NODE_ENV or when running bundled CJS file)
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" &&
      (__filename.endsWith(".cjs") || __filename.includes("dist")));

  if (!isProduction) {
    // HMR is disabled in this environment; serve a clean /@vite/client shim so CSS style updates
    // and import.meta.hot calls work normally without opening failing WebSocket connections.
    app.get("/@vite/client", (_req: Request, res: Response) => {
      res.type("application/javascript").send(`
const sheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
const cspNonce = "document" in globalThis ? document.querySelector("meta[property=csp-nonce]")?.nonce : void 0;
let lastInsertedStyle;
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (cspNonce) style.setAttribute("nonce", cspNonce);
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = void 0; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export const ErrorOverlay = class extends HTMLElement {};
const noop = () => {};
export function createHotContext() {
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
`);
    });

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Robust resolution of dist directory
    const distPath =
      typeof __dirname !== "undefined" && fs.existsSync(path.join(__dirname, "index.html"))
        ? __dirname
        : fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
        ? path.join(process.cwd(), "dist")
        : path.resolve("dist");

    console.log(`Serving static production files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pharmacy Order & Invoice App running at http://0.0.0.0:${PORT} [mode: ${isProduction ? "production" : "development"}]`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
