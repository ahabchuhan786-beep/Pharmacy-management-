import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, signInWithGoogle, logoutUser, testConnection } from "../firebase/config";
import {
  bulkUploadToFirestore,
  loadOrdersFromFirestore,
  loadProductsFromFirestore,
  loadPurchasesFromFirestore,
  loadCustomersFromFirestore,
  loadQuotationsFromFirestore,
  loadReturnsFromFirestore,
  loadExpensesFromFirestore,
  loadStockAdjustmentsFromFirestore,
  loadInvestorsFromFirestore,
  loadDistributionsFromFirestore,
  loadRecoveriesFromFirestore,
  loadSettingsFromFirestore,
} from "../firebase/firestoreService";
import { useApp } from "./AppContext";

interface FirebaseContextType {
  user: User | null;
  authLoading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncStatus: "connected" | "syncing" | "offline" | "error";
  syncProgressMsg: string;
  syncModalOpen: boolean;
  setSyncModalOpen: (open: boolean) => void;
  testConnectionStatus: () => Promise<boolean>;
  uploadAllToCloud: () => Promise<{ success: boolean; error?: string }>;
  downloadAllFromCloud: () => Promise<{ success: boolean; error?: string }>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"connected" | "syncing" | "offline" | "error">("offline");
  const [syncProgressMsg, setSyncProgressMsg] = useState<string>("");
  const [syncModalOpen, setSyncModalOpen] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem("ak_pharmacy_last_firebase_sync");
  });

  const appData = useApp();

  // Test connection on boot
  useEffect(() => {
    testConnection().then(() => {
      setSyncStatus("connected");
    }).catch(() => {
      setSyncStatus("offline");
    });
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        setSyncStatus("connected");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      await signInWithGoogle();
      setSyncStatus("connected");
    } catch (err) {
      console.error("Sign-in failed", err);
      setSyncStatus("error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setSyncStatus("offline");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const testConnectionStatus = async (): Promise<boolean> => {
    try {
      await testConnection();
      setSyncStatus("connected");
      return true;
    } catch {
      setSyncStatus("error");
      return false;
    }
  };

  // Upload all current local store state to Cloud Firestore
  const uploadAllToCloud = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: "Please sign in with Google first." };
    }
    setIsSyncing(true);
    setSyncStatus("syncing");
    setSyncProgressMsg("Starting upload to Firestore...");

    try {
      const activeProducts = appData.currentProducts;
      const res = await bulkUploadToFirestore(
        user.uid,
        {
          settings: appData.settings,
          products: activeProducts,
          orders: appData.orders,
          purchases: appData.purchases,
          customers: appData.customers,
          quotations: appData.quotations,
          returns: appData.returns,
          expenses: appData.expenses,
          stockAdjustments: appData.stockAdjustments,
          investors: appData.investors,
          distributions: appData.distributions,
          recoveries: appData.recoveries,
        },
        (msg) => setSyncProgressMsg(msg)
      );

      if (res.success) {
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        setLastSyncTime(now);
        localStorage.setItem("ak_pharmacy_last_firebase_sync", now);
        setSyncStatus("connected");
        setSyncProgressMsg("Cloud sync complete!");
      } else {
        setSyncStatus("error");
        setSyncProgressMsg(res.error || "Upload failed");
      }
      return res;
    } catch (e: any) {
      setSyncStatus("error");
      const err = e?.message || "Sync failed";
      setSyncProgressMsg(err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  };

  // Download all store data from Cloud Firestore
  const downloadAllFromCloud = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: "Please sign in with Google first." };
    }
    setIsSyncing(true);
    setSyncStatus("syncing");
    setSyncProgressMsg("Fetching collections from Firestore...");

    try {
      setSyncProgressMsg("Loading settings and products...");
      const [
        remoteSettings,
        remoteProducts,
        remoteOrders,
        remotePurchases,
        remoteCustomers,
        remoteQuotations,
        remoteReturns,
        remoteExpenses,
        remoteAdjustments,
        remoteInvestors,
        remoteDistributions,
        remoteRecoveries,
      ] = await Promise.all([
        loadSettingsFromFirestore(user.uid),
        loadProductsFromFirestore(user.uid),
        loadOrdersFromFirestore(user.uid),
        loadPurchasesFromFirestore(user.uid),
        loadCustomersFromFirestore(user.uid),
        loadQuotationsFromFirestore(user.uid),
        loadReturnsFromFirestore(user.uid),
        loadExpensesFromFirestore(user.uid),
        loadStockAdjustmentsFromFirestore(user.uid),
        loadInvestorsFromFirestore(user.uid),
        loadDistributionsFromFirestore(user.uid),
        loadRecoveriesFromFirestore(user.uid),
      ]);

      if (remoteSettings) {
        appData.updateSettings(remoteSettings);
      }

      if (Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        try {
          const existingVersionsRaw = localStorage.getItem("ak_pharmacy_price_versions_v1");
          const existingVersions = existingVersionsRaw ? JSON.parse(existingVersionsRaw) : appData.priceListVersions;
          if (Array.isArray(existingVersions) && existingVersions.length > 0) {
            const activeId = localStorage.getItem("ak_pharmacy_active_version_v1") || appData.activeVersionId || existingVersions[0].id;
            const mergedVersions = existingVersions.map((ver: any) => {
              if (ver.id !== activeId) return ver;
              const map = new Map<string, any>();
              (ver.products || []).forEach((p: any) => map.set(p.id, p));
              remoteProducts.forEach((p) => map.set(p.id, p));
              const merged = Array.from(map.values());
              return { ...ver, itemCount: merged.length, products: merged };
            });
            localStorage.setItem("ak_pharmacy_price_versions_v1", JSON.stringify(mergedVersions));
          }
        } catch (err) {
          console.warn("Product merge notice:", err);
        }
      }

      // Merge / restore collections from Firestore
      if (Array.isArray(remoteOrders)) {
        localStorage.setItem("ak_pharmacy_orders_v1", JSON.stringify(remoteOrders));
      }
      if (Array.isArray(remotePurchases)) {
        localStorage.setItem("ak_pharmacy_purchases_v1", JSON.stringify(remotePurchases));
      }
      if (Array.isArray(remoteCustomers)) {
        localStorage.setItem("ak_pharmacy_customers_v1", JSON.stringify(remoteCustomers));
      }
      if (Array.isArray(remoteQuotations)) {
        localStorage.setItem("ak_pharmacy_quotations_v1", JSON.stringify(remoteQuotations));
      }
      if (Array.isArray(remoteReturns)) {
        localStorage.setItem("ak_pharmacy_returns_v1", JSON.stringify(remoteReturns));
      }
      if (Array.isArray(remoteExpenses)) {
        localStorage.setItem("ak_pharmacy_expenses_v1", JSON.stringify(remoteExpenses));
      }
      if (Array.isArray(remoteAdjustments)) {
        localStorage.setItem("ak_pharmacy_stock_adjustments_v1", JSON.stringify(remoteAdjustments));
      }
      if (Array.isArray(remoteInvestors)) {
        localStorage.setItem("ak_pharmacy_investors_v1", JSON.stringify(remoteInvestors));
      }
      if (Array.isArray(remoteDistributions)) {
        localStorage.setItem("ak_pharmacy_distributions_v1", JSON.stringify(remoteDistributions));
      }
      if (Array.isArray(remoteRecoveries)) {
        localStorage.setItem("ak_pharmacy_recoveries_v1", JSON.stringify(remoteRecoveries));
      }

      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastSyncTime(now);
      localStorage.setItem("ak_pharmacy_last_firebase_sync", now);
      setSyncStatus("connected");
      setSyncProgressMsg("Downloaded successfully! Refreshing data...");

      // Reload to reflect all downloaded state
      setTimeout(() => {
        window.location.reload();
      }, 800);

      return { success: true };
    } catch (e: any) {
      setSyncStatus("error");
      const err = e?.message || "Download failed";
      setSyncProgressMsg(err);
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authLoading,
        signIn: handleSignIn,
        logout: handleLogout,
        isSyncing,
        lastSyncTime,
        syncStatus,
        syncProgressMsg,
        syncModalOpen,
        setSyncModalOpen,
        testConnectionStatus,
        uploadAllToCloud,
        downloadAllFromCloud,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};
