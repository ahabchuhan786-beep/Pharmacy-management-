import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  History,
  FileText,
  Settings,
  Sparkles,
  ShoppingBag,
  BarChart3,
  RotateCcw,
  Users,
  Receipt,
  Coins,
  FileSpreadsheet,
  SlidersHorizontal,
  Menu,
  X,
  Pill,
  ChevronRight,
  TrendingUp,
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  HandCoins,
} from "lucide-react";
import { PWAInstallButton } from "./PWAInstallButton";
import { AndroidApkModal } from "./AndroidApkModal";
import { UniversalDocumentSearchModal } from "./UniversalDocumentSearchModal";
import { FirebaseSyncButton } from "./FirebaseSyncButton";

interface NavigationProps {
  children?: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({ children }) => {
  const {
    activeNavTab,
    setActiveNavTab,
    settings,
    draftOrder,
    loadSampleTestOrder,
    currentProducts,
    priceListVersions,
    activeVersionId,
    purchases,
    returns,
    customers,
    expenses,
    investors,
    quotations,
    stockAdjustments,
    recoveries,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apkModalOpen, setApkModalOpen] = useState(false);
  const [docSearchOpen, setDocSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener to open universal document search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDocSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("ak_pharmacy_desktop_sidebar_open");
    return saved !== null ? saved === "true" : true;
  });

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("ak_pharmacy_desktop_sidebar_open", String(next));
      }
      return next;
    });
  };

  const activeVer = priceListVersions.find((v) => v.id === activeVersionId);

  // Grouped Navigation Structure
  const navSections = [
    {
      group: "Core Sales",
      urdu: "فروخت اور نرخ نامہ",
      items: [
        { id: "new-order", label: "New Sale Order", icon: PlusCircle, badge: draftOrder.items.length || undefined, badgeColor: "bg-blue-600 text-white" },
        { id: "quotations", label: "Quotations (نرخ نامہ)", icon: FileSpreadsheet, badge: quotations.length || undefined, badgeColor: "bg-indigo-600 text-white" },
        { id: "orders-history", label: "Sales History", icon: History },
      ],
    },
    {
      group: "Inventory & Stock",
      urdu: "اسٹاک اور سامان",
      items: [
        { id: "price-list", label: "Price List & Catalog", icon: ClipboardList, badge: currentProducts.length, badgeColor: "bg-slate-700 text-slate-300" },
        { id: "stock-adjustments", label: "Stock Adjustments (ایڈجسٹمنٹ)", icon: SlidersHorizontal, badge: stockAdjustments.length || undefined, badgeColor: "bg-emerald-600 text-white" },
        { id: "purchases", label: "Stock Purchases", icon: ShoppingBag, badge: purchases.length || undefined, badgeColor: "bg-amber-600 text-white" },
        { id: "returns", label: "Returns (واپسی)", icon: RotateCcw, badge: returns.length || undefined, badgeColor: "bg-rose-600 text-white" },
      ],
    },
    {
      group: "Directory & Finance",
      urdu: "کسٹمرز اور اکاؤنٹس",
      items: [
        { id: "customers", label: "Customers Directory", icon: Users, badge: customers.length || undefined },
        { id: "daily-recovery", label: "Daily Recovery (ریکوری)", icon: HandCoins, badge: recoveries.length || undefined, badgeColor: "bg-emerald-600 text-white" },
        { id: "expenses", label: "Daily Expenses", icon: Receipt, badge: expenses.length || undefined },
        { id: "investor-profit", label: "Investor Profit Sharing", icon: Coins, badge: investors.filter((i) => i.isActive).length || undefined },
        { id: "reports", label: "Reports & Analytics", icon: BarChart3 },
      ],
    },
    {
      group: "System & Config",
      urdu: "سسٹم اور ترتیبات",
      items: [
        { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard },
        { id: "pdf-templates", label: "PDF Templates", icon: FileText },
        { id: "mobile-apk", label: "Android APK & Mobile App", icon: Smartphone, badgeColor: "bg-emerald-600 text-white" },
        { id: "settings", label: "System Settings", icon: Settings },
      ],
    },
  ];

  // Mobile Bottom Navigation Primary Items
  const mobileBottomItems = [
    { id: "new-order", label: "Sale", icon: PlusCircle, badge: draftOrder.items.length || undefined },
    { id: "quotations", label: "Quotes", icon: FileSpreadsheet, badge: quotations.length || undefined },
    { id: "price-list", label: "Stock", icon: ClipboardList },
    { id: "stock-adjustments", label: "Adjust", icon: SlidersHorizontal, badge: stockAdjustments.length || undefined },
    { id: "more", label: "Menu", icon: Menu },
  ];

  const handleNavClick = (tabId: string) => {
    if (tabId === "mobile-apk") {
      setApkModalOpen(true);
      setMobileMenuOpen(false);
      return;
    }
    setActiveNavTab(tabId);
    setMobileMenuOpen(false);
  };

  // Header Title mapping
  const getHeaderTitle = () => {
    switch (activeNavTab) {
      case "new-order":
        return "Create Sales Order & Invoice";
      case "quotations":
        return "Price Quotations & Estimates (نرخ نامہ / کوٹیشن)";
      case "stock-adjustments":
        return "Stock Adjustments & Recounts (اسٹاک میں کمی یا اضافہ)";
      case "customers":
        return "Customer Directory & Profiles";
      case "daily-recovery":
        return "Daily Recovery & Receiving Receipts (روزانہ ریکوری)";
      case "purchases":
        return "Stock Purchases & Supplier Bills";
      case "expenses":
        return "Daily Expenses & Ledgers (اخراجات)";
      case "investor-profit":
        return "Monthly Profit & Investor Dividends";
      case "reports":
        return "Sales, Stock & Financial Reports";
      case "returns":
        return "Sales & Purchase Returns";
      case "dashboard":
        return "Pharmacy Management Dashboard";
      case "price-list":
        return "Master Inventory & Price List";
      case "orders-history":
        return "Sales Orders & Invoices History";
      case "pdf-templates":
        return "Invoice & PDF Templates";
      case "settings":
        return "Pharmacy & System Settings";
      default:
        return "Pharmacy Management System";
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      {/* 1. Desktop Sidebar (collapsible with smooth transition) */}
      <aside
        id="desktop-sidebar"
        className={`hidden md:flex flex-col bg-[#1e293b] text-white shrink-0 h-full select-none border-r border-slate-800 shadow-xl z-20 transition-all duration-300 ease-in-out ${
          desktopSidebarOpen
            ? "w-64 opacity-100"
            : "w-0 border-r-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-700/80 bg-slate-900/40">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${
                settings.logoUrl ? "bg-white p-1 shadow-sm" : "bg-transparent p-0"
              }`}
            >
              <img
                src={settings.logoUrl || "/logo.png"}
                alt="PharmaFlow Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-bold tracking-tight text-base sm:text-lg text-white block truncate leading-tight">
                PharmaFlow
              </span>
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {settings.pharmacyName && settings.pharmacyName !== "PharmaFlow"
                  ? settings.pharmacyName
                  : settings.address
                    ? settings.address.split(",")[0]
                    : "Pharmacy Management"}
              </span>
            </div>
          </div>

          {/* Desktop Close Sidebar Button */}
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
            title="Close Sidebar (سائیڈ مینو بند کریں)"
            aria-label="Close Desktop Sidebar"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links (Scrollable with categorized groups) */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.group} className="space-y-1">
              <div className="px-3 py-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>{section.group}</span>
                <span className="text-[9px] font-urdu text-slate-400 font-normal">{section.urdu}</span>
              </div>

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeNavTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-link-${item.id}`}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-900/30"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-mono font-bold ${
                          isActive
                            ? "bg-white text-blue-700"
                            : item.badgeColor || "bg-slate-800 text-slate-300 border border-slate-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Install Android App / APK button */}
        <div className="p-3 border-t border-slate-700/80 bg-slate-900/40 shrink-0">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-700/80 text-xs bg-slate-900/60 shrink-0 space-y-1.5">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Salesman:</span>
            <span className="text-slate-200 font-semibold">{settings.defaultSalesman}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Lic. No:</span>
            <span className="text-slate-300 font-mono text-[10px] truncate max-w-[120px]" title={settings.licenseNo}>
              {settings.licenseNo || "Direct"}
            </span>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Slide-Over Drawer with Animated Backdrop */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Container */}
          <aside className="relative flex flex-col w-4/5 max-w-xs bg-[#1e293b] text-white h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/40 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${
                    settings.logoUrl ? "bg-white p-1 shadow-xs" : "bg-transparent p-0"
                  }`}
                >
                  <img
                    src={settings.logoUrl || "/logo.png"}
                    alt="PharmaFlow Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate">PharmaFlow</h3>
                  <span className="text-[10px] text-slate-400 font-medium block truncate">
                    {settings.pharmacyName && settings.pharmacyName !== "PharmaFlow"
                      ? settings.pharmacyName
                      : "All System Modules"}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions inside Drawer */}
            <div className="p-3 bg-slate-800/40 border-b border-slate-700/60 flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  loadSampleTestOrder();
                  setMobileMenuOpen(false);
                }}
                className="flex-1 py-1.5 px-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Load 27 Items</span>
              </button>

              {draftOrder.items.length > 0 && (
                <button
                  onClick={() => {
                    handleNavClick("new-order");
                  }}
                  className="py-1.5 px-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold shrink-0"
                >
                  Draft ({draftOrder.items.length})
                </button>
              )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 p-3 space-y-3.5 overflow-y-auto">
              {navSections.map((section) => (
                <div key={section.group} className="space-y-1">
                  <div className="px-2 py-0.5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>{section.group}</span>
                    <span className="text-[9px] font-urdu text-slate-400 font-normal">{section.urdu}</span>
                  </div>

                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNavTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                          isActive
                            ? "bg-blue-600 text-white font-bold shadow-sm"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                          <span>{item.label}</span>
                        </div>

                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-full font-mono font-bold ${
                              isActive
                                ? "bg-white text-blue-700"
                                : item.badgeColor || "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Install Android App / APK button in Mobile Drawer */}
            <div className="p-3 border-t border-slate-700/80 bg-slate-900/40 shrink-0">
              <PWAInstallButton variant="sidebar" />
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-700/80 text-[11px] text-slate-400 bg-slate-900/60 shrink-0 flex items-center justify-between">
              <span>Salesman: <strong>{settings.defaultSalesman}</strong></span>
              <span className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px]">{activeVer?.versionName || "v3.2"}</span>
            </div>
          </aside>
        </div>
      )}

      {/* 3. Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header
          id="app-top-header"
          className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3.5 sm:px-6 md:px-8 shrink-0 text-slate-800 shadow-xs"
        >
          {/* Left section: Hamburger on mobile + Desktop Sidebar Toggle + Title */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              id="btn-mobile-hamburger"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Toggle Button */}
            <button
              type="button"
              id="btn-toggle-desktop-sidebar"
              onClick={toggleDesktopSidebar}
              className="hidden md:flex items-center gap-1.5 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-slate-200/80 shadow-2xs"
              title={desktopSidebarOpen ? "Close Sidebar (سائیڈ مینو بند کریں)" : "Open Sidebar (سائیڈ مینو کھولیں)"}
              aria-label="Toggle Desktop Sidebar"
            >
              {desktopSidebarOpen ? (
                <PanelLeftClose className="w-5 h-5 text-slate-600" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs">
                  <PanelLeftOpen className="w-4 h-4 text-white" />
                  <span>Open Menu (سائیڈ مینو)</span>
                </div>
              )}
            </button>

            {/* Mobile Pharmacy Brand (visible when space is tight) */}
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <span className="font-bold tracking-tight text-sm sm:text-base text-slate-900 truncate">
                {getHeaderTitle().split("(")[0]}
              </span>
            </div>

            {/* Desktop Breadcrumb & Title */}
            <div className="hidden md:flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {getHeaderTitle()}
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-md shrink-0">
                {activeVer?.versionName || "v3.2"}
              </span>
            </div>
          </div>

          {/* Right section: Draft pill, Load 27-item test, User Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Universal Document Search Button */}
            <button
              id="btn-universal-doc-search"
              onClick={() => setDocSearchOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl transition-all cursor-pointer shadow-2xs group"
              title="Search Purchase, Sale, Quotation, Return by Document # or Party (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />
              <span className="hidden sm:inline">Search Doc #</span>
              <kbd className="hidden md:inline px-1 py-0.2 text-[9px] font-mono bg-white text-slate-500 border border-slate-300 rounded shadow-2xs">
                ⌘K
              </kbd>
            </button>

            {/* Active Order Number */}
            <span className="text-xs font-mono text-slate-500 hidden xl:inline-block">
              Order #{draftOrder.orderNumber}
            </span>

            {/* Load 27-item sample test button */}
            <button
              id="btn-load-sample-test"
              onClick={loadSampleTestOrder}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
              title="Load the 27 sample items from test specification with exact quantities"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Load 27-Item Sample</span>
            </button>

            {/* Quick Draft Button */}
            {draftOrder.items.length > 0 && activeNavTab !== "new-order" && (
              <button
                id="btn-go-to-draft"
                onClick={() => setActiveNavTab("new-order")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <span>Draft:</span>
                <span className="bg-white/20 px-1.5 py-0.2 rounded font-mono font-bold">
                  {draftOrder.items.length}
                </span>
              </button>
            )}

            {/* Quick Link to Adjust Stock */}
            {activeNavTab !== "stock-adjustments" && (
              <button
                onClick={() => setActiveNavTab("stock-adjustments")}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                title="Stock Adjustments"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                <span>Adjustments ({stockAdjustments.length})</span>
              </button>
            )}

            {/* Firebase Cloud Sync Button */}
            <FirebaseSyncButton />

            {/* Install Android APK button in Top Header */}
            <PWAInstallButton variant="compact" />

            {/* User status avatar */}
            <div
              className="w-8 h-8 bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border border-slate-300 shadow-xs"
              title={`Salesman: ${settings.defaultSalesman}`}
            >
              {(settings.defaultSalesman || "A").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* 4. Mobile Bottom Navigation Bar (Clean 5-button bottom bar with adequate touch targets) */}
        <nav
          id="mobile-bottom-nav"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 flex items-center justify-around py-1.5 px-2 text-slate-500 shadow-xl safe-area-bottom"
        >
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const isMenuBtn = item.id === "more";
            const isActive = isMenuBtn ? mobileMenuOpen : activeNavTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => {
                  if (isMenuBtn) {
                    setMobileMenuOpen(!mobileMenuOpen);
                  } else {
                    handleNavClick(item.id);
                  }
                }}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer relative ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-blue-600 scale-110" : "text-slate-500"}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-blue-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-xs">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[64px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Standalone Android APK & Mobile App Modal */}
      <AndroidApkModal isOpen={apkModalOpen} onClose={() => setApkModalOpen(false)} />

      {/* Universal Document Search Modal (Purchase, Sale, Quotation, Return) */}
      <UniversalDocumentSearchModal
        isOpen={docSearchOpen}
        onClose={() => setDocSearchOpen(false)}
      />
    </div>
  );
};
