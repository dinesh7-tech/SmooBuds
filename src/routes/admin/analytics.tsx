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
  ChefHat,
  BellRing,
  Coffee,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Clock,
  Star,
  Award,
  CalendarDays,
  FileSpreadsheet
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
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line
} from "recharts";

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

  const [dateRange, setDateRange] = useState({
    from: search.from || "",
    to: search.to || ""
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

  const applyDateFilter = () => {
    if (!dateRange.from && !dateRange.to) {
      navigate({ search: {} });
    } else {
      navigate({ search: { from: dateRange.from, to: dateRange.to } });
    }
  };

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    const fromStr = start.toISOString().split('T')[0];
    const toStr = end.toISOString().split('T')[0];
    
    setDateRange({ from: fromStr, to: toStr });
    navigate({ search: { from: fromStr, to: toStr } });
  };

  const handleExport = async (format: "csv" | "excel") => {
    const tid = toast.loading(`Preparing ${format.toUpperCase()} export...`);
    try {
      // For export, we fetch the raw rows for the selected range directly to save memory.
      let query = supabase.from("orders").select("id, table_number, total_amount, status, created_at, order_items(item_name, quantity)");
      
      if (search.from) query = query.gte("created_at", new Date(search.from).toISOString());
      if (search.to) {
        const endDay = new Date(search.to);
        endDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endDay.toISOString());
      }

      const { data } = await query;
      
      if (!data || data.length === 0) {
        toast.error("No data to export for this range", { id: tid });
        return;
      }

      const headers = ["Order ID", "Date", "Table", "Amount", "Status", "Items"];
      const rows = data.map(o => {
        const itemsStr = o.order_items?.map((i: any) => `${i.quantity}x ${i.item_name}`).join(" | ") || "";
        return [
          o.id,
          new Date(o.created_at).toLocaleString(),
          o.table_number,
          o.total_amount,
          o.status,
          itemsStr
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
      // Using .csv for both, as Excel natively opens CSVs perfectly and JS xlsx libraries are heavy
      link.download = `Smoobuds_Export_${format}_${new Date().toISOString().split('T')[0]}.csv`; 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Export successful", { id: tid });
    } catch (e: any) {
      toast.error(e.message || "Export failed", { id: tid });
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

  const stats = initialStats as AnalyticsPayload;

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto overflow-x-hidden">
      
      {/* Header & Date Range Picker */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white/60 border border-sage/15 rounded-3xl p-6 backdrop-blur-md shadow-sm">
        <div>
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-sage-deep">Business Dashboard</h2>
          <p className="text-xs md:text-sm text-sage/75 mt-1 font-medium">Real-time metrics and historical insights.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
          {/* Quick Filters */}
          <div className="flex bg-sage/5 p-1 rounded-xl border border-sage/10 overflow-x-auto no-scrollbar">
            <button onClick={() => setPresetRange(0)} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-white transition-colors text-sage-deep whitespace-nowrap">Today</button>
            <button onClick={() => setPresetRange(7)} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-white transition-colors text-sage-deep whitespace-nowrap">7 Days</button>
            <button onClick={() => setPresetRange(30)} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-white transition-colors text-sage-deep whitespace-nowrap">30 Days</button>
          </div>
          
          {/* Custom Date Range */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-sage/15 px-3 py-2 shadow-sm">
            <CalendarDays size={16} className="text-sage/60" />
            <input 
              type="date" 
              value={dateRange.from} 
              onChange={e => setDateRange(prev => ({...prev, from: e.target.value}))}
              className="text-xs bg-transparent outline-none text-sage-deep font-medium"
            />
            <span className="text-sage/40">-</span>
            <input 
              type="date" 
              value={dateRange.to} 
              onChange={e => setDateRange(prev => ({...prev, to: e.target.value}))}
              className="text-xs bg-transparent outline-none text-sage-deep font-medium"
            />
            <button onClick={applyDateFilter} className="bg-sage text-cream p-1.5 rounded-lg hover:bg-sage-deep ml-1">
              <CheckCircle2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Live Today Bar */}
      <div className="bg-gradient-to-r from-sage-deep to-sage text-cream rounded-3xl p-6 shadow-luxe flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
            <Activity className="text-gold animate-pulse" size={24} />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg uppercase tracking-widest text-gold-gradient">Live Today</h3>
            <p className="text-[10px] text-cream/70 font-semibold uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Auto-sync active
            </p>
          </div>
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-4 md:gap-8 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <p className="text-[10px] uppercase tracking-widest text-cream/60 font-bold mb-1">Today's Revenue</p>
            <p className="font-display font-black text-2xl text-white">₹{liveStats.revenue.toLocaleString()}</p>
          </div>
          <div className="w-px h-10 bg-white/10 hidden md:block" />
          <div className="flex-1 md:flex-none">
            <p className="text-[10px] uppercase tracking-widest text-cream/60 font-bold mb-1">Orders</p>
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

      {/* KPI Comparisons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-sage/10 text-sage rounded-xl"><TrendingUp size={20} /></div>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${stats.todayVsYesterdayPercent >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {stats.todayVsYesterdayPercent >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
              {Math.abs(stats.todayVsYesterdayPercent).toFixed(1)}%
            </span>
          </div>
          <div>
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold">Today vs Yesterday</p>
            <p className="font-display font-black text-2xl text-sage-deep mt-1">₹{stats.todayRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-sage/50 mt-1 font-semibold">Prev: ₹{stats.yesterdayRevenue.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl"><Calendar size={20} /></div>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${stats.monthVsMonthPercent >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {stats.monthVsMonthPercent >= 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
              {Math.abs(stats.monthVsMonthPercent).toFixed(1)}%
            </span>
          </div>
          <div>
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold">This Month vs Last</p>
            <p className="font-display font-black text-2xl text-sage-deep mt-1">₹{stats.thisMonthRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-sage/50 mt-1 font-semibold">Prev: ₹{stats.lastMonthRevenue.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl"><ShoppingBag size={20} /></div>
          </div>
          <div>
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold">Selected Period Orders</p>
            <p className="font-display font-black text-2xl text-sage-deep mt-1">{stats.rangeTotalOrders}</p>
            <p className="text-[10px] text-sage/50 mt-1 font-semibold">Total count</p>
          </div>
        </div>

        <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl"><BarChart3 size={20} /></div>
          </div>
          <div>
            <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold">Average Order Value</p>
            <p className="font-display font-black text-2xl text-sage-deep mt-1">₹{stats.averageOrderValue.toLocaleString()}</p>
            <p className="text-[10px] text-sage/50 mt-1 font-semibold">Per ticket average</p>
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
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Best Selling Item</p>
            <p className="font-display font-bold text-sm text-sage-deep mt-1 truncate">{stats.bestSellingItem || "N/A"}</p>
          </div>
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <Award size={16} className="text-blue-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Top Category</p>
            <p className="font-display font-bold text-sm text-sage-deep mt-1 truncate">{stats.bestSellingCategory || "N/A"}</p>
          </div>
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <TrendingUp size={16} className="text-emerald-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Highest Revenue Day</p>
            <p className="font-display font-bold text-sm text-sage-deep mt-1 truncate">{stats.highestRevenueDay?.date || "N/A"}</p>
          </div>
          <div className="bg-sage/5 border border-sage/10 rounded-2xl p-4 flex flex-col justify-center">
            <Clock size={16} className="text-purple-500 mb-2" />
            <p className="text-[9px] uppercase tracking-widest text-sage/60 font-bold">Peak Order Hour</p>
            <p className="font-display font-bold text-sm text-sage-deep mt-1 truncate">{stats.peakOrderingHourStr || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* Main Charts Row 1: 7 Days & Peak Hours */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 7 Days Revenue Area Chart */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-6">Revenue (Last 7 Days)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenueLast7Days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A5D23" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4A5D23" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip cursor={{ stroke: '#4A5D23', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#4A5D23" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak Hours Chart */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-6">Peak Ordering Hours</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.peakHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(74, 93, 35, 0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="orders" fill="#D4AF37" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Charts Row 2: Weekday & Monthly */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekday Performance */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-6">Weekday Performance</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekdayPerformance} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip cursor={{ fill: 'rgba(74, 93, 35, 0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="revenue" fill="#8FA971" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-6">Monthly Revenue (Trailing 12M)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#0369A1" strokeWidth={3} dot={{ r: 4, fill: '#0369A1', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Row: Category & Top Items */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Category Share & Table */}
        <div className="lg:col-span-1 bg-white border border-sage/15 rounded-3xl p-6 shadow-soft flex flex-col">
          <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep mb-4 flex items-center gap-2">
            <PieChartIcon size={16} /> Category Performance
          </h3>
          <div className="h-[200px] mb-4">
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
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <ul className="space-y-3">
              {stats.categoryRevenue.map((cat, idx) => (
                <li key={cat.category} className="flex justify-between items-center text-xs py-2 border-b border-sage/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="font-semibold text-sage-deep">{cat.category}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sage-deep">₹{cat.revenue.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-sage/60 uppercase">{cat.share}% Share</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Top 10 Selling Items Table */}
        <div className="lg:col-span-2 bg-white border border-sage/15 rounded-3xl p-6 shadow-soft flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep flex items-center gap-2">
              <Star size={16} className="text-gold" /> Top 10 Selling Items
            </h3>
            <div className="flex gap-2">
              <button onClick={() => handleExport("csv")} className="bg-sage/5 hover:bg-sage/15 text-sage-deep text-[10px] tracking-widest uppercase font-display font-bold px-3 py-1.5 rounded-lg border border-sage/10 flex items-center gap-1 transition-colors">
                <FileSpreadsheet size={12} /> CSV
              </button>
              <button onClick={() => handleExport("excel")} className="bg-sage/5 hover:bg-sage/15 text-sage-deep text-[10px] tracking-widest uppercase font-display font-bold px-3 py-1.5 rounded-lg border border-sage/10 flex items-center gap-1 transition-colors">
                <Download size={12} /> Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-sage-deep">
              <thead className="bg-sage/5 border-b border-sage/10">
                <tr>
                  <th className="px-4 py-3 font-display font-bold text-[10px] uppercase tracking-widest text-sage/60 rounded-tl-xl">Rank</th>
                  <th className="px-4 py-3 font-display font-bold text-[10px] uppercase tracking-widest text-sage/60">Item Name</th>
                  <th className="px-4 py-3 font-display font-bold text-[10px] uppercase tracking-widest text-sage/60 text-right">Quantity Sold</th>
                  <th className="px-4 py-3 font-display font-bold text-[10px] uppercase tracking-widest text-sage/60 text-right rounded-tr-xl">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage/5">
                {stats.topSellingItems.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-sage/5 transition-colors group">
                    <td className="px-4 py-3 text-center w-12">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-display ${idx < 3 ? 'bg-gold/20 text-gold-dark' : 'bg-sage/10 text-sage'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold group-hover:text-sage">{item.name}</td>
                    <td className="px-4 py-3 text-right font-medium">{item.qty} units</td>
                    <td className="px-4 py-3 text-right font-bold">₹{item.revenue.toLocaleString()}</td>
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
    </div>
  );
}
