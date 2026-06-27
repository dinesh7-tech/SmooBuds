import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { updateOrderStatusFn, cleanInvalidOrdersFn } from "@/lib/adminActions";
import { 
  Clock, 
  Check, 
  Flame, 
  ShoppingBag, 
  Trash2,
  AlertTriangle,
  Play,
  Volume2,
  VolumeX,
  FileText,
  Loader2,
  X
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
// SSR/anon loader queries against orders would fail with 42501 (anon has no SELECT on orders).
export const Route = createFileRoute("/admin/orders/live")({
  component: LiveOrdersPage,
});

function LiveOrdersPage() {
  const router = useRouter();
  const { sessionToken, authLoading, soundEnabled, setSoundEnabled } = useAdmin();
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  // Fetch orders client-side using authenticated session (not anon SSR loader)
  const fetchOrders = async (showSkeleton = true) => {
    if (!sessionToken) return;
    console.log("[LIVE_ORDERS] FETCH_STARTED");
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
        .neq("status", "Served")
        .neq("status", "Cancelled")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[LIVE_ORDERS] FETCH_ERROR", error);
        toast.error(`Failed to load orders: ${error.message}`);
      } else {
        console.log("[LIVE_ORDERS] FETCH_SUCCESS, rows:", data?.length ?? 0);
        setLiveOrders((data as unknown as Order[]) || []);
      }
    } finally {
      console.log("[LIVE_ORDERS] LOADING_FALSE");
      if (showSkeleton) setDataLoading(false);
    }
  };

  // Fetch once auth is ready — clear skeleton if auth finishes without token
  useEffect(() => {
    console.log("[LIVE_ORDERS] PAGE_MOUNTED | sessionToken:", !!sessionToken, "| authLoading:", authLoading);
    if (sessionToken) {
      fetchOrders();
    } else if (!authLoading) {
      // Auth resolved but no token — user is being redirected; don't freeze on skeleton
      console.log("[LIVE_ORDERS] Auth done, no token — clearing skeleton");
      setDataLoading(false);
    }
  }, [sessionToken, authLoading]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!sessionToken) return;

    const channel = supabase
      .channel("admin_orders_live_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { fetchOrders(false); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => { fetchOrders(false); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionToken]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled"
  ) => {
    console.log("ACTION_CLICKED", "Update Order Status", newStatus);
    if (!sessionToken) {
      toast.error("Session token missing. Re-login.");
      return;
    }

    setUpdatingId(orderId);
    try {
      const response = await updateOrderStatusFn({
        data: {
          payload: { orderId, status: newStatus },
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
      setUpdatingId(null);
      if (newStatus === "Cancelled") setOrderToDelete(null);
    }
  };

  const handleCleanInvalid = async () => {
    if (!sessionToken) return;
    setIsCleaning(true);
    try {
      const response = await cleanInvalidOrdersFn({ data: { token: sessionToken } });
      if (response.success) {
        toast.success(`Cleaned ${response.count} invalid/orphaned orders.`);
        fetchOrders(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to clean invalid orders.");
    } finally {
      setIsCleaning(false);
    }
  };

  const getStatusButton = (order: Order) => {
    const isUpdating = updatingId === order.id;
    const isSuccess = successId === order.id;
    
    if (isSuccess) {
      return (
        <button
          disabled
          className="flex-1 bg-green-500 text-white font-display text-[10px] tracking-wider uppercase font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1"
        >
          <Check size={12} className="animate-in zoom-in duration-300" /> Done
        </button>
      );
    }

    switch (order.status) {
      case "Pending":
        return (
          <button
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "Accepted")}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-display text-[10px] tracking-wider uppercase font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {isUpdating ? "Accepting..." : "Accept Order"}
          </button>
        );
      case "Accepted":
        return (
          <button
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "Preparing")}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-display text-[10px] tracking-wider uppercase font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Flame size={12} />}
            {isUpdating ? "Processing..." : "Start Prep"}
          </button>
        );
      case "Preparing":
        return (
          <button
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "Ready")}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-display text-[10px] tracking-wider uppercase font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {isUpdating ? "Updating..." : "Mark Ready"}
          </button>
        );
      case "Ready":
        return (
          <button
            disabled={isUpdating}
            onClick={() => handleStatusChange(order.id, "Served")}
            className="flex-1 bg-sage hover:bg-sage-soft text-cream font-display text-[10px] tracking-wider uppercase font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <ShoppingBag size={12} />}
            {isUpdating ? "Updating..." : "Mark Served"}
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Control */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-sage/15 rounded-3xl p-6 backdrop-blur-sm">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-sage-deep">Live Orders Pane</h2>
          <p className="text-xs text-sage/75 mt-1">
            Displaying active dine-in tickets in real-time. Sound alerts will ring for incoming orders.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/60 border border-sage/10 rounded-full px-4 py-2">
          <span className="text-[10px] font-display uppercase tracking-widest font-semibold text-sage">Alert Sound</span>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`rounded-full p-1.5 transition-colors ${
              soundEnabled ? "bg-sage text-cream" : "bg-white border border-sage/20 text-sage/60"
            }`}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button
            onClick={handleCleanInvalid}
            disabled={isCleaning}
            className="ml-2 bg-sage/10 hover:bg-sage/20 text-sage text-[10px] font-display uppercase tracking-widest font-semibold px-4 py-2 rounded-full flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Clean Invalid/Orphaned Orders"
          >
            {isCleaning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Clean Invalid
          </button>
        </div>
      </div>

      {/* Loading State */}
      {dataLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-sage/10 rounded-3xl p-6 animate-pulse">
              <div className="h-6 bg-sage/10 rounded mb-4 w-1/2" />
              <div className="h-4 bg-sage/10 rounded mb-2" />
              <div className="h-4 bg-sage/10 rounded mb-2 w-3/4" />
              <div className="h-10 bg-sage/10 rounded mt-4" />
            </div>
          ))}
        </div>
      )}

      {/* Live Order Tickets Grid */}
      {!dataLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {liveOrders.map((order) => {
            const formattedTime = new Date(order.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const minutesElapsed = Math.floor(
              (Date.now() - new Date(order.created_at).getTime()) / 60000
            );

            return (
              <article
                key={order.id}
                className={`bg-white border rounded-3xl overflow-hidden flex flex-col justify-between shadow-soft hover:shadow-luxe transition-shadow ${
                  order.status === "Pending" ? "border-amber-400 ring-2 ring-amber-400/20" :
                  order.status === "Accepted" ? "border-blue-400" :
                  order.status === "Preparing" ? "border-purple-400" :
                  "border-teal-400"
                }`}
              >
                {/* Card Header */}
                <div className={`px-5 py-4 border-b border-sage/5 flex justify-between items-center ${
                  order.status === "Pending" ? "bg-amber-50" :
                  order.status === "Accepted" ? "bg-blue-50/50" :
                  order.status === "Preparing" ? "bg-purple-50/30" :
                  "bg-teal-50/50"
                }`}>
                  <div>
                    <h3 className="font-display font-extrabold text-lg text-sage-deep">
                      Table {order.table_number}
                    </h3>
                    <span className="text-[10px] text-sage-deep/50 font-medium">
                      Placed at {formattedTime} ({minutesElapsed}m ago)
                    </span>
                  </div>
                  <span className={`text-[10px] font-display uppercase tracking-widest font-extrabold px-3 py-1 rounded-full ${
                    order.status === "Pending" ? "bg-amber-100 text-amber-800" :
                    order.status === "Accepted" ? "bg-blue-100 text-blue-800" :
                    order.status === "Preparing" ? "bg-purple-100 text-purple-800" :
                    "bg-teal-100 text-teal-800"
                  }`}>
                    {order.status}
                  </span>
                </div>

                {/* Items List */}
                <div className="p-5 flex-1 space-y-4">
                  <ul className="space-y-3">
                    {order.order_items.map((item) => (
                      <li key={item.id} className="text-sm text-sage-deep flex flex-col">
                        <div className="flex justify-between font-medium">
                          <span>{item.quantity}x {item.item_name}</span>
                          <span className="text-xs text-sage/75">₹{item.item_price * item.quantity}</span>
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-gold font-semibold bg-gold/5 border border-gold/15 rounded-md px-2 py-0.5 mt-1 w-fit flex items-center gap-1">
                            <FileText size={10} /> Note: {item.notes}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Footer */}
                <div className="p-5 border-t border-sage/5 bg-cream/10 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-sage-deep">
                    <span>Ticket Total</span>
                    <span>₹{order.total_amount}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={updatingId === order.id || successId === order.id}
                      onClick={() => setOrderToDelete(order.id)}
                      className="bg-white hover:bg-destructive/10 text-destructive border border-sage/10 rounded-lg p-2 transition-colors cursor-pointer"
                      title="Cancel Order"
                    >
                      {updatingId === order.id && orderToDelete === order.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                    {getStatusButton(order)}
                  </div>
                </div>
              </article>
            );
          })}

          {liveOrders.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white/40 border border-dashed border-sage/20 rounded-3xl">
              <ShoppingBag className="mx-auto text-sage/40 mb-3" size={32} />
              <p className="text-sm font-display font-semibold text-sage-deep/50">
                No active orders on the floor. Everything is served!
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
                disabled={!!updatingId}
              >
                {updatingId ? <Loader2 size={16} className="animate-spin" /> : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
