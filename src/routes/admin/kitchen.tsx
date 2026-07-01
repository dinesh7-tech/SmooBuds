import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { updateOrderStatusFn } from "@/lib/adminActions";
import { ChefHat, Check, Flame, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
}

interface Order {
  id: string;
  table_number: number;
  status: "Pending" | "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled";
  created_at: string;
  order_items: OrderItem[];
}

// Loader is intentionally empty — orders are fetched client-side after auth session is available.
// SSR/anon loader queries against orders fail with 42501 (anon has no SELECT on orders).
export const Route = createFileRoute("/admin/kitchen")({
  component: KitchenBoard,
});

function KitchenBoard() {
  const router = useRouter();
  const { sessionToken, authLoading } = useAdmin();
  const [kitchenQueue, setKitchenQueue] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Force re-render every minute to update elapsed time
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueue = async (showSkeleton = true) => {
    if (!sessionToken) return;
    console.log("[KITCHEN] FETCH_STARTED");
    if (showSkeleton) setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          table_number,
          status,
          created_at,
          order_items (
            id,
            item_name,
            quantity,
            notes
          )
        `)
        .in("status", ["Accepted", "Preparing"])
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[KITCHEN] FETCH_ERROR", error);
        toast.error(`Failed to load kitchen queue: ${error.message}`);
      } else {
        console.log("[KITCHEN] FETCH_SUCCESS, rows:", data?.length ?? 0);
        setKitchenQueue((data as unknown as Order[]) || []);
      }
    } finally {
      console.log("[KITCHEN] LOADING_FALSE");
      if (showSkeleton) setDataLoading(false);
    }
  };

  // Fetch once auth is ready — clear skeleton if auth finishes without token
  useEffect(() => {
    console.log("[KITCHEN] PAGE_MOUNTED | sessionToken:", !!sessionToken, "| authLoading:", authLoading);
    if (sessionToken) {
      fetchQueue();
    } else if (!authLoading) {
      console.log("[KITCHEN] Auth done, no token — clearing skeleton");
      setDataLoading(false);
    }
  }, [sessionToken, authLoading]);

  // Real-time listener for the kitchen queue
  useEffect(() => {
    if (!sessionToken) return;

    const channel = supabase
      .channel("kitchen_board_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { fetchQueue(false); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionToken]);

  const advanceOrder = async (orderId: string, currentStatus: string) => {
    console.log("ACTION_CLICKED", "Update Order Status");
    if (!sessionToken) return;

    setLoadingId(orderId);
    const targetStatus = currentStatus === "Accepted" ? "Preparing" : "Ready";
    
    try {
      const response = await updateOrderStatusFn({
        data: {
          payload: {
            orderId,
            status: targetStatus,
          },
          token: sessionToken,
        },
      });

      if (response.success) {
        setSuccessId(orderId);
        toast.success(targetStatus === "Preparing" ? "Started cooking!" : "Order marked as Ready!");
        fetchQueue(false);
        setTimeout(() => {
          setSuccessId(null);
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update kitchen queue.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-sage-deep text-cream border border-white/5 rounded-3xl p-6 shadow-soft flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="text-gold" size={32} />
          <div>
            <h2 className="font-display font-extrabold text-2xl">Kitchen Prep Queue</h2>
            <p className="text-xs text-cream/70 mt-1">
              Optimized view for tablet displays. Focus on active preparations and cook times.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-display uppercase tracking-widest font-extrabold text-gold bg-white/10 rounded-full px-4 py-2 border border-white/10">
            Active Orders: {kitchenQueue.length}
          </span>
        </div>
      </div>

      {/* Grid Layout (Large Card Format) */}
      {dataLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white border border-sage/10 rounded-3xl p-6 animate-pulse">
              <div className="h-8 bg-sage/10 rounded mb-4 w-1/2" />
              <div className="h-4 bg-sage/10 rounded mb-2" />
              <div className="h-4 bg-sage/10 rounded mb-2 w-3/4" />
              <div className="h-12 bg-sage/10 rounded mt-6" />
            </div>
          ))}
        </div>
      ) : (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kitchenQueue.map((order) => {
          const minutesElapsed = Math.floor(
            (now - new Date(order.created_at).getTime()) / 60000
          );
          const isPreparing = order.status === "Preparing";

          let timerColorClass = "text-sage-deep/50";
          let timerDotClass = "bg-sage-deep/30";
          if (minutesElapsed >= 20) {
            timerColorClass = "text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full";
            timerDotClass = "bg-red-500 animate-pulse";
          } else if (minutesElapsed >= 10) {
            timerColorClass = "text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full";
            timerDotClass = "bg-yellow-500";
          }

          return (
            <div
              key={order.id}
              className={`bg-white border rounded-3xl overflow-hidden flex flex-col justify-between shadow-soft hover:shadow-luxe transition-all duration-300 ${
                isPreparing 
                  ? "border-purple-400 ring-2 ring-purple-100 bg-purple-50/5" 
                  : "border-blue-400 bg-blue-50/5"
              }`}
            >
              {/* Header */}
              <div className={`px-6 py-5 border-b border-sage/5 flex justify-between items-center ${
                isPreparing ? "bg-purple-100/30" : "bg-blue-100/30"
              }`}>
                <div>
                  <h3 className="font-display font-extrabold text-3xl text-sage-deep">
                    Table {order.table_number}
                  </h3>
                  <span className={`text-xs mt-2 flex items-center gap-1.5 font-semibold w-fit ${timerColorClass}`}>
                    {minutesElapsed >= 10 && <span className={`w-2 h-2 rounded-full ${timerDotClass}`} />}
                    <Clock size={12} /> {minutesElapsed}m elapsed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-display uppercase tracking-widest font-extrabold px-3 py-1.5 rounded-full ${
                    isPreparing ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Items Detail */}
              <div className="p-6 flex-1">
                <ul className="space-y-4">
                  {order.order_items.map((item) => (
                    <li key={item.id} className="text-lg text-sage-deep border-b border-sage/5 pb-2">
                      <div className="flex justify-between font-bold">
                        <span>{item.quantity}x {item.item_name}</span>
                      </div>
                      {item.notes && (
                        <div className="text-xs text-amber-800 font-bold bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 flex items-start gap-1.5 leading-relaxed">
                          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                          <span>Customization: {item.notes}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Button Action */}
              <div className="p-6 border-t border-sage/5">
                {successId === order.id ? (
                  <button
                    disabled
                    className="w-full font-display font-semibold tracking-widest text-xs uppercase py-4 rounded-xl border border-transparent bg-green-500 text-white shadow-soft flex items-center justify-center gap-2"
                  >
                    <Check size={16} className="animate-in zoom-in duration-300" /> Done
                  </button>
                ) : (
                  <button
                    disabled={loadingId === order.id}
                    onClick={() => advanceOrder(order.id, order.status)}
                    className={`w-full font-display font-semibold tracking-widest text-xs uppercase py-4 rounded-xl border border-white/5 transition-all shadow-soft flex items-center justify-center gap-2 cursor-pointer ${
                      isPreparing 
                        ? "bg-teal-500 hover:bg-teal-600 text-white" 
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                    }`}
                  >
                    {loadingId === order.id ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {isPreparing ? "Marking Ready..." : "Starting..."}
                      </>
                    ) : isPreparing ? (
                      <>
                        <Check size={16} /> Mark as Ready
                      </>
                    ) : (
                      <>
                        <Flame size={16} /> Start Preparing
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {kitchenQueue.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white/40 border border-dashed border-sage/20 rounded-3xl">
            <ChefHat className="mx-auto text-sage/30 mb-4 animate-bounce" size={48} />
            <p className="font-display font-extrabold text-lg text-sage-deep/40">
              Kitchen is clear!
            </p>
            <p className="text-xs text-sage/50 mt-1">
              Pending orders will appear here automatically in real-time.
            </p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
