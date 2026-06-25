import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAdmin } from "@/lib/adminContext";
import { fetchAnalyticsData, fetchLiveDashboardStats, AnalyticsPayload } from "@/lib/analyticsEngine";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { 
  TrendingUp, 
  ShoppingBag, 
  Calendar, 
  BarChart3, 
  Download, 
  PieChart as PieChartIcon, 
  Activity,
  CheckCircle2,
  Coffee,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  Star,
  Award,
  CalendarDays,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Info,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend
} from "recharts";
import { format, subDays, startOfMonth, subMonths, startOfYear, endOfMonth, endOfDay, startOfDay } from "date-fns";

const analyticsSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/admin/analytics")({
  validateSearch: analyticsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: search }) => {
    try {
      const fromDate = search.from ? new Date(search.from) : undefined;
      const toDate = search.to ? new Date(search.to) : undefined;
      
      const stats = await fetchAnalyticsData(fromDate, toDate);
      return { stats, error: null };
    } catch (err: any) {
      return { stats: null, error: err.message || "Failed to load analytics" };
    }
  },
  component: AnalyticsDashboardPage,
});

const COLORS = ['#4A5D23', '#8FA971', '#D4AF37', '#B45309', '#0369A1', '#7C3AED'];

function AnalyticsDashboardPage() {
  const { stats: initialStats, error } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/analytics" });
  const { role } = useAdmin();

  // Mode state: 'single' for single date, 'range' for date range
  const [dateMode, setDateMode] = useState<'single' | 'range'>(
    search.from && search.to && search.from === search.to ? 'single' : 'range'
  );

  const [dateRange, setDateRange] = useState({
    from: search.from || format(new Date(), "yyyy-MM-dd"),
    to: search.to || format(new Date(), "yyyy-MM-dd")
  });

  const [liveStats, setLiveStats] = useState({
    revenue: initialStats?.todayRevenue || 0,
    count: initialStats?.todayOrders || 0,
    pending: initialStats?.pendingOrders || 0,
    preparing: initialStats?.preparingOrders || 0,
    ready: initialStats?.readyOrders || 0,
  });

  // Auto-refresh Live Stats every 30s
  useEffect(() => {
    let mounted = true;
    const updateLive = async () => {
      try {
        const data = await fetchLiveDashboardStats();
        if (mounted) setLiveStats(data);
      } catch (err) {
        console.error("Live stats sync error:", err);
      }
    };
    
    const interval = setInterval(updateLive, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Set date ranges when mode toggles
  const handleModeChange = (mode: 'single' | 'range') => {
    setDateMode(mode);
    if (mode === 'single') {
      // Set to current "from" date so they only query 1 day
      setDateRange(prev => ({ ...prev, to: prev.from }));
      navigate({ search: { from: dateRange.from, to: dateRange.from } });
    } else {
      // Default range: start of month to today
      const startOfMonthStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const todayStr = format(new Date(), "yyyy-MM-dd");
      setDateRange({ from: startOfMonthStr, to: todayStr });
      navigate({ search: { from: startOfMonthStr, to: todayStr } });
    }
  };

  const applyDateFilter = () => {
    if (dateMode === 'single') {
      navigate({ search: { from: dateRange.from, to: dateRange.from } });
    } else {
      if (!dateRange.from || !dateRange.to) {
        toast.error("Please specify both Start and End dates.");
        return;
      }
      if (new Date(dateRange.from) > new Date(dateRange.to)) {
        toast.error("Start date cannot be after End date.");
        return;
      }
      navigate({ search: { from: dateRange.from, to: dateRange.to } });
    }
  };

  const setPresetRange = (preset: string) => {
    const end = new Date();
    let start = new Date();

    switch (preset) {
      case 'today':
        start = end;
        setDateMode('single');
        break;
      case 'yesterday':
        start = subDays(end, 1);
        setDateMode('single');
        break;
      case '7days':
        start = subDays(end, 6);
        setDateMode('range');
        break;
      case '30days':
        start = subDays(end, 29);
        setDateMode('range');
        break;
      case 'thisMonth':
        start = startOfMonth(end);
        setDateMode('range');
        break;
      case 'lastMonth':
        const prevMonth = subMonths(end, 1);
        start = startOfMonth(prevMonth);
        const lastMonthEnd = endOfMonth(prevMonth);
        setDateMode('range');
        setDateRange({
          from: format(start, "yyyy-MM-dd"),
          to: format(lastMonthEnd, "yyyy-MM-dd")
        });
        navigate({ search: { from: format(start, "yyyy-MM-dd"), to: format(lastMonthEnd, "yyyy-MM-dd") } });
        return;
      case 'thisYear':
        start = startOfYear(end);
        setDateMode('range');
        break;
      default:
        return;
    }

    const fromStr = format(start, "yyyy-MM-dd");
    const toStr = preset === 'yesterday' ? fromStr : format(end, "yyyy-MM-dd");

    setDateRange({ from: fromStr, to: toStr });
    navigate({ search: { from: fromStr, to: toStr } });
  };

  const handleExport = async (formatType: "csv" | "excel" | "pdf") => {
    if (!initialStats || initialStats.ordersList.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const tid = toast.loading(`Preparing ${formatType.toUpperCase()} export...`);

    try {
      const orders = initialStats.ordersList;
      const fromDisplay = search.from || "Start";
      const toDisplay = search.to || "End";

      if (formatType === "pdf") {
        // Open PDF Printable window
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          toast.error("Popup blocked! Please allow popups for exports.", { id: tid });
          return;
        }

        const itemsSummary = initialStats.topSellingItems
          .map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.name}</td>
              <td style="text-align: right;">${item.qty} units</td>
              <td style="text-align: right;">₹${item.revenue.toLocaleString()}</td>
            </tr>
          `).join("");

        const ordersSummary = orders
          .map((o: any) => {
            const itemsStr = o.order_items?.map((i: any) => `${i.quantity}x ${i.item_name}`).join(", ") || "N/A";
            return `
              <tr>
                <td>${o.id.substring(0, 8)}...</td>
                <td>Table ${o.table_number}</td>
                <td>${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${itemsStr}</td>
                <td style="text-align: right;">₹${o.total_amount}</td>
                <td>${o.status}</td>
                <td>${o.payment_status}</td>
                <td style="font-family: monospace; font-size: 10px;">${o.token}</td>
              </tr>
            `;
          }).join("");

        printWindow.document.write(`
          <html>
            <head>
              <title>Smoobuds BI Report (${fromDisplay} to ${toDisplay})</title>
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #2D3748; line-height: 1.5; }
                h1 { color: #4A5D23; margin-bottom: 5px; font-size: 28px; }
                h2 { color: #2D3748; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-top: 30px; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
                .meta { font-size: 13px; color: #718096; margin-bottom: 30px; }
                .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                .kpi-card { background: #F7FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 15px; text-align: center; }
                .kpi-val { font-size: 20px; font-weight: bold; color: #4A5D23; margin-top: 5px; }
                .kpi-label { font-size: 10px; color: #718096; text-transform: uppercase; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
                th { background: #4A5D23; color: white; padding: 8px 10px; text-align: left; }
                td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
                tr:nth-child(even) { background: #F7FAFC; }
                .insights { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
                .insight-card { background: #F0F4E8; border-radius: 10px; padding: 15px; font-size: 12px; }
                .insight-card strong { color: #4A5D23; }
                @media print {
                  body { padding: 0; }
                  button { display: none; }
                }
              </style>
            </head>
            <body>
              <h1>Smoobuds Cafe</h1>
              <div class="meta">Business Intelligence Dashboard Report • Filter Range: <strong>${fromDisplay}</strong> to <strong>${toDisplay}</strong></div>
              
              <h2>Performance KPI Summary</h2>
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-label">Total Orders</div>
                  <div class="kpi-val">${initialStats.rangeTotalOrders}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">Total Revenue</div>
                  <div class="kpi-val">₹${initialStats.rangeTotalRevenue.toLocaleString()}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">Average Ticket</div>
                  <div class="kpi-val">₹${initialStats.averageOrderValue.toLocaleString()}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">Items Sold</div>
                  <div class="kpi-val">${initialStats.totalItemsSold}</div>
                </div>
              </div>

              <div class="kpi-grid" style="margin-top: -15px;">
                <div class="kpi-card">
                  <div class="kpi-label">Completed Orders</div>
                  <div class="kpi-val" style="color: #2F855A;">${initialStats.completedOrders}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">Pending Orders</div>
                  <div class="kpi-val" style="color: #D69E2E;">${initialStats.pendingOrdersInRange}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">Cancelled Orders</div>
                  <div class="kpi-val" style="color: #C53030;">${initialStats.cancelledOrders}</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-label">Highest ticket</div>
                  <div class="kpi-val">₹${initialStats.highestOrderAmount.toLocaleString()}</div>
                </div>
              </div>

              <h2>Business Insights</h2>
              <div class="insights">
                <div class="insight-card">
                  <p>• Peak Ordering Hour: <strong>${initialStats.peakOrderingHourStr || "N/A"}</strong></p>
                  <p>• Slowest Ordering Hour: <strong>${initialStats.slowestHourStr || "N/A"}</strong></p>
                </div>
                <div class="insight-card">
                  <p>• Most Ordered Item: <strong>${initialStats.bestSellingItem || "N/A"}</strong></p>
                  <p>• Highest Revenue Generator: <strong>${initialStats.highestRevenueItem || "N/A"}</strong></p>
                </div>
              </div>

              <h2>Top Handcrafted Items</h2>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Item Name</th>
                    <th style="text-align: right;">Quantity Sold</th>
                    <th style="text-align: right;">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsSummary || '<tr><td colspan="4" style="text-align:center;">No item data</td></tr>'}
                </tbody>
              </table>

              <h2 style="page-break-before: always;">Detailed Transactions List</h2>
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Table</th>
                    <th>Time</th>
                    <th>Items</th>
                    <th style="text-align: right;">Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Table Session Token</th>
                  </tr>
                </thead>
                <tbody>
                  ${ordersSummary || '<tr><td colspan="8" style="text-align:center;">No order records</td></tr>'}
                </tbody>
              </table>
              
              <script>
                window.onload = function() {
                  window.print();
                }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        toast.success("PDF report generated successfully", { id: tid });
        return;
      }

      // CSV & Excel generation
      const headers = [
        "Order ID",
        "Table Number",
        "Date",
        "Time",
        "Items",
        "Total Amount (INR)",
        "Order Status",
        "Payment Status",
        "Table Token"
      ];

      const rows = orders.map((o: any) => {
        const itemsStr = o.order_items?.map((i: any) => `${i.quantity}x ${i.item_name}`).join(" | ") || "N/A";
        const dateObj = new Date(o.created_at);
        return [
          o.id,
          o.table_number,
          dateObj.toLocaleDateString(),
          dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          itemsStr,
          o.total_amount,
          o.status,
          o.payment_status,
          o.token
        ];
      });

      const csvContent = [headers.join(","), ...rows.map(row => row.map(val => {
        const strVal = String(val);
        return strVal.includes(",") || strVal.includes('"') || strVal.includes("\n") ? `"${strVal.replace(/"/g, '""')}"` : strVal;
      }).join(","))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Smoobuds_BI_Dashboard_Export_${fromDisplay}_to_${toDisplay}.${formatType === 'excel' ? 'csv' : 'csv'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${formatType.toUpperCase()} export completed!`, { id: tid });
    } catch (err: any) {
      toast.error(err.message || "Export failed", { id: tid });
    }
  };

  if (error) {
    return (
      <div className="py-20 text-center">
        <div className="bg-destructive/10 text-destructive-foreground p-6 rounded-3xl inline-block max-w-lg">
          <XCircle size={40} className="mx-auto mb-4 opacity-50" />
          <h2 className="font-display font-bold text-xl mb-2">Analytics Error</h2>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!initialStats) {
    return (
      <div className="py-32 text-center flex flex-col items-center">
        <Activity size={48} className="text-sage/30 animate-pulse mb-4" />
        <h2 className="font-display font-bold text-2xl text-sage-deep mb-2">No Analytics Available</h2>
        <p className="text-sage/60 max-w-md">There are no orders in the system yet. Once orders are placed, your dashboard will populate automatically.</p>
      </div>
    );
  }

  const stats = initialStats as any;

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto overflow-x-hidden">
      
      {/* Header & Date Range Picker */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white/65 border border-sage/15 rounded-[2.5rem] p-6 sm:p-8 backdrop-blur-xl shadow-soft">
        <div>
          <span className="bg-sage/10 text-sage-deep text-[0.65rem] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full border border-sage/10">Business Intelligence</span>
          <h2 className="font-display font-black text-3xl text-sage-deep mt-3">Operations Dashboard</h2>
          <p className="text-xs text-sage/75 mt-1 font-medium">Real-time metrics, predictive peak hours, and order history.</p>
        </div>
        
        <div className="flex flex-col gap-4 w-full xl:w-auto">
          {/* Quick Date Presets */}
          <div className="flex bg-sage/5 p-1 rounded-2xl border border-sage/10 overflow-x-auto no-scrollbar scroll-smooth">
            <button onClick={() => setPresetRange('today')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">Today</button>
            <button onClick={() => setPresetRange('yesterday')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">Yesterday</button>
            <button onClick={() => setPresetRange('7days')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">7 Days</button>
            <button onClick={() => setPresetRange('30days')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">30 Days</button>
            <button onClick={() => setPresetRange('thisMonth')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">This Month</button>
            <button onClick={() => setPresetRange('lastMonth')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">Last Month</button>
            <button onClick={() => setPresetRange('thisYear')} className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-white transition-colors text-sage-deep whitespace-nowrap">This Year</button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Mode selection */}
            <div className="flex bg-sage/5 p-1 rounded-xl border border-sage/10">
              <button 
                onClick={() => handleModeChange('single')} 
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors ${dateMode === 'single' ? 'bg-white text-sage-deep shadow-sm' : 'text-sage/60'}`}
              >
                Single Date
              </button>
              <button 
                onClick={() => handleModeChange('range')} 
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors ${dateMode === 'range' ? 'bg-white text-sage-deep shadow-sm' : 'text-sage/60'}`}
              >
                Date Range
              </button>
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-sage/15 px-3 py-2.5 shadow-sm flex-1 sm:flex-none justify-between sm:justify-start w-full sm:w-auto">
              <CalendarDays size={16} className="text-sage/60" />
              <input 
                type="date" 
                value={dateRange.from} 
                onChange={e => setDateRange(prev => ({...prev, from: e.target.value}))}
                className="text-xs bg-transparent outline-none text-sage-deep font-semibold"
              />
              {dateMode === 'range' && (
                <>
                  <span className="text-sage/40">-</span>
                  <input 
                    type="date" 
                    value={dateRange.to} 
                    onChange={e => setDateRange(prev => ({...prev, to: e.target.value}))}
                    className="text-xs bg-transparent outline-none text-sage-deep font-semibold"
                  />
                </>
              )}
              <button 
                onClick={applyDateFilter} 
                className="bg-sage text-cream p-1.5 rounded-lg hover:bg-sage-deep ml-2 shadow-soft cursor-pointer"
                title="Apply Filter"
              >
                <CheckCircle2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Today Bar */}
      <div className="bg-gradient-to-r from-sage-deep to-sage text-cream rounded-[2rem] p-6 shadow-luxe flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
            <Activity className="text-gold animate-pulse" size={24} />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg uppercase tracking-widest text-gold-gradient">Live Crew Room</h3>
            <p className="text-[10px] text-cream/70 font-semibold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Auto-sync active (30s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-4 md:gap-8 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <p className="text-[10px] uppercase tracking-widest text-cream/60 font-bold mb-1">Today's Sales</p>
            <p className="font-display font-black text-2xl text-white">₹{liveStats.revenue.toLocaleString()}</p>
          </div>
          <div className="w-px h-10 bg-white/10 hidden md:block" />
          <div className="flex-1 md:flex-none">
            <p className="text-[10px] uppercase tracking-widest text-cream/60 font-bold mb-1">Live Tickets</p>
            <p className="font-display font-black text-2xl text-white">{liveStats.count}</p>
          </div>
          <div className="w-px h-10 bg-white/10 hidden md:block" />
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-1">Pending</p>
              <p className="font-display font-black text-xl text-white">{liveStats.pending}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-1">Kitchen</p>
              <p className="font-display font-black text-xl text-white">{liveStats.preparing + liveStats.ready}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Range BI Summary KPIs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Info size={16} className="text-sage" />
          <h3 className="font-display font-extrabold text-xs uppercase tracking-widest text-sage-deep">
            Metrics for selected range: {search.from ? `${search.from} to ${search.to || search.from}` : "This Month"}
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Total Orders */}
          <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-3">Total Orders</p>
            <div>
              <p className="font-display font-black text-3xl text-sage-deep">{stats.rangeTotalOrders}</p>
              <div className="flex gap-2 mt-2 text-[10px] text-sage/60 font-medium">
                <span className="text-emerald-600 font-bold">{stats.completedOrders} Served</span>
                <span>•</span>
                <span className="text-rose-600 font-bold">{stats.cancelledOrders} Cancelled</span>
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-3">Total Revenue</p>
            <div>
              <p className="font-display font-black text-3xl text-sage-deep">₹{stats.rangeTotalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-sage/50 mt-2 font-semibold">Excludes Cancelled Orders</p>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-3">Average Order Value</p>
            <div>
              <p className="font-display font-black text-3xl text-sage-deep">₹{stats.averageOrderValue.toLocaleString()}</p>
              <p className="text-[10px] text-sage/50 mt-2 font-semibold">Per ticket average (INR)</p>
            </div>
          </div>

          {/* Total Items Sold */}
          <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-3">Total Items Sold</p>
            <div>
              <p className="font-display font-black text-3xl text-sage-deep">{stats.totalItemsSold} items</p>
              <p className="text-[10px] text-sage/50 mt-2 font-semibold">From successful orders</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Completed Orders */}
          <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Completed Orders</p>
            <p className="font-display font-black text-2xl text-emerald-600">{stats.completedOrders}</p>
            <p className="text-[9px] text-sage/50 mt-1 font-semibold">Delivered & Closed</p>
          </div>

          {/* Pending Orders */}
          <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Pending Orders</p>
            <p className="font-display font-black text-2xl text-amber-600">{stats.pendingOrdersInRange}</p>
            <p className="text-[9px] text-sage/50 mt-1 font-semibold">Active in queue</p>
          </div>

          {/* Highest Order Amount */}
          <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Highest Order Amount</p>
            <p className="font-display font-black text-2xl text-sage-deep">₹{stats.highestOrderAmount.toLocaleString()}</p>
            <p className="text-[9px] text-sage/50 mt-1 font-semibold">Single ticket record</p>
          </div>

          {/* Lowest Order Amount */}
          <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Lowest Order Amount</p>
            <p className="font-display font-black text-2xl text-sage-deep">₹{(stats.lowestOrderAmount || 0).toLocaleString()}</p>
            <p className="text-[9px] text-sage/50 mt-1 font-semibold">Minimum successful amount</p>
          </div>
        </div>
      </div>

      {/* Target Tracker & Insights Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly Target Progress */}
        <div className="lg:col-span-1 bg-white border border-sage/15 rounded-3xl p-6 shadow-soft relative overflow-hidden flex flex-col justify-center">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep flex items-center gap-2">
              <Target size={16} className="text-gold" /> Monthly Target
            </h3>
          </div>
          
          <div className="relative pt-2">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-[10px] text-sage/60 font-bold uppercase tracking-widest">Achieved</p>
                <p className="font-display font-black text-3xl text-sage-deep">₹{stats.thisMonthRevenue.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-sage/60 font-bold uppercase tracking-widest">Goal</p>
                <p className="font-display font-bold text-lg text-sage/80">₹{stats.monthlyTarget.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="w-full bg-sage/10 rounded-full h-4 mt-4 overflow-hidden relative">
              <div 
                className="bg-gold-gradient h-4 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min((stats.thisMonthRevenue / stats.monthlyTarget) * 100, 100)}%` }}
              />
            </div>
            <p className="text-right text-[10px] font-bold text-sage-deep mt-2">
              {((stats.thisMonthRevenue / stats.monthlyTarget) * 100).toFixed(1)}% Completed
            </p>
          </div>
        </div>

        {/* Business Insights */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <Star size={16} className="text-amber-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Most Ordered Item</p>
            <p className="font-display font-bold text-xs text-sage-deep mt-1 truncate" title={stats.bestSellingItem || "N/A"}>
              {stats.bestSellingItem || "N/A"}
            </p>
          </div>
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <Award size={16} className="text-blue-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Highest Revenue Item</p>
            <p className="font-display font-bold text-xs text-sage-deep mt-1 truncate" title={stats.highestRevenueItem || "N/A"}>
              {stats.highestRevenueItem || "N/A"}
            </p>
          </div>
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <Clock size={16} className="text-purple-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Peak Order Hour</p>
            <p className="font-display font-bold text-xs text-sage-deep mt-1 truncate">
              {stats.peakOrderingHourStr || "N/A"}
            </p>
          </div>
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <XCircle size={16} className="text-rose-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Slowest Hour</p>
            <p className="font-display font-bold text-xs text-sage-deep mt-1 truncate">
              {stats.slowestHourStr || "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts Row 1: Revenue Trend & Hourly Sales */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Dynamic Revenue Trend Chart */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <div className="mb-4">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep">Revenue Trend</h3>
            <p className="text-[10px] text-sage/60 font-medium">Aggregated over the selected time range.</p>
          </div>
          <div className="flex-1 min-h-0">
            {stats.trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevRange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A5D23" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4A5D23" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip cursor={{ stroke: '#4A5D23', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#4A5D23" strokeWidth={3} fillOpacity={1} fill="url(#colorRevRange)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-sage/40">No trend data available for this range.</div>
            )}
          </div>
        </div>

        {/* Hourly Sales Chart */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <div className="mb-4">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep">Hourly Sales (Revenue)</h3>
            <p className="text-[10px] text-sage/60 font-medium">Distribution of incoming revenue by hour of the day.</p>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.peakHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} dy={10} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip cursor={{ fill: 'rgba(74, 93, 35, 0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} maxBarSize={30} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Charts Row 2: Orders Per Hour & Best Selling Categories */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Orders Per Hour Chart */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <div className="mb-4">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep">Orders Per Hour</h3>
            <p className="text-[10px] text-sage/60 font-medium">Frequency of orders submitted across standard operating hours.</p>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.peakHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} dy={10} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="orders" stroke="#0369A1" strokeWidth={3} dot={{ r: 3, fill: '#0369A1', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Share & Table */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-4 flex items-center gap-2">
            <PieChartIcon size={16} /> Best Selling Categories
          </h3>
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-6 min-h-0">
            <div className="w-full sm:w-1/2 h-[200px]">
              {stats.categoryRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.categoryRevenue} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="count" nameKey="category">
                      {stats.categoryRevenue.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center"><p className="text-xs text-sage/40">No data</p></div>
              )}
            </div>
            <div className="w-full sm:w-1/2 overflow-y-auto max-h-[220px] no-scrollbar">
              <ul className="space-y-3">
                {stats.categoryRevenue.map((cat, idx) => (
                  <li key={cat.category} className="flex justify-between items-center text-xs py-2 border-b border-sage/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="font-semibold text-sage-deep">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sage-deep">₹{cat.revenue.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-sage/60 uppercase">{cat.share}% Share ({cat.count} items)</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Items & Table */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top 10 Items Chart */}
        <div className="lg:col-span-1 bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[420px] flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-6">Best Selling Items (Top 5)</h3>
          <div className="flex-1 min-h-0">
            {stats.topSellingItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topSellingItems.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="qty" fill="#4A5D23" radius={[0, 4, 4, 0]} maxBarSize={20} name="Quantity Sold" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-sage/40">No sales data available.</div>
            )}
          </div>
        </div>

        {/* Top 10 Selling Items Table */}
        <div className="lg:col-span-2 bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[420px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep flex items-center gap-2">
                <Star size={16} className="text-gold" /> Best Selling Catalog items
              </h3>
              <p className="text-[10px] text-sage/60 mt-0.5 font-medium">Ranked by unit sales in selected timeframe.</p>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 no-scrollbar border border-sage/10 rounded-2xl">
            <table className="w-full text-left text-xs text-sage-deep">
              <thead className="bg-sage/5 border-b border-sage/10 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60 rounded-tl-xl">Rank</th>
                  <th className="px-4 py-3 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Item Name</th>
                  <th className="px-4 py-3 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60 text-right">Quantity Sold</th>
                  <th className="px-4 py-3 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60 text-right rounded-tr-xl">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage/5">
                {stats.topSellingItems.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-sage/5 transition-colors group">
                    <td className="px-4 py-2.5 text-center w-12">
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold font-display ${idx < 3 ? 'bg-gold/20 text-gold-dark' : 'bg-sage/10 text-sage'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold group-hover:text-sage">{item.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{item.qty} units</td>
                    <td className="px-4 py-2.5 text-right font-bold text-sage">₹{item.revenue.toLocaleString()}</td>
                  </tr>
                ))}
                {stats.topSellingItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-sage/50">No item performance data available for this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Every Order Placed Table Section */}
      <div className="bg-white border border-sage/15 rounded-3xl p-6 sm:p-8 shadow-soft flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="font-display font-extrabold text-base uppercase tracking-widest text-sage-deep flex items-center gap-2">
              <ShoppingBag size={18} className="text-sage" /> Transaction Log
            </h3>
            <p className="text-[10px] text-sage/60 mt-0.5 font-medium">Detailed audit trail of all orders in selected filter.</p>
          </div>
          
          {/* Exports options */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button onClick={() => handleExport("pdf")} className="flex-1 sm:flex-none justify-center bg-sage/5 hover:bg-sage/15 text-sage-deep text-[10px] tracking-widest uppercase font-display font-bold px-4 py-2 rounded-xl border border-sage/10 flex items-center gap-2 transition-colors cursor-pointer">
              <Printer size={13} /> PDF Report
            </button>
            <button onClick={() => handleExport("csv")} className="flex-1 sm:flex-none justify-center bg-sage/5 hover:bg-sage/15 text-sage-deep text-[10px] tracking-widest uppercase font-display font-bold px-4 py-2 rounded-xl border border-sage/10 flex items-center gap-2 transition-colors cursor-pointer">
              <FileSpreadsheet size={13} /> CSV
            </button>
            <button onClick={() => handleExport("excel")} className="flex-1 sm:flex-none justify-center bg-sage/5 hover:bg-sage/15 text-sage-deep text-[10px] tracking-widest uppercase font-display font-bold px-4 py-2 rounded-xl border border-sage/10 flex items-center gap-2 transition-colors cursor-pointer">
              <Download size={13} /> Excel
            </button>
          </div>
        </div>

        {/* Orders List Table */}
        <div className="overflow-x-auto w-full border border-sage/10 rounded-2xl shadow-inner bg-cream/10">
          <table className="w-full text-left text-xs text-sage-deep whitespace-nowrap">
            <thead className="bg-sage/5 border-b border-sage/10 sticky top-0">
              <tr>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Order ID</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Table</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Time Placed</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Ordered Items</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60 text-right">Total Amount</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Order Status</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60">Payment Status</th>
                <th className="px-5 py-4 font-display font-bold text-[9px] uppercase tracking-widest text-sage/60 rounded-tr-xl">Session Token</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage/5">
              {stats.ordersList.map((ord: any) => (
                <tr key={ord.id} className="hover:bg-sage/5 transition-colors">
                  <td className="px-5 py-3.5 font-bold font-mono text-[10px] text-sage">{ord.id.substring(0, 8)}...</td>
                  <td className="px-5 py-3.5 font-bold">Table {ord.table_number}</td>
                  <td className="px-5 py-3.5 font-medium text-sage-deep/80">
                    {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <span className="block text-[8px] text-sage/50 mt-0.5">{new Date(ord.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-xs truncate font-medium text-sage-deep/90" title={ord.order_items?.map((i: any) => `${i.quantity}x ${i.item_name}`).join(", ")}>
                    {ord.order_items?.map((i: any) => `${i.quantity}x ${i.item_name}`).join(", ") || "N/A"}
                  </td>
                  <td className="px-5 py-3.5 text-right font-black text-sage">₹{ord.total_amount.toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      ord.status === "Pending" ? "bg-amber-100 text-amber-800" :
                      ord.status === "Accepted" ? "bg-emerald-100 text-emerald-800" :
                      ord.status === "Preparing" ? "bg-blue-100 text-blue-800" :
                      ord.status === "Ready" ? "bg-teal-100 text-teal-800" :
                      ord.status === "Served" ? "bg-sage text-cream" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      ord.payment_status === "Paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                      ord.payment_status === "Cancelled" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                      "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {ord.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[10px] text-sage/70 select-all" title={ord.token}>
                    {ord.token}
                  </td>
                </tr>
              ))}

              {stats.ordersList.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-sage/40">
                      <AlertCircle size={28} className="mb-2" />
                      <p className="font-semibold text-sm text-sage-deep">No orders found for the selected date.</p>
                      <p className="text-[10px] text-sage/50 mt-1">Please try modifying your date filters or presets.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
