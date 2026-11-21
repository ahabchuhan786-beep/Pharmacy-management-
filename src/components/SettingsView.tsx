import React, { useState, useRef } from "react";
import { useApp } from "../context/AppContext";
import { PharmacySettings } from "../types";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import {
  Building,
  Phone,
  FileBadge,
  User,
  Shield,
  Save,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Trash2,
  Smartphone,
  Cloud,
  CloudUpload,
  CloudDownload,
  Database,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { AndroidApkModal } from "./AndroidApkModal";
import { useFirebase } from "../context/FirebaseContext";

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, priceListVersions, orders, resetToDefaultCatalog } = useApp();
  const {
    user,
    signIn,
    logout,
    syncStatus,
    setSyncModalOpen,
    uploadAllToCloud,
    downloadAllFromCloud,
    isSyncing,
    lastSyncTime,
  } = useFirebase();
  const [form, setForm] = useState<PharmacySettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [showApkModal, setShowApkModal] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  const handleLogoFileChange = (file: File) => {
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Please upload a valid image file (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo image size should be under 2MB for optimal performance.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.onerror = () => {
      setLogoError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoFileChange(file);
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: undefined }));
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Full backup JSON export
  const handleExportBackup = () => {
    const backupData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      settings: form,
      priceListVersions,
      orders,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Pharmacy_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Backup restore
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.settings) {
          localStorage.setItem("ak_pharmacy_settings_v1", JSON.stringify(json.settings));
          setForm(json.settings);
        }
        if (json.priceListVersions) {
          localStorage.setItem("ak_pharmacy_price_versions_v1", JSON.stringify(json.priceListVersions));
        }
        if (json.orders) {
          localStorage.setItem("ak_pharmacy_orders_v1", JSON.stringify(json.orders));
        }
        alert("Backup successfully restored! Reloading application...");
        window.location.reload();
      } catch (err) {
        alert("Failed to parse backup JSON file. Ensure it is a valid backup.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="settings-view" className="max-w-4xl mx-auto space-y-4 pb-20 md:pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">Pharmacy & System Settings</h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure header credentials, licenses, default salesman, and PDF formatting.
          </p>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-lg animate-fadeIn">
            <CheckCircle2 className="w-4 h-4" />
            <span>Saved Successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Pharmacy Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
            <Building className="w-4 h-4 text-blue-600" />
            <span>Pharmacy Business Identity & Header</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pharmacy / Business Name *
              </label>
              <input
                type="text"
                required
                value={form.pharmacyName}
                onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone / Contact Numbers
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Business Address (Printed on Invoice Header)
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Drug License Number (Lic. No)
              </label>
              <input
                type="text"
                value={form.licenseNo}
                onChange={(e) => setForm({ ...form, licenseNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NTN / Tax Registration Number
              </label>
              <input
                type="text"
                value={form.ntn}
                onChange={(e) => setForm({ ...form, ntn: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Logo Upload Component */}
            <div className="md:col-span-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pharmacy Brand Logo (Printed on Invoices & Header)
              </label>

              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFileChange(file);
                }}
                className="hidden"
                id="pharmacy-logo-input"
              />

              {form.logoUrl ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-20 h-20 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    <img
                      src={form.logoUrl}
                      alt="Pharmacy Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="text-xs font-bold text-slate-800">Logo Uploaded & Active</p>
                    <p className="text-[11px] text-slate-500">
                      This logo is automatically displayed on your invoice headers and embedded in generated A4 PDFs.
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => logoFileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md transition-colors cursor-pointer"
                      >
                        Change Logo
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-2.5 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleLogoDrop}
                  onClick={() => logoFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/70 rounded-xl p-4 text-center cursor-pointer transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Click to upload or drag and drop pharmacy logo
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    PNG, JPG, SVG or WebP (Max 2MB) &bull; Transparent PNG recommended
                  </p>
                </div>
              )}

              {logoError && (
                <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{logoError}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Signatures & Operational Defaults */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
            <FileBadge className="w-4 h-4 text-blue-600" />
            <span>Invoice Signatures & Personnel</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Salesman Name
              </label>
              <input
                type="text"
                value={form.defaultSalesman}
                onChange={(e) => setForm({ ...form, defaultSalesman: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prepared By (Signatory)
              </label>
              <input
                type="text"
                value={form.preparedBy}
                onChange={(e) => setForm({ ...form, preparedBy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Printed By (Signatory)
              </label>
              <input
                type="text"
                value={form.printedBy}
                onChange={(e) => setForm({ ...form, printedBy: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Footer Terms / Remarks (Printed on bottom of Invoice)
              </label>
              <textarea
                rows={3}
                value={form.footerRemarks}
                onChange={(e) => setForm({ ...form, footerRemarks: e.target.value })}
                placeholder="Enter custom remarks or surgical items verification terms..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 text-xs sm:text-sm leading-relaxed resize-y"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                This remark statement appears at the bottom of all generated invoice PDFs and preview summaries.
              </p>
            </div>
          </div>
        </div>

        {/* Sale Invoice Return Settings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>Sale Invoice Return Settings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-rose-300 transition-colors">
              <input
                type="checkbox"
                checked={form.fullInvoiceReturnByDefault !== false}
                onChange={(e) =>
                  setForm({ ...form, fullInvoiceReturnByDefault: e.target.checked })
                }
                className="w-4 h-4 mt-0.5 rounded text-rose-600 border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Full Invoice Return by Invoice # (Default Mode)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  When returning a sale invoice, entering or selecting an Invoice # automatically loads all products, quantities, rates, and customer details for 1-click full return instead of adding items one by one.
                </p>
              </div>
            </label>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Default Stock Condition on Sale Return
              </label>
              <select
                value={form.defaultSaleReturnCondition || "Restockable"}
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultSaleReturnCondition: e.target.value as
                      | "Restockable"
                      | "Damaged / Quarantine",
                  })
                }
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-rose-500"
              >
                <option value="Restockable">
                  Restockable (Add returned items back to sellable stock)
                </option>
                <option value="Damaged / Quarantine">
                  Damaged / Quarantine (Keep out of sellable stock)
                </option>
              </select>
              <p className="text-[11px] text-slate-500">
                Can still be overridden per invoice or per item during return entry.
              </p>
            </div>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            id="btn-save-settings"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* FIREBASE CLOUD DATABASE & REALTIME SYNC */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
            <Database className="w-4 h-4 text-amber-600" />
            <span>Firebase Cloud Firestore Database</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Connected to Cloud Database</span>
          </div>
        </div>

        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Cloud Storage & Sync State:
              {user ? (
                <span className="text-emerald-700 font-semibold text-xs">
                  Signed in as {user.displayName || user.email}
                </span>
              ) : (
                <span className="text-amber-800 font-medium text-xs">
                  Ready to link with Google Account
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Securely persist your orders, price lists, customer ledgers, and financial records in Google Cloud Firestore.
            </p>
            {lastSyncTime && (
              <div className="text-[11px] text-slate-500 mt-1">
                Last Cloud Backup: <strong className="text-slate-800">{lastSyncTime}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => setSyncModalOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>Open Cloud Sync</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Cloud className="w-4 h-4 text-amber-600" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={uploadAllToCloud}
            disabled={isSyncing || !user}
            className="p-3.5 bg-slate-50 hover:bg-amber-50/70 border border-slate-200 hover:border-amber-300 rounded-xl text-left space-y-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-2 text-slate-900 group-hover:text-amber-900 font-bold text-xs">
              <CloudUpload className="w-4 h-4 text-amber-600" />
              <span>Backup All Data to Cloud Firestore</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Uploads all catalog items, purchases, customer profiles, and order receipts to your secure cloud partition.
            </p>
          </button>

          <button
            type="button"
            onClick={downloadAllFromCloud}
            disabled={isSyncing || !user}
            className="p-3.5 bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-xl text-left space-y-1 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-center gap-2 text-slate-900 group-hover:text-blue-900 font-bold text-xs">
              <CloudDownload className="w-4 h-4 text-blue-600" />
              <span>Restore All Data from Cloud Firestore</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Synchronizes remote Firestore records down to this device for offline and fast local caching.
            </p>
          </button>
        </div>
      </div>

      {/* Backup & System Maintenance */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Data Backup, Export & Factory Reset</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left space-y-1 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Download className="w-4 h-4 text-blue-600" />
              <span>Export Full JSON Backup</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Download all price list versions, products, and order history as a backup file.
            </p>
          </button>

          <div
            onClick={() => jsonFileInputRef.current?.click()}
            className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left space-y-1 transition-colors cursor-pointer"
          >
            <input
              ref={jsonFileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Restore from JSON Backup</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Load previously exported price lists, settings, and orders.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmDeleteModal({
                isOpen: true,
                title: "Reset to Baseline Surgical Catalog",
                message: "Are you sure you want to reset the price list to the default 91-item surgical catalog? This will restore original master rates.",
                confirmButtonText: "Yes, Reset Catalog",
                onConfirm: () => {
                  resetToDefaultCatalog();
                  setConfirmDeleteModal(null);
                },
              });
            }}
            className="p-3.5 bg-red-50 hover:bg-red-100/70 border border-red-200 rounded-xl text-left space-y-1 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
              <RefreshCw className="w-4 h-4" />
              <span>Reset to Seed Catalog</span>
            </div>
            <p className="text-[11px] text-red-600">
              Restores baseline 91 medical supplies & initial price list v1.
            </p>
          </button>
        </div>
      </div>

      {/* ANDROID MOBILE APP & APK SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Android APK &amp; Mobile App</h2>
              <p className="text-xs text-slate-500">
                Install as a native full-screen Android app or generate a standalone APK package
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowApkModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Open APK Options</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl text-left space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Method 1</span>
            <div className="font-bold text-slate-900 text-xs">Direct WebAPK Install</div>
            <p className="text-[11px] text-slate-500">
              Android creates and installs an official APK directly from Chrome without downloading from Play Store.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl text-left space-y-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Method 2</span>
            <div className="font-bold text-slate-900 text-xs">PWABuilder .APK File</div>
            <p className="text-[11px] text-slate-500">
              Generate signed/unsigned APK &amp; AAB packages for direct APK sideloading or Google Play Console.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-xl text-left space-y-1">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Offline Support</span>
            <div className="font-bold text-slate-900 text-xs">Service Worker Caching</div>
            <p className="text-[11px] text-slate-500">
              All UI assets, catalog pricing, and offline storage are cached locally for resilient mobile usage.
            </p>
          </div>
        </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteModal && (
        <ConfirmDeleteModal
          isOpen={confirmDeleteModal.isOpen}
          title={confirmDeleteModal.title}
          message={confirmDeleteModal.message}
          itemDescription={confirmDeleteModal.itemDescription}
          confirmButtonText={confirmDeleteModal.confirmButtonText}
          onConfirm={confirmDeleteModal.onConfirm}
          onCancel={() => setConfirmDeleteModal(null)}
        />
      )}

      {/* ANDROID APK MODAL */}
      <AndroidApkModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
};
