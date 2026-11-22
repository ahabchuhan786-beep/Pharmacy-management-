import React, { useState } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { Navigation } from "./components/Navigation";
import { DashboardView } from "./components/DashboardView";
import { NewOrderView } from "./components/NewOrderView";
import { QuotationsView } from "./components/QuotationsView";
import { StockAdjustmentsView } from "./components/StockAdjustmentsView";
import { PriceListView } from "./components/PriceListView";
import { PurchasesView } from "./components/PurchasesView";
import { ExpensesView } from "./components/ExpensesView";
import { InvestorProfitView } from "./components/InvestorProfitView";
import { ReportsView } from "./components/ReportsView";
import { ReturnsView } from "./components/ReturnsView";
import { CustomersView } from "./components/CustomersView";
import { DailyRecoveryView } from "./components/DailyRecoveryView";
import { OrdersHistoryView } from "./components/OrdersHistoryView";
import { PdfTemplatesView } from "./components/PdfTemplatesView";
import { SettingsView } from "./components/SettingsView";
import { OrderReviewModal } from "./components/OrderReviewModal";
import { InvoicePreviewModal } from "./components/InvoicePreviewModal";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { Order } from "./types";

const MainContent: React.FC = () => {
  const { activeNavTab, draftOrder, saveOrder } = useApp();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [saveOrderError, setSaveOrderError] = useState<string | null>(null);
  const [activeInvoicePreview, setActiveInvoicePreview] = useState<Order | null>(null);

  const handleConfirmGeneratePdf = () => {
    setSaveOrderError(null);
    const orderToSave: Order = {
      ...draftOrder,
      status: "Generated",
    };
    // Save draft order to database/history with stock validation
    const result = saveOrder(orderToSave);
    if (!result.success || !result.order) {
      setSaveOrderError(result.error || "Cannot save order due to stock validation failure.");
      return;
    }
    setShowReviewModal(false);
    setSaveOrderError(null);
    setActiveInvoicePreview(result.order);
  };

  return (
    <>
      <Navigation>
        <main className="p-3 sm:p-6 md:p-8">
          {activeNavTab === "dashboard" && <DashboardView />}
          {activeNavTab === "new-order" && (
            <NewOrderView
              onOpenReview={() => {
                setSaveOrderError(null);
                setShowReviewModal(true);
              }}
            />
          )}
          {activeNavTab === "quotations" && <QuotationsView />}
          {activeNavTab === "stock-adjustments" && <StockAdjustmentsView />}
          {activeNavTab === "purchases" && <PurchasesView />}
          {activeNavTab === "expenses" && <ExpensesView />}
          {activeNavTab === "investor-profit" && <InvestorProfitView />}
          {activeNavTab === "reports" && <ReportsView />}
          {activeNavTab === "returns" && <ReturnsView />}
          {activeNavTab === "customers" && <CustomersView />}
          {activeNavTab === "daily-recovery" && <DailyRecoveryView />}
          {activeNavTab === "price-list" && <PriceListView />}
          {activeNavTab === "orders-history" && <OrdersHistoryView />}
          {activeNavTab === "pdf-templates" && <PdfTemplatesView />}
          {activeNavTab === "settings" && <SettingsView />}
        </main>
      </Navigation>

      {/* Offline Connectivity Notification */}
      <OfflineIndicator />

      {/* Pre-PDF Validation & Order Review Modal */}
      <OrderReviewModal
        isOpen={showReviewModal}
        onClose={() => {
          setSaveOrderError(null);
          setShowReviewModal(false);
        }}
        onConfirmGeneratePdf={handleConfirmGeneratePdf}
        saveError={saveOrderError}
      />

      {/* Live A4 Invoice & Order PDF Viewer Modal */}
      {activeInvoicePreview && (
        <InvoicePreviewModal
          order={activeInvoicePreview}
          onClose={() => setActiveInvoicePreview(null)}
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
