import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { PdfTemplateId } from "../types";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { FileText, CheckCircle2, Eye, Palette, Sparkles } from "lucide-react";

export const PdfTemplatesView: React.FC = () => {
  const { settings, updateSettings, orders, draftOrder } = useApp();
  const [previewTemplate, setPreviewTemplate] = useState<PdfTemplateId | null>(null);

  const sampleOrderToPreview = orders[0] || draftOrder;

  const templates = [
    {
      id: "nafees_ak" as PdfTemplateId,
      name: "AK Pharmacy / Nafees Commercial Invoice",
      description:
        "Authentic Pakistani pharmacy invoice layout featuring dual header banner, customer credentials (Address, City, Lic #, NTN), clean 9-column table (Item, Batch, Rate, Qty, Bon, Gross, Disc %, Net Amt), up to 30 items per first page, calculated grand total in words, and authorized signature.",
      badge: "Default & Recommended",
      tags: ["Commercial", "9 Columns", "30 Items / Page", "Dual Header", "Full Legal Specs"],
    },
    {
      id: "simple_list" as PdfTemplateId,
      name: "Simple Purchase Order Slip",
      description:
        "A clean, minimalist 5-column order list focusing purely on Item Description, Quantity, Master Rate, and Line Total. Ideal for quick counter picking slips and internal delivery manifests.",
      badge: "Minimalist",
      tags: ["Picking Slip", "5 Columns", "Compact"],
    },
    {
      id: "professional_po" as PdfTemplateId,
      name: "Formal Institutional Purchase Order",
      description:
        "Dark-header corporate institutional layout designed for hospital procurement departments, tenders, and clinical bulk medical supply contracts.",
      badge: "Corporate / Institutional",
      tags: ["Formal", "Institutional", "Hospital Supplies"],
    },
  ];

  return (
    <div id="pdf-templates-view" className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-12">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
            Invoice & PDF Layout Templates
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Choose the default PDF invoice layout generated for customer orders. You can also switch layouts on-the-fly inside the preview modal.
        </p>
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((tpl) => {
          const isSelected = settings.defaultPdfTemplate === tpl.id;
          return (
            <div
              key={tpl.id}
              className={`bg-white rounded-xl border transition-all p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-sm ${
                isSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    {tpl.badge}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-xs font-bold text-blue-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Active Default</span>
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-slate-900 text-sm sm:text-base">{tpl.name}</h3>

                <p className="text-xs text-slate-500 leading-relaxed">{tpl.description}</p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tpl.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(tpl.id)}
                  className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Layout</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ defaultPdfTemplate: tpl.id })}
                  disabled={isSelected}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 border border-blue-200 cursor-default"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  }`}
                >
                  {isSelected ? "Selected" : "Set Default"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Modal */}
      {previewTemplate && (
        <InvoicePreviewModal
          order={{ ...sampleOrderToPreview, pdfTemplate: previewTemplate }}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
};
