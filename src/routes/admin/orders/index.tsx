import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { updateOrderStatusFn } from "@/lib/adminActions";
import { formatOrderTime } from "@/lib/utils";
import { 
  Calendar, 
  ChevronDown, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Clock, 
  AlertTriangle,
  FileText,
  Loader2,
  X,
  Check
} from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  item_price: number;
  notes: string | null;
}

interface Order {
  id: string;
  table_number: number;
  total_amount: number;
  status: "Pending" | "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled";
  created_at: string;
  order_items: OrderItem[];
}

// Loader is intentionally empty — orders are fetched client-side after auth session is available.
// SSR/anon loader queries against orders fail with 42501 (anon has no SELECT on orders).
export const Route = createFileRoute("/admin/orders/")({
  component: OrdersManagementPage,
});

const STATUS_FILTERS = ["All", "Pending", "Accepted", "Preparing", "Ready", "Served", "Cancelled"];

function OrdersManagementPage() {
  const router = useRouter();
  const { sessionToken, authLoading } = useAdmin();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const fetchOrders = async (showSkeleton = true) => {
    if (!sessionToken) return;
    console.log("[ORDER_HISTORY] FETCH_STARTED");
    if (showSkeleton) setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          table_number,
          total_amount,
          status,
          created_at,
          order_items (
            id,
            item_name,
            quantity,
            item_price,
            notes
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ORDER_HISTORY] FETCH_ERROR", error);
        toast.error(`Failed to load orders: ${error.message}`);
      } else {
        console.log("[ORDER_HISTORY] FETCH_SUCCESS, rows:", data?.length ?? 0);
        setAllOrders((data as unknown as Order[]) || []);
      }
    } finally {
      console.log("[ORDER_HISTORY] LOADING_FALSE");
      if (showSkeleton) setDataLoading(false);
    }
  };

  // Fetch once auth is ready — clear skeleton if auth finishes without token
  useEffect(() => {
    console.log("[ORDER_HISTORY] PAGE_MOUNTED | sessionToken:", !!sessionToken, "| authLoading:", authLoading);
    if (sessionToken) {
      fetchOrders();
      
      const channel = supabase.channel("order_history_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => { fetchOrders(false); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (!authLoading) {
      console.log("[ORDER_HISTORY] Auth done, no token — clearing skeleton");
      setDataLoading(false);
    }
  }, [sessionToken, authLoading]);

  const filteredOrders = allOrders.filter((ord) => {
    return selectedStatus === "All" || ord.status === selectedStatus;
  });

  const handleStatusChange = async (
    orderId: string,
    newStatus: "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled"
  ) => {
    if (!sessionToken) return;

    setLoadingId(orderId);
    try {
      const response = await updateOrderStatusFn({
        data: {
          payload: {
            orderId,
            status: newStatus,
          },
          token: sessionToken,
        },
      });

      if (response.success) {
        setSuccessId(orderId);
        toast.success(newStatus === "Cancelled" ? "Order Cancelled" : `Order status updated to ${newStatus}`);
        fetchOrders(false);
        setTimeout(() => {
          setSuccessId(null);
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update order status.");
    } finally {
      setLoadingId(null);
      if (newStatus === "Cancelled") setOrderToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 border border-sage/15 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-sage-deep">Order History & Management</h2>
          <p className="text-xs text-sage/75 mt-1">
            View, filter, and track status transitions of all dine-in receipts.
          </p>
        </div>
        
        {/* Category filters */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedStatus(filter)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-display font-semibold tracking-wider transition-all duration-300 cursor-pointer ${
                selectedStatus === filter
                  ? "bg-sage text-cream shadow-soft"
                  : "bg-white/50 border border-sage/10 text-sage-deep hover:bg-white"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List Table / Grid */}
      {dataLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-sage/10 rounded-2xl p-5 animate-pulse flex gap-4">
              <div className="w-16 h-16 bg-sage/10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-sage/10 rounded w-1/3" />
                <div className="h-3 bg-sage/10 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const formattedTime = formatOrderTime(order.created_at);

          return (
            <div
              key={order.id}
              className="bg-white border border-sage/10 rounded-2xl p-5 shadow-soft hover:shadow-luxe transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              {/* Left Column: ID, Table, Status */}
              <div className="flex items-start gap-4 min-w-[200px]">
                <div className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center font-display font-extrabold text-xl ${
                  order.status === "Served" ? "bg-sage/15 text-sage-deep" : "bg-amber-100 text-amber-800"
                }`}>
                  T{order.table_number}
                </div>
                <div>
                  <span className="text-sm font-display font-bold text-sage-deep block">
                    Table {order.table_number}
                  </span>
                  <span className="text-[10px] text-sage/60 font-mono block truncate max-w-[120px]" title={order.id}>
                    ID: #{order.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-sage-deep/80 mt-1 flex items-center gap-1">
                    <Calendar size={12} /> {formattedTime}
                  </span>
                  <div className="mt-2">
                    <span className={`text-[9px] font-display uppercase tracking-widest font-extrabold px-2.5 py-0.5 rounded-full ${
                      order.status === "Pending" ? "bg-amber-100 text-amber-800" :
                      order.status === "Accepted" ? "bg-blue-100 text-blue-800" :
                      order.status === "Preparing" ? "bg-purple-100 text-purple-800" :
                      order.status === "Ready" ? "bg-teal-100 text-teal-800" :
                      order.status === "Served" ? "bg-sage text-cream" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Column: Items */}
              <div className="flex-1 min-w-[280px]">
                <ul className="divide-y divide-sage/5 space-y-1">
                  {order.order_items.map((item) => (
                    <li key={item.id} className="text-xs py-1 text-sage-deep flex flex-col">
                      <div className="flex justify-between font-medium">
                        <span>{item.quantity}x {item.item_name}</span>
                        <span className="text-sage-deep/60">₹{item.item_price * item.quantity}</span>
                      </div>
                      {item.notes && (
                        <span className="text-[9px] text-gold font-semibold mt-0.5 flex items-center gap-1">
                          <FileText size={8} /> Note: {item.notes}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Total and Actions */}
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 border-t md:border-t-0 border-sage/5 pt-4 md:pt-0 min-w-[180px]">
                <div className="text-right">
                  <p className="text-[10px] text-sage/60 font-semibold uppercase tracking-wider">Subtotal</p>
                  <p className="text-lg font-bold text-sage-deep">₹{order.total_amount}</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  {order.status !== "Served" && order.status !== "Cancelled" && (
                    <>
                      <button
                        disabled={loadingId === order.id || successId === order.id}
                        onClick={() => setOrderToDelete(order.id)}
                        className="bg-white hover:bg-destructive/10 text-destructive border border-sage/10 rounded-lg p-2 transition-colors cursor-pointer"
                        title="Cancel Order"
                      >
                        {loadingId === order.id && orderToDelete === order.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                      
                      {/* Advance workflow button */}
                      {successId === order.id ? (
                        <button
                          disabled
                          className="bg-green-500 text-white font-display text-[9px] font-bold px-3 py-2 rounded-lg flex items-center gap-1"
                        >
                          <Check size={12} className="animate-in zoom-in duration-300" /> Done
                        </button>
                      ) : order.status === "Pending" ? (
                        <button
                          disabled={loadingId === order.id}
                          onClick={() => handleStatusChange(order.id, "Accepted")}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-display text-[9px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          {loadingId === order.id && <Loader2 size={12} className="animate-spin" />}
                          {loadingId === order.id ? "..." : "Accept"}
                        </button>
                      ) : order.status === "Accepted" ? (
                        <button
                          disabled={loadingId === order.id}
                          onClick={() => handleStatusChange(order.id, "Preparing")}
                          className="bg-blue-500 hover:bg-blue-600 text-white font-display text-[9px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          {loadingId === order.id && <Loader2 size={12} className="animate-spin" />}
                          {loadingId === order.id ? "..." : "Prep"}
                        </button>
                      ) : order.status === "Preparing" ? (
                        <button
                          disabled={loadingId === order.id}
                          onClick={() => handleStatusChange(order.id, "Ready")}
                          className="bg-teal-500 hover:bg-teal-600 text-white font-display text-[9px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          {loadingId === order.id && <Loader2 size={12} className="animate-spin" />}
                          {loadingId === order.id ? "..." : "Ready"}
                        </button>
                      ) : order.status === "Ready" ? (
                        <button
                          disabled={loadingId === order.id}
                          onClick={() => handleStatusChange(order.id, "Served")}
                          className="bg-sage hover:bg-sage-soft text-cream font-display text-[9px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
                        >
                          {loadingId === order.id && <Loader2 size={12} className="animate-spin" />}
                          {loadingId === order.id ? "..." : "Serve"}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="py-20 text-center bg-white/40 border border-dashed border-sage/20 rounded-3xl">
            <p className="text-sm font-display font-semibold text-sage-deep/50">
              No orders matches the selected filter.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-luxe border border-sage/10 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setOrderToDelete(null)}
              className="absolute top-4 right-4 text-sage/40 hover:text-sage transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 text-destructive mb-4">
              <div className="bg-destructive/10 p-2 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="font-display font-bold text-xl">Cancel Order?</h3>
            </div>
            
            <p className="text-sm text-sage-deep mb-6">
              Are you sure you want to cancel this order? This action will mark it as cancelled and it will be removed from the active queue.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-sage bg-sage/5 hover:bg-sage/10 transition-colors"
              >
                No, Keep it
              </button>
              <button
                onClick={() => handleStatusChange(orderToDelete, "Cancelled")}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2"
                disabled={!!loadingId}
              >
                {loadingId ? <Loader2 size={16} className="animate-spin" /> : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
