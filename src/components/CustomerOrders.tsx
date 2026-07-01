import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { OrderTimeline, OrderStatus } from "./OrderTimeline";
import { formatOrderTime } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  item_price: number;
  notes: string | null;
}

interface Order {
  id: string;
  status: OrderStatus;
  created_at: string;
  total_amount: number;
  order_items: OrderItem[];
}

interface CustomerOrdersProps {
  tableNumber: string | number;
}

export function CustomerOrders({ tableNumber }: CustomerOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel(`customer_orders_table_${tableNumber}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `table_number=eq.${tableNumber}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const newStatus = payload.new.status as OrderStatus;
            handleStatusToast(newStatus);
          }
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableNumber]);

  const handleStatusToast = (status: OrderStatus) => {
    switch (status) {
      case "Pending":
        toast.info("Your order has been received.", { icon: "👋" });
        break;
      case "Accepted":
        toast.success("Kitchen accepted your order.", { icon: "👨‍🍳" });
        break;
      case "Preparing":
        toast.info("Your food is being prepared.", { icon: "🔥" });
        break;
      case "Ready":
        toast.success("Your order is ready.", { icon: "🛎️" });
        break;
      case "Served":
        toast.success("Thank you for visiting SmooBuds.", { icon: "✨" });
        break;
      case "Cancelled":
        toast.error("Your order was cancelled.");
        break;
    }
  };

  const fetchOrders = async () => {
    try {
      // Only show orders from the last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          created_at,
          total_amount,
          order_items(id, item_name, quantity, item_price, notes)
        `)
        .eq("table_number", tableNumber)
        .gte("created_at", yesterday.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data as Order[]);
    } catch (err) {
      console.error("Failed to fetch customer orders:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || orders.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <h2 className="font-display font-extrabold text-xl text-sage-deep px-4 mt-8">Your Orders</h2>
      
      <div className="space-y-4 px-4">
        <AnimatePresence>
          {orders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-5 shadow-soft border border-sage/10 overflow-hidden"
            >
              {/* Header */}
              <div 
                className="flex justify-between items-start cursor-pointer"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div>
                  <h3 className="font-display font-extrabold text-sage-deep text-lg">
                    Order #{order.id.slice(0, 5)}
                  </h3>
                  <span className="text-xs text-sage/70 font-semibold mt-0.5 block">
                    {formatOrderTime(order.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sage-deep">
                    ₹{order.total_amount}
                  </span>
                  <button className="p-1.5 rounded-full bg-sage/5 text-sage-deep/60">
                    {expandedId === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Items Detail */}
              <AnimatePresence>
                {expandedId === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 mt-4 border-t border-sage/5">
                      <ul className="space-y-2">
                        {order.order_items.map((item) => (
                          <li key={item.id} className="text-sm flex flex-col gap-1">
                            <div className="flex justify-between items-center text-sage-deep font-medium">
                              <span>{item.quantity}x {item.item_name}</span>
                              <span className="text-sage/80 font-semibold text-xs">₹{item.item_price * item.quantity}</span>
                            </div>
                            {item.notes && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded w-fit">
                                Note: {item.notes}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Timeline */}
              <div className="mt-4 pt-2 border-t border-sage/5 -mx-2">
                <OrderTimeline status={order.status} orderTime={formatOrderTime(order.created_at)} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
