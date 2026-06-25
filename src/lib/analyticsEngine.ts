import { supabase } from "./supabase";
import { subMonths, format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfYear, getHours, getDay } from "date-fns";

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
  peakHours: { hour: string; orders: number; revenue: number }[];
  weekdayPerformance: { day: string; revenue: number }[];
  
  bestSellingItem: string | null;
  bestSellingCategory: string | null;
  highestRevenueDay: { date: string; revenue: number } | null;
  peakOrderingHourStr: string | null;

  topSellingItems: { name: string; qty: number; revenue: number }[];
  categoryRevenue: { category: string; count: number; revenue: number; share: number }[];

  monthlyTarget: number;

  // New BI fields
  completedOrders: number;
  cancelledOrders: number;
  pendingOrdersInRange: number;
  slowestHourStr: string | null;
  highestRevenueItem: string | null;
  totalItemsSold: number;
  ordersList: any[];
  trendData: { name: string; orders: number; revenue: number }[];
}

export async function fetchAnalyticsData(fromDate?: Date, toDate?: Date): Promise<AnalyticsPayload> {
  const now = new Date();

  // 1. Calculate selected range bounds
  const rangeStart = fromDate ? startOfDay(fromDate) : startOfMonth(now);
  const rangeEnd = toDate ? endOfDay(toDate) : endOfDay(now);

  // 2. Fetch orders in the selected range (detailed query, optimized for date range)
  const { data: rangeOrders, error: rangeError } = await supabase
    .from("orders")
    .select(`
      id,
      table_number,
      total_amount,
      status,
      created_at,
      idempotency_key,
      order_items (
        id,
        item_name,
        quantity,
        item_price,
        notes
      )
    `)
    .gte("created_at", rangeStart.toISOString())
    .lte("created_at", rangeEnd.toISOString())
    .order("created_at", { ascending: false });

  if (rangeError) {
    throw new Error(`Failed to fetch orders for the range: ${rangeError.message}`);
  }

  // 3. Fetch comparison data (aggregated columns only, lightweight query)
  const compStart = startOfMonth(subMonths(now, 1));
  const { data: compOrders, error: compError } = await supabase
    .from("orders")
    .select("total_amount, status, created_at")
    .gte("created_at", compStart.toISOString())
    .lte("created_at", endOfDay(now).toISOString());

  if (compError) {
    throw new Error(`Failed to fetch comparison orders: ${compError.message}`);
  }

  // 4. Fetch table tokens from restaurant_tables to display table session tokens
  const { data: tables } = await supabase
    .from("restaurant_tables")
    .select("table_number, token");

  const tableTokenMap: Record<number, string> = {};
  if (tables) {
    tables.forEach((t) => {
      tableTokenMap[t.table_number] = t.token;
    });
  }

  // 5. Fetch menu items to compile item-to-category mapping
  const { data: menuList } = await supabase.from("menu_items").select("name, category");
  const itemToCategoryMap: Record<string, string> = {};
  if (menuList) {
    menuList.forEach((item) => {
      itemToCategoryMap[item.name] = item.category;
    });
  }

  // Helper date milestones
  const startToday = startOfDay(now).getTime();
  const startYesterday = startOfDay(subDays(now, 1)).getTime();
  const endYesterday = startToday - 1;
  const startThisMonth = startOfMonth(now).getTime();
  const startLastMonth = startOfMonth(subMonths(now, 1)).getTime();
  const endLastMonth = startThisMonth - 1;

  // Comparison Metrics calculations (based on compOrders)
  let todayOrders = 0;
  let todayRevenue = 0;
  let yesterdayRevenue = 0;
  let thisMonthRevenue = 0;
  let lastMonthRevenue = 0;

  const statusCountsGlobal = { Pending: 0, Preparing: 0, Ready: 0, Served: 0, Accepted: 0, Cancelled: 0 };

  if (compOrders) {
    compOrders.forEach((order) => {
      const orderTime = new Date(order.created_at).getTime();
      const orderTotal = Number(order.total_amount);
      const isCancelled = order.status === "Cancelled";

      if (order.status in statusCountsGlobal) {
        statusCountsGlobal[order.status as keyof typeof statusCountsGlobal]++;
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
      }
    });
  }

  // Range-specific calculations (based on rangeOrders)
  let rangeTotalOrders = 0;
  let rangeTotalRevenue = 0;
  let highestOrderAmount = 0;
  let lowestOrderAmount: number | null = null;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let pendingOrdersInRange = 0;
  let totalItemsSold = 0;

  const peakHoursMap: Record<number, { orders: number; revenue: number }> = {};
  for (let i = 0; i < 24; i++) peakHoursMap[i] = { orders: 0, revenue: 0 };

  const weekdayMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
  const itemAgg: Record<string, { qty: number; revenue: number }> = {};
  const catAgg: Record<string, { count: number; revenue: number }> = {};
  
  // Custom grouping based on date range
  const daysDiff = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000);
  const trendMap: Record<string, { orders: number; revenue: number }> = {};

  // Format helper for peak hours
  function formatHour(h: number) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr} ${ampm}`;
  }

  if (daysDiff <= 1) {
    // 1-day range: trend by hour
    for (let i = 0; i < 24; i++) {
      trendMap[formatHour(i)] = { orders: 0, revenue: 0 };
    }
  } else if (daysDiff <= 31) {
    // Up to 1 month: trend by day
    for (let i = 0; i < daysDiff; i++) {
      const d = subDays(rangeEnd, i);
      trendMap[format(d, 'MMM dd')] = { orders: 0, revenue: 0 };
    }
  } else {
    // Over 1 month: trend by month
    let checkDate = new Date(rangeStart);
    while (checkDate <= rangeEnd) {
      trendMap[format(checkDate, 'MMM yyyy')] = { orders: 0, revenue: 0 };
      checkDate = subMonths(checkDate, -1); // increment month
    }
  }

  const ordersList: any[] = [];

  if (rangeOrders) {
    rangeOrders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const orderTime = orderDate.getTime();
      const orderTotal = Number(order.total_amount);
      const isCancelled = order.status === "Cancelled";

      rangeTotalOrders++;

      if (order.status === "Served") {
        completedOrders++;
      } else if (order.status === "Cancelled") {
        cancelledOrders++;
      } else {
        pendingOrdersInRange++;
      }

      if (!isCancelled) {
        rangeTotalRevenue += orderTotal;

        if (orderTotal > highestOrderAmount) highestOrderAmount = orderTotal;
        if (lowestOrderAmount === null || orderTotal < lowestOrderAmount) {
          lowestOrderAmount = orderTotal;
        }

        // Grouping for Peak Hours
        const hour = getHours(orderDate);
        peakHoursMap[hour].orders++;
        peakHoursMap[hour].revenue += orderTotal;

        // Grouping for Weekday
        const day = getDay(orderDate);
        weekdayMap[day] += orderTotal;

        // Grouping for Trend
        let trendKey = "";
        if (daysDiff <= 1) {
          trendKey = formatHour(hour);
        } else if (daysDiff <= 31) {
          trendKey = format(orderDate, 'MMM dd');
        } else {
          trendKey = format(orderDate, 'MMM yyyy');
        }
        if (trendMap[trendKey] !== undefined) {
          trendMap[trendKey].orders++;
          trendMap[trendKey].revenue += orderTotal;
        }

        // Aggregating items
        if (order.order_items) {
          order.order_items.forEach((item: any) => {
            const qty = Number(item.quantity);
            const total = qty * Number(item.item_price);
            const cat = itemToCategoryMap[item.item_name] || "Other";

            totalItemsSold += qty;

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

      // Add to detailed orders list
      ordersList.push({
        id: order.id,
        table_number: order.table_number,
        total_amount: orderTotal,
        status: order.status,
        created_at: order.created_at,
        token: tableTokenMap[order.table_number] || "N/A",
        payment_status: order.status === "Served" ? "Paid" : (order.status === "Cancelled" ? "Cancelled" : "Unpaid"),
        order_items: order.order_items || [],
      });
    });
  }

  const todayVsYesterdayPercent = yesterdayRevenue === 0 ? (todayRevenue > 0 ? 100 : 0) : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
  const monthVsMonthPercent = lastMonthRevenue === 0 ? (thisMonthRevenue > 0 ? 100 : 0) : ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  const averageOrderValue = (rangeTotalOrders - cancelledOrders) > 0 ? Math.round(rangeTotalRevenue / (rangeTotalOrders - cancelledOrders)) : 0;

  // Peak and Slowest Hour calculations
  let peakOrderingHourStr: string | null = null;
  let maxHourOrders = -1;
  let slowestHourStr: string | null = null;
  let minHourOrders = Infinity;

  Object.entries(peakHoursMap).forEach(([hourStr, data]) => {
    const formatted = formatHour(Number(hourStr));
    if (data.orders > maxHourOrders) {
      maxHourOrders = data.orders;
      peakOrderingHourStr = formatted;
    }
    // Only track slowest hour if it's within standard business hours or has some data points
    if (data.orders < minHourOrders) {
      minHourOrders = data.orders;
      slowestHourStr = formatted;
    }
  });

  if (maxHourOrders === 0) peakOrderingHourStr = "N/A";
  if (minHourOrders === Infinity || rangeTotalOrders === 0) slowestHourStr = "N/A";

  const topSellingItems = Object.entries(itemAgg)
    .map(([name, d]) => ({ name, qty: d.qty, revenue: d.revenue }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const categoryRevenue = Object.entries(catAgg)
    .map(([category, d]) => ({
      category,
      count: d.count,
      revenue: d.revenue,
      share: rangeTotalRevenue > 0 ? Math.round((d.revenue / rangeTotalRevenue) * 100) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const bestSellingItem = topSellingItems.length > 0 ? topSellingItems[0].name : "N/A";
  const bestSellingCategory = categoryRevenue.length > 0 ? categoryRevenue[0].category : "N/A";
  
  let highestRevenueItem = "N/A";
  let maxItemRev = -1;
  Object.entries(itemAgg).forEach(([name, d]) => {
    if (d.revenue > maxItemRev) {
      maxItemRev = d.revenue;
      highestRevenueItem = name;
    }
  });

  // Re-build 7 Days metrics for backward compatibility or display
  const last7DaysMap: Record<string, { orders: number; revenue: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = subDays(now, i);
    last7DaysMap[format(d, 'MMM dd')] = { orders: 0, revenue: 0 };
  }
  if (compOrders) {
    compOrders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const orderTime = orderDate.getTime();
      const orderTotal = Number(order.total_amount);
      const isCancelled = order.status === "Cancelled";
      if (!isCancelled && orderTime >= startOfDay(subDays(now, 6)).getTime()) {
        const l7Key = format(orderDate, 'MMM dd');
        if (last7DaysMap[l7Key] !== undefined) {
          last7DaysMap[l7Key].orders += 1;
          last7DaysMap[l7Key].revenue += orderTotal;
        }
      }
    });
  }
  const ordersLast7Days = Object.entries(last7DaysMap).map(([date, d]) => ({ date, orders: d.orders }));
  const revenueLast7Days = Object.entries(last7DaysMap).map(([date, d]) => ({ date, revenue: d.revenue }));

  // Re-build monthly map for backward compatibility
  const monthlyMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    monthlyMap[format(d, 'MMM yyyy')] = 0;
  }
  if (compOrders) {
    compOrders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const orderTotal = Number(order.total_amount);
      if (order.status !== "Cancelled") {
        const monthKey = format(orderDate, 'MMM yyyy');
        if (monthlyMap[monthKey] !== undefined) {
          monthlyMap[monthKey] += orderTotal;
        }
      }
    });
  }
  const monthlyData = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue })).reverse();
  const yearlyData = [{ year: format(now, "yyyy"), revenue: thisMonthRevenue }];

  const peakHours = Object.entries(peakHoursMap).map(([hour, data]) => ({ hour: formatHour(Number(hour)), orders: data.orders, revenue: data.revenue }));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayPerformance = [1, 2, 3, 4, 5, 6, 0].map(dayIdx => ({ day: dayNames[dayIdx], revenue: weekdayMap[dayIdx] }));

  // Find highest revenue day in range
  const dailyRevenueMap: Record<string, number> = {};
  if (rangeOrders) {
    rangeOrders.forEach((o) => {
      if (o.status !== "Cancelled") {
        const dayStr = format(new Date(o.created_at), 'yyyy-MM-dd');
        dailyRevenueMap[dayStr] = (dailyRevenueMap[dayStr] || 0) + Number(o.total_amount);
      }
    });
  }
  let highestRevenueDay: { date: string; revenue: number } | null = null;
  Object.entries(dailyRevenueMap).forEach(([date, revenue]) => {
    if (!highestRevenueDay || revenue > highestRevenueDay.revenue) {
      highestRevenueDay = { date, revenue };
    }
  });

  // Dynamic trend data to pass to the chart
  const trendData = Object.entries(trendMap)
    .map(([key, val]) => ({
      name: key,
      orders: val.orders,
      revenue: val.revenue
    }));
  
  if (daysDiff > 1 && daysDiff <= 31) {
    trendData.reverse(); // put back chronological order
  }

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
    pendingOrders: statusCountsGlobal.Pending,
    preparingOrders: statusCountsGlobal.Preparing,
    readyOrders: statusCountsGlobal.Ready,
    servedOrders: statusCountsGlobal.Served,
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

    // New BI fields
    completedOrders,
    cancelledOrders,
    pendingOrdersInRange,
    slowestHourStr,
    highestRevenueItem,
    totalItemsSold,
    ordersList,
    trendData,
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
