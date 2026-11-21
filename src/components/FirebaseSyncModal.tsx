import React, { useState } from "react";
import { useFirebase } from "../context/FirebaseContext";
import { useApp } from "../context/AppContext";
import {
  Cloud,
  CloudCheck,
  CloudOff,
  CloudUpload,
  CloudDownload,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  X,
  Server,
  Sparkles,
} from "lucide-react";

export const FirebaseSyncModal: React.FC = () => {
  const {
    user,
    authLoading,
    signIn,
    logout,
    isSyncing,
    lastSyncTime,
    syncStatus,
    syncProgressMsg,
    syncModalOpen,
    setSyncModalOpen,
    testConnectionStatus,
    uploadAllToCloud,
    downloadAllFromCloud,
  } = useFirebase();

  const {
    orders,
    currentProducts,
    purchases,
    customers,
    quotations,
    returns,
    expenses,
    stockAdjustments,
    investors,
  } = useApp();

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!syncModalOpen) return null;

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const ok = await testConnectionStatus();
    setTestingConnection(false);
    if (ok) {
      setTestResult("Connection to Firestore Enterprise verified successfully!");
    } else {
      setTestResult("Could not connect to Firestore. Check internet connection.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={() => setSyncModalOpen(false)}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                Firebase Cloud Sync
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-black/20 text-white rounded-md border border-white/20">
                  Firestore
                </span>
              </h2>
              <p className="text-xs text-amber-100">
                Persistent multi-device cloud database & user backup
              </p>
            </div>
          </div>
          <button
            onClick={() => setSyncModalOpen(false)}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Connection & Auth Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  syncStatus === "connected"
                    ? "bg-emerald-500 ring-4 ring-emerald-100"
                    : syncStatus === "syncing"
                    ? "bg-blue-500 animate-pulse ring-4 ring-blue-100"
                    : "bg-slate-400 ring-4 ring-slate-100"
                }`}
              />
              <div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  Firestore Database:
                  <span className="text-emerald-700 font-semibold">Active & Connected</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Project: celestial-icon-0xctm
                </div>
              </div>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${testingConnection ? "animate-spin" : ""}`} />
              <span>Test Ping</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                testResult.includes("verified")
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {testResult.includes("verified") ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult}</span>
            </div>
          )}

          {/* User Account / Sign In */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                User Authentication
              </span>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero-Trust Rules Protected</span>
              </div>
            </div>

            {user ? (
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      className="w-10 h-10 rounded-full border border-slate-200 shadow-2xs object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                      {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-bold text-slate-800 leading-tight">
                      {user.displayName || "Pharmacy Manager"}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                    <div className="text-[10px] text-slate-400 font-mono">UID: {user.uid.slice(0, 14)}...</div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-2 space-y-3">
                <p className="text-xs text-slate-600">
                  Sign in with your Google account to back up and sync your pharmacy orders, products, and customer directories securely with Cloud Firestore.
                </p>
                <button
                  onClick={signIn}
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {/* Google G icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.27 21.36 7.36 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.13z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.27 2.64 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>{authLoading ? "Opening Google Sign-In..." : "Sign in with Google"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Local Data Inventory Summary */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Ready for Cloud Sync</span>
              {lastSyncTime && (
                <span className="text-[11px] text-slate-500 font-normal">
                  Last Sync: <strong className="text-slate-700">{lastSyncTime}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-blue-600 font-mono">{orders.length}</div>
                <div className="text-[10px] text-slate-500">Orders</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-emerald-600 font-mono">{currentProducts.length}</div>
                <div className="text-[10px] text-slate-500">Products</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-amber-600 font-mono">{purchases.length}</div>
                <div className="text-[10px] text-slate-500">Purchases</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-purple-600 font-mono">{customers.length}</div>
                <div className="text-[10px] text-slate-500">Customers</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-teal-600 font-mono">{quotations.length}</div>
                <div className="text-[10px] text-slate-500">Quotations</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-rose-600 font-mono">{returns.length}</div>
                <div className="text-[10px] text-slate-500">Returns</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-indigo-600 font-mono">{expenses.length}</div>
                <div className="text-[10px] text-slate-500">Expenses</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="text-xs font-bold text-slate-700 font-mono">{stockAdjustments.length}</div>
                <div className="text-[10px] text-slate-500">Adjustments</div>
              </div>
            </div>
          </div>

          {/* Sync Progress message */}
          {syncProgressMsg && (
            <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-xl flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-600 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{syncProgressMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={uploadAllToCloud}
              disabled={isSyncing || !user}
              className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isSyncing ? "Uploading..." : "Upload All to Cloud"}</span>
            </button>

            <button
              onClick={downloadAllFromCloud}
              disabled={isSyncing || !user}
              className="py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloudDownload className="w-4 h-4 text-slate-600" />
              <span>Download from Cloud</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>Cloud Firestore Enterprise (Asia-Southeast1)</span>
          </div>
          <button
            onClick={() => setSyncModalOpen(false)}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
