import React, { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { Customer } from "../types";
import { formatPakistaniRupees } from "../utils/numberToWords";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import {
  Users,
  UserPlus,
  Search,
  Building2,
  MapPin,
  Phone,
  FileBadge,
  DollarSign,
  Edit2,
  Trash2,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  X,
  CreditCard,
  Hash,
  ExternalLink,
  HandCoins,
} from "lucide-react";

export const CustomersView: React.FC = () => {
  const {
    customers,
    saveCustomer,
    deleteCustomer,
    getCustomerPendingDues,
    startNewOrderWithCustomer,
    resetCustomersToDefault,
    orders,
    setPreselectedRecoveryCustomer,
    setActiveNavTab,
  } = useApp();

  const handleCollectRecovery = (customerName: string) => {
    setPreselectedRecoveryCustomer(customerName);
    setActiveNavTab("daily-recovery");
  };

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "with_dues" | "settled">("all");
  const [sortBy, setSortBy] = useState<"name" | "dues_desc" | "orders_desc" | "recent">("name");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Confirm delete modal state
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmButtonText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    city: "Sahiwal",
    address: "",
    phone: "",
    licenseNo: "",
    ntn: "",
    openingBalance: 0,
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Collect distinct cities from customers list
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city && c.city.trim()) set.add(c.city.trim());
    });
    return Array.from(set).sort();
  }, [customers]);

  // Quick statistics
  const stats = useMemo(() => {
    let totalDues = 0;
    let customersWithDues = 0;
    const ordersCountByCustomer: Record<string, { count: number; totalAmount: number }> = {};

    orders.forEach((o) => {
      if (!o.customerName) return;
      const key = o.customerName.trim().toLowerCase();
      if (!ordersCountByCustomer[key]) {
        ordersCountByCustomer[key] = { count: 0, totalAmount: 0 };
      }
      ordersCountByCustomer[key].count += 1;
      ordersCountByCustomer[key].totalAmount += Number(o.grandTotal) || 0;
    });

    customers.forEach((c) => {
      const dues = getCustomerPendingDues(c.name);
      if (dues > 0) {
        totalDues += dues;
        customersWithDues += 1;
      }
    });

    return {
      totalCustomers: customers.length,
      customersWithDues,
      totalDues,
      ordersCountByCustomer,
    };
  }, [customers, orders, getCustomerPendingDues]);

  // Filtered and Sorted Customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matches =
            (c.name || "").toLowerCase().includes(q) ||
            (c.code || "").toLowerCase().includes(q) ||
            (c.phone || "").toLowerCase().includes(q) ||
            (c.address || "").toLowerCase().includes(q) ||
            (c.city || "").toLowerCase().includes(q) ||
            (c.licenseNo || "").toLowerCase().includes(q) ||
            (c.ntn || "").toLowerCase().includes(q);
          if (!matches) return false;
        }

        // City filter
        if (selectedCity !== "all" && (c.city || "").trim().toLowerCase() !== selectedCity.toLowerCase()) {
          return false;
        }

        // Dues filter
        const dues = getCustomerPendingDues(c.name);
        if (statusFilter === "with_dues" && dues <= 0) return false;
        if (statusFilter === "settled" && dues > 0) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return (a.name || "").localeCompare(b.name || "");
        }
        if (sortBy === "dues_desc") {
          const duesA = getCustomerPendingDues(a.name);
          const duesB = getCustomerPendingDues(b.name);
          return duesB - duesA;
        }
        if (sortBy === "orders_desc") {
          const countA = stats.ordersCountByCustomer[(a.name || "").trim().toLowerCase()]?.count || 0;
          const countB = stats.ordersCountByCustomer[(b.name || "").trim().toLowerCase()]?.count || 0;
          return countB - countA;
        }
        if (sortBy === "recent") {
          return (b.createdAt || "").localeCompare(a.createdAt || "");
        }
        return 0;
      });
  }, [customers, searchQuery, selectedCity, statusFilter, sortBy, getCustomerPendingDues, stats.ordersCountByCustomer]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const openAddModal = (initialName: string = "") => {
    setEditingCustomer(null);
    const nextCodeNum = customers.length + 1;
    setFormData({
      name: initialName,
      code: `CUST-${String(nextCodeNum).padStart(3, "0")}`,
      city: "Sahiwal",
      address: "",
      phone: "",
      licenseNo: "",
      ntn: "",
      openingBalance: 0,
      notes: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name || "",
      code: c.code || "",
      city: c.city || "Sahiwal",
      address: c.address || "",
      phone: c.phone || "",
      licenseNo: c.licenseNo || "",
      ntn: c.ntn || "",
      openingBalance: c.openingBalance || 0,
      notes: c.notes || "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = (createOrderDirectly: boolean = false) => {
    if (!formData.name.trim()) {
      setFormError("Customer / Pharmacy Name is required.");
      return;
    }

    const newCustomer: Customer = {
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
      name: formData.name.trim(),
      code: formData.code.trim() || `CUST-${String(customers.length + 1).padStart(3, "0")}`,
      city: formData.city.trim() || "Sahiwal",
      address: formData.address.trim(),
      phone: formData.phone.trim(),
      licenseNo: formData.licenseNo.trim(),
      ntn: formData.ntn.trim(),
      openingBalance: Number(formData.openingBalance) || 0,
      notes: formData.notes.trim(),
      createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveCustomer(newCustomer);
    setIsModalOpen(false);

    if (createOrderDirectly) {
      startNewOrderWithCustomer(newCustomer);
    } else {
      showNotification(
        editingCustomer
          ? `✓ Updated details for "${newCustomer.name}".`
          : `✓ Customer "${newCustomer.name}" added successfully. All details will now auto-fill into orders!`
      );
    }
  };

  const handleDelete = (c: Customer) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: "Delete Customer Profile",
      message: `Are you sure you want to delete customer profile "${c.name}"? This action cannot be reversed.`,
      itemDescription: `Pharmacy: ${c.name} | City: ${c.city || "N/A"} | Phone: ${c.phone || "N/A"}`,
      confirmButtonText: "Yes, Delete Customer",
      onConfirm: () => {
        deleteCustomer(c.id);
        showNotification(`Customer "${c.name}" removed from directory.`);
        setConfirmDeleteModal(null);
      },
    });
  };

  return (
    <div id="customers-view" className="max-w-7xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Top Banner & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Users className="w-5 h-5" />
            <span className="text-xs uppercase font-bold tracking-wider">Customer & Pharmacy Directory</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Customer Profiles & Auto-Fill Details
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Register client pharmacies, clinics, hospitals, and surgical stores. Any information added here will instantly auto-fill its address, contact, drug license, NTN, and previous dues whenever creating a sales order.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="btn-add-new-customer"
            type="button"
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfirmDeleteModal({
                isOpen: true,
                title: "Reset Customers to Default",
                message: "Are you sure you want to reload the default sample customers list? Any existing customers will remain backed up.",
                confirmButtonText: "Yes, Reset Customers",
                onConfirm: () => {
                  resetCustomersToDefault();
                  showNotification("Restored default client profiles.");
                  setConfirmDeleteModal(null);
                },
              });
            }}
            className="px-3 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Reset to default sample pharmacies"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-3 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Customers</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <span>{stats.totalCustomers}</span>
            <span className="text-xs font-normal text-slate-400">Pharmacies / Clients</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Available for instant auto-fill</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Buyers</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {Object.keys(stats.ordersCountByCustomer).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">With sales order records</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">With Pending Dues</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {stats.customersWithDues}
          </div>
          <div className="text-[11px] text-amber-700 mt-1">Clients with unpaid balances</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Market Outstanding</div>
          <div className="text-xl sm:text-2xl font-bold text-red-600 mt-1 font-mono">
            Rs. {stats.totalDues.toLocaleString("en-PK")}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Auto-syncs into invoice net total</div>
        </div>
      </div>

      {/* Filters, Search & View Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            id="input-customer-search"
            type="text"
            placeholder="Search by customer name, code, phone, address, license #, NTN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns & View Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* City Filter */}
          <select
            id="select-filter-city"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Cities</option>
            {uniqueCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          {/* Dues Status Filter */}
          <select
            id="select-filter-dues"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Balances</option>
            <option value="with_dues">Pending Dues Only</option>
            <option value="settled">Fully Settled (Rs. 0)</option>
          </select>

          {/* Sort By */}
          <select
            id="select-sort-customers"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="name">Sort: Name (A-Z)</option>
            <option value="dues_desc">Sort: Highest Pending Dues</option>
            <option value="orders_desc">Sort: Most Orders</option>
            <option value="recent">Sort: Recently Added</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "cards" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Customer Count Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-800">{filteredCustomers.length}</strong> of{" "}
          <strong className="text-slate-800">{customers.length}</strong> registered customer profiles
        </span>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-blue-600 hover:underline cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Zero State */}
      {filteredCustomers.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Customers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No pharmacy records matching "${searchQuery}". You can add them now to enable instant auto-fill.`
              : "No customer records have been created yet."}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => openAddModal(searchQuery)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add "{searchQuery || "New Customer"}" Now</span>
            </button>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === "cards" && filteredCustomers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const pendingDues = getCustomerPendingDues(customer.name);
            const customerOrderHistory = stats.ordersCountByCustomer[(customer.name || "").trim().toLowerCase()];
            const orderCount = customerOrderHistory?.count || 0;
            const totalInvoiced = customerOrderHistory?.totalAmount || 0;

            return (
              <div
                key={customer.id}
                id={`customer-card-${customer.id}`}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name & Code */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 truncate" title={customer.name}>
                          {customer.name}
                        </span>
                      </div>
                      {customer.code && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-mono font-bold rounded">
                          {customer.code}
                        </span>
                      )}
                    </div>

                    {/* Pending Dues Badge */}
                    {pendingDues > 0 ? (
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase font-bold text-amber-700">Pending Dues</div>
                        <div className="text-xs font-bold text-red-600 font-mono">
                          Rs. {pendingDues.toLocaleString("en-PK")}
                        </div>
                      </div>
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold text-[10px] rounded-full">
                        Settled (Rs. 0)
                      </span>
                    )}
                  </div>

                  {/* Customer Credentials details */}
                  <div className="py-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-slate-700">
                        {customer.address ? customer.address : "No street address specified"}
                        {customer.city ? `, ${customer.city}` : ""}
                      </span>
                    </div>

                    {customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-800">{customer.phone}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-1">
                      {customer.licenseNo && (
                        <div className="flex items-center gap-1">
                          <FileBadge className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">Lic: {customer.licenseNo}</span>
                        </div>
                      )}
                      {customer.ntn && (
                        <div className="flex items-center gap-1">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">NTN: {customer.ntn}</span>
                        </div>
                      )}
                    </div>

                    {customer.notes && (
                      <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 italic">
                        "{customer.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Order Stats & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500">
                    <strong className="text-slate-800">{orderCount}</strong> {orderCount === 1 ? "order" : "orders"}
                    {totalInvoiced > 0 && (
                      <span className="block text-[10px] text-slate-400">
                        Vol: Rs. {totalInvoiced.toLocaleString("en-PK")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(customer)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Customer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(customer)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {pendingDues > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCollectRecovery(customer.name)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Record recovery & issue receiving receipt"
                      >
                        <HandCoins className="w-3.5 h-3.5" />
                        <span>Recovery</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => startNewOrderWithCustomer(customer)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Create new sale order with this customer auto-filled"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>New Order</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && filteredCustomers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="py-3 px-4">Customer / Pharmacy</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">City & Address</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">License / NTN</th>
                  <th className="py-3 px-4 text-right">Pending Dues</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const pendingDues = getCustomerPendingDues(customer.name);
                  const orderHistory = stats.ordersCountByCustomer[(customer.name || "").trim().toLowerCase()];
                  const orderCount = orderHistory?.count || 0;

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {customer.name}
                        {customer.notes && (
                          <div className="text-[10px] font-normal text-slate-400 truncate max-w-xs">
                            {customer.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {customer.code ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-mono font-bold text-[10px] rounded">
                            {customer.code}
                          </span>
                        ) : (
                          <span className="text-slate-400">---</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {customer.address ? `${customer.address}, ` : ""}
                        <strong className="text-slate-700">{customer.city || "Sahiwal"}</strong>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {customer.phone || <span className="text-slate-400">---</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {customer.licenseNo || customer.ntn ? (
                          <div>
                            {customer.licenseNo && <div>Lic: {customer.licenseNo}</div>}
                            {customer.ntn && <div>NTN: {customer.ntn}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400">---</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {pendingDues > 0 ? (
                          <span className="text-red-600">Rs. {pendingDues.toLocaleString("en-PK")}</span>
                        ) : (
                          <span className="text-emerald-600">Rs. 0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-medium">
                        {orderCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {pendingDues > 0 && (
                            <button
                              type="button"
                              onClick={() => handleCollectRecovery(customer.name)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-medium rounded transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                              title="Record recovery & issue receiving receipt"
                            >
                              <HandCoins className="w-3 h-3" />
                              <span>Recover</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startNewOrderWithCustomer(customer)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-medium rounded transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Create sale order"
                          >
                            <PlusCircle className="w-3 h-3" />
                            <span>Order</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(customer)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(customer)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingCustomer ? "Edit Customer Profile" : "Add New Customer Profile"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Details saved here will automatically auto-fill into sales orders and invoices.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error message */}
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              {/* Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Customer / Pharmacy Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Al-Rehman Pharmacy & Surgical"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] uppercase font-bold text-slate-600">
                      Customer Code
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          code: `CUST-${String(customers.length + 1).padStart(3, "0")}`,
                        })
                      }
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. CUST-042"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* City & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Sahiwal"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                  {/* Quick City Suggestions */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["Sahiwal", "Chichawatni", "Okara", "Lahore"].map((quickCity) => (
                      <button
                        key={quickCity}
                        type="button"
                        onClick={() => setFormData({ ...formData, city: quickCity })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          formData.city === quickCity
                            ? "bg-blue-50 border-blue-300 text-blue-700 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {quickCity}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Street Address / Market Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main High Street, Grain Market"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Phone & License / NTN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Phone / Mobile #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0300-9876543"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Drug License #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 02-119-0982-S"
                    value={formData.licenseNo}
                    onChange={(e) => setFormData({ ...formData, licenseNo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">NTN Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 4198234-7"
                    value={formData.ntn}
                    onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Opening Ledger Balance & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-amber-800 mb-1">
                    Opening Dues / Balance (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={formData.openingBalance || ""}
                    onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-amber-700 mt-1 block">
                    Starting ledger balance before invoices
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] uppercase font-bold text-slate-600 mb-1">
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Counter pharmacy, 15 days credit term"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                {editingCustomer ? "Save Changes" : "Save Customer Profile"}
              </button>

              {!editingCustomer && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Save customer and immediately open new order with credentials filled"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save & Start Order</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};
