import { supabase } from "./supabase";
import { subMonths, format, startOfDay, subDays, startOfMonth, startOfYear, getHours, getDay } from "date-fns";

export interface AnalyticsPayload {
  todayOrders: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  todayVsYesterdayPercent: number;

  thisMonthRevenue: number;
  lastMonthRevenue: number;
  monthVsMonthPercent: number;

  averageOrderValue: number;
  highestOrderAmount: number;
  lowestOrderAmount: number | null;

  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  servedOrders: number;

  rangeTotalOrders: number;
  rangeTotalRevenue: number;
  
  ordersLast7Days: { date: string; orders: number }[];
  revenueLast7Days: { date: string; revenue: number }[];
  monthlyData: { month: string; revenue: number }[];
  yearlyData: { year: string; revenue: number }[];
  peakHours: { hour: string; orders: number }[];
  weekdayPerformance: { day: string; revenue: number }[];
  
  bestSellingItem: string | null;
  bestSellingCategory: string | null;
  highestRevenueDay: { date: string; revenue: number } | null;
  peakOrderingHourStr: string | null;

  topSellingItems: { name: string; qty: number; revenue: number }[];
  categoryRevenue: { category: string; count: number; revenue: number; share: number }[];

  monthlyTarget: number;
}

export async function fetchAnalyticsData(fromDate?: Date, toDate?: Date): Promise<AnalyticsPayload> {
  const now = new Date();
  const cutoffDate = subMonths(now, 18).toISOString();

  const { data: allOrders, error } = await supabase
    .from("orders")
    .select(`
      id,
      total_amount,
      status,
      created_at,
      order_items (
        item_name,
        quantity,
        item_price
      )
    `)
    .gte("created_at", cutoffDate);

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  const { data: menuList } = await supabase.from("menu_items").select("name, category");
  const itemToCategoryMap: Record<string, string> = {};
  if (menuList) {
    menuList.forEach((item) => {
      itemToCategoryMap[item.name] = item.category;
    });
  }

  const startToday = startOfDay(now).getTime();
  const startYesterday = startOfDay(subDays(now, 1)).getTime();
  const endYesterday = startToday - 1;

  const startThisMonth = startOfMonth(now).getTime();
  const startLastMonth = startOfMonth(subMonths(now, 1)).getTime();
  const endLastMonth = startThisMonth - 1;

  const selectedStart = fromDate ? startOfDay(fromDate).getTime() : startThisMonth;
  const selectedEnd = toDate ? startOfDay(toDate).getTime() + 86400000 - 1 : now.getTime();

  let todayOrders = 0;
  let todayRevenue = 0;
  let yesterdayRevenue = 0;
  let thisMonthRevenue = 0;
  let lastMonthRevenue = 0;
  
  let rangeTotalOrders = 0;
  let rangeTotalRevenue = 0;
  let highestOrderAmount = 0;
  let lowestOrderAmount: number | null = null;

  const statusCounts = { Pending: 0, Preparing: 0, Ready: 0, Served: 0, Accepted: 0, Cancelled: 0 };

  const last7DaysMap: Record<string, { orders: number; revenue: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = subDays(now, i);
    last7DaysMap[format(d, 'MMM dd')] = { orders: 0, revenue: 0 };
  }

  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    monthlyMap[format(d, 'MMM yyyy')] = 0;
  }

  const yearlyMap: Record<string, number> = {};
  yearlyMap[format(now, 'yyyy')] = 0;
  yearlyMap[format(subMonths(now, 12), 'yyyy')] = 0;

  const peakHoursMap: Record<number, number> = {};
  for (let i = 0; i < 24; i++) peakHoursMap[i] = 0;

  const weekdayMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
  
  const itemAgg: Record<string, { qty: number; revenue: number }> = {};
  const catAgg: Record<string, { count: number; revenue: number }> = {};
  const dailyRevenueMap: Record<string, number> = {};

  if (allOrders) {
    allOrders.forEach((order) => {
      const orderTime = new Date(order.created_at).getTime();
      const orderDate = new Date(order.created_at);
      const orderTotal = Number(order.total_amount);
      const isCancelled = order.status === "Cancelled";

      if (order.status in statusCounts) {
        statusCounts[order.status as keyof typeof statusCounts]++;
      }

      if (!isCancelled) {
        if (orderTime >= startToday) {
          todayOrders++;
          todayRevenue += orderTotal;
        } else if (orderTime >= startYesterday && orderTime <= endYesterday) {
          yesterdayRevenue += orderTotal;
        }

        if (orderTime >= startThisMonth) {
          thisMonthRevenue += orderTotal;
        } else if (orderTime >= startLastMonth && orderTime <= endLastMonth) {
          lastMonthRevenue += orderTotal;
        }

        const l7Key = format(orderDate, 'MMM dd');
        if (last7DaysMap[l7Key] !== undefined) {
          last7DaysMap[l7Key].orders += 1;
          last7DaysMap[l7Key].revenue += orderTotal;
        }

        const monthKey = format(orderDate, 'MMM yyyy');
        if (monthlyMap[monthKey] !== undefined) {
          monthlyMap[monthKey] += orderTotal;
        }

        const yearKey = format(orderDate, 'yyyy');
        if (yearlyMap[yearKey] !== undefined) {
          yearlyMap[yearKey] += orderTotal;
        }

        const hour = getHours(orderDate);
        peakHoursMap[hour]++;

        const day = getDay(orderDate);
        weekdayMap[day] += orderTotal;

        const dateKeyStr = format(orderDate, 'yyyy-MM-dd');
        dailyRevenueMap[dateKeyStr] = (dailyRevenueMap[dateKeyStr] || 0) + orderTotal;
      }

      if (orderTime >= selectedStart && orderTime <= selectedEnd) {
        if (!isCancelled) {
          rangeTotalOrders++;
          rangeTotalRevenue += orderTotal;

          if (orderTotal > highestOrderAmount) highestOrderAmount = orderTotal;
          if (lowestOrderAmount === null || orderTotal < lowestOrderAmount) {
            lowestOrderAmount = orderTotal;
          }

          if (order.order_items) {
            order.order_items.forEach((item: any) => {
              const qty = Number(item.quantity);
              const total = qty * Number(item.item_price);
              const cat = itemToCategoryMap[item.item_name] || "Other";

              if (itemAgg[item.item_name]) {
                itemAgg[item.item_name].qty += qty;
                itemAgg[item.item_name].revenue += total;
              } else {
                itemAgg[item.item_name] = { qty, revenue: total };
              }

              if (catAgg[cat]) {
                catAgg[cat].count += qty;
                catAgg[cat].revenue += total;
              } else {
                catAgg[cat] = { count: qty, revenue: total };
              }
            });
          }
        }
      }
    });
  }

  const todayVsYesterdayPercent = yesterdayRevenue === 0 ? (todayRevenue > 0 ? 100 : 0) : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  const monthVsMonthPercent = lastMonthRevenue === 0 ? (thisMonthRevenue > 0 ? 100 : 0) : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  const averageOrderValue = rangeTotalOrders > 0 ? Math.round(rangeTotalRevenue / rangeTotalOrders) : 0;

  const ordersLast7Days = Object.entries(last7DaysMap).map(([date, d]) => ({ date, orders: d.orders }));
  const revenueLast7Days = Object.entries(last7DaysMap).map(([date, d]) => ({ date, revenue: d.revenue }));
  const monthlyData = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue })).reverse();
  const yearlyData = Object.entries(yearlyMap).map(([year, revenue]) => ({ year, revenue }));
  
  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr} ${ampm}`;
  };
  const peakHours = Object.entries(peakHoursMap).map(([hour, orders]) => ({ hour: formatHour(Number(hour)), orders }));
  
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayPerformance = [1, 2, 3, 4, 5, 6, 0].map(dayIdx => ({ day: dayNames[dayIdx], revenue: weekdayMap[dayIdx] }));

  const topSellingItems = Object.entries(itemAgg)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const categoryRevenue = Object.entries(catAgg)
    .map(([category, d]) => ({ category, count: d.count, revenue: d.revenue, share: rangeTotalRevenue > 0 ? Math.round((d.revenue / rangeTotalRevenue) * 100) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const bestSellingItem = topSellingItems.length > 0 ? topSellingItems[0].name : null;
  const bestSellingCategory = categoryRevenue.length > 0 ? categoryRevenue[0].category : null;
  
  let highestRevenueDay: { date: string; revenue: number } | null = null;
  Object.entries(dailyRevenueMap).forEach(([date, revenue]) => {
    if (!highestRevenueDay || revenue > highestRevenueDay.revenue) {
      highestRevenueDay = { date, revenue };
    }
  });

  let peakOrderingHourStr: string | null = null;
  let maxHourOrders = -1;
  Object.entries(peakHoursMap).forEach(([hour, orders]) => {
    if (orders > maxHourOrders) {
      maxHourOrders = orders;
      peakOrderingHourStr = formatHour(Number(hour));
    }
  });

  return {
    todayOrders,
    todayRevenue,
    yesterdayRevenue,
    todayVsYesterdayPercent,
    thisMonthRevenue,
    lastMonthRevenue,
    monthVsMonthPercent,
    averageOrderValue,
    highestOrderAmount,
    lowestOrderAmount,
    pendingOrders: statusCounts.Pending,
    preparingOrders: statusCounts.Preparing,
    readyOrders: statusCounts.Ready,
    servedOrders: statusCounts.Served,
    rangeTotalOrders,
    rangeTotalRevenue,
    ordersLast7Days,
    revenueLast7Days,
    monthlyData,
    yearlyData,
    peakHours,
    weekdayPerformance,
    bestSellingItem,
    bestSellingCategory,
    highestRevenueDay,
    peakOrderingHourStr,
    topSellingItems,
    categoryRevenue,
    monthlyTarget: 100000, 
  };
}

export async function fetchLiveDashboardStats() {
  const startToday = startOfDay(new Date()).getTime();

  const { data: todayOrders, error } = await supabase
    .from("orders")
    .select("total_amount, status, created_at")
    .gte("created_at", new Date(startToday).toISOString());

  if (error) throw error;

  let revenue = 0;
  let count = 0;
  let pending = 0;
  let preparing = 0;
  let ready = 0;

  if (todayOrders) {
    todayOrders.forEach(o => {
      if (o.status === "Pending") pending++;
      else if (o.status === "Preparing") preparing++;
      else if (o.status === "Ready") ready++;
      
      if (o.status !== "Cancelled") {
        count++;
        revenue += Number(o.total_amount);
      }
    });
  }

  return { revenue, count, pending, preparing, ready };
}
