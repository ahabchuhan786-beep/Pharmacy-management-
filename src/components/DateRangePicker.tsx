import React from "react";
import { Calendar, RotateCcw, ArrowRight } from "lucide-react";

export type DateRangePreset =
  | "all"
  | "today"
  | "7d"
  | "this_month"
  | "last_month"
  | "30d"
  | "custom";

export interface DateRangeValue {
  startDate: string; // YYYY-MM-DD or ""
  endDate: string; // YYYY-MM-DD or ""
  preset: DateRangePreset;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const toIsoDateLocal = (dt: Date): string => {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const formatShortDate = (isoDate: string): string => {
  if (!isoDate) return "";
  const parts = isoDate.slice(0, 10).split("-");
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mName = months[Math.max(0, Math.min(11, Number(m) - 1))] || m;
  return `${d} ${mName} ${y}`;
};

export const normalizeDateRange = (
  startDate: string,
  endDate: string
): { start: string; end: string; label: string } => {
  const s = startDate ? startDate.slice(0, 10) : "";
  const e = endDate ? endDate.slice(0, 10) : "";
  if (!s && !e) {
    return { start: "", end: "", label: "All Time" };
  }
  const start = s && e && s > e ? e : s;
  const end = s && e && s > e ? s : e;
  if (start && end) {
    return {
      start,
      end,
      label:
        start === end
          ? formatShortDate(start)
          : `${formatShortDate(start)} – ${formatShortDate(end)}`,
    };
  }
  if (start) {
    return { start, end: "", label: `From ${formatShortDate(start)}` };
  }
  return { start: "", end, label: `Up to ${formatShortDate(end)}` };
};

export const isDateWithinRange = (
  dateStr: string | undefined,
  start: string,
  end: string
): boolean => {
  if (!start && !end) return true;
  if (!dateStr) return false;
  const key = dateStr.slice(0, 10);
  if (start && key < start) return false;
  if (end && key > end) return false;
  return true;
};

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  title = "Financial Period Filter",
  subtitle = "Filter total sales, purchases & profit by start and end dates",
  className = "",
}) => {
  const now = new Date();
  const todayStr = toIsoDateLocal(now);

  const applyPreset = (preset: Exclude<DateRangePreset, "custom">) => {
    if (preset === "all") {
      onChange({ startDate: "", endDate: "", preset: "all" });
      return;
    }
    if (preset === "today") {
      onChange({ startDate: todayStr, endDate: todayStr, preset: "today" });
      return;
    }
    if (preset === "7d") {
      const start = toIsoDateLocal(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
      );
      onChange({ startDate: start, endDate: todayStr, preset: "7d" });
      return;
    }
    if (preset === "30d") {
      const start = toIsoDateLocal(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
      );
      onChange({ startDate: start, endDate: todayStr, preset: "30d" });
      return;
    }
    if (preset === "this_month") {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}-01`;
      onChange({ startDate: start, endDate: todayStr, preset: "this_month" });
      return;
    }
    if (preset === "last_month") {
      const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      onChange({
        startDate: toIsoDateLocal(firstPrev),
        endDate: toIsoDateLocal(lastPrev),
        preset: "last_month",
      });
    }
  };

  const normalized = normalizeDateRange(value.startDate, value.endDate);
  const isFiltered = Boolean(value.startDate || value.endDate);

  const presets: Array<{ id: Exclude<DateRangePreset, "custom">; label: string }> = [
    { id: "all", label: "All Time" },
    { id: "today", label: "Today" },
    { id: "7d", label: "Last 7 Days" },
    { id: "this_month", label: "This Month" },
    { id: "last_month", label: "Last Month" },
    { id: "30d", label: "Last 30 Days" },
  ];

  return (
    <div
      id="dashboard-date-range-picker"
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5 ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                  isFiltered
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {normalized.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Start & End Date Inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <label
              htmlFor="dashboard-start-date"
              className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              From
            </label>
            <input
              id="dashboard-start-date"
              type="date"
              value={value.startDate}
              onChange={(e) =>
                onChange({
                  startDate: e.target.value,
                  endDate: value.endDate,
                  preset: e.target.value || value.endDate ? "custom" : "all",
                })
              }
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <label
              htmlFor="dashboard-end-date"
              className="text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              To
            </label>
            <input
              id="dashboard-end-date"
              type="date"
              value={value.endDate}
              onChange={(e) =>
                onChange({
                  startDate: value.startDate,
                  endDate: e.target.value,
                  preset: value.startDate || e.target.value ? "custom" : "all",
                })
              }
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          {isFiltered && (
            <button
              id="btn-reset-dashboard-date-range"
              type="button"
              onClick={() => applyPreset("all")}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset to All Time"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
        <span className="text-[11px] font-semibold text-slate-400 mr-1">
          Quick Select:
        </span>
        {presets.map((p) => {
          const active = value.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {value.preset === "custom" && (
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Custom Range
          </span>
        )}
      </div>
    </div>
  );
};
