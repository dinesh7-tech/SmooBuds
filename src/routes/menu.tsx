import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShoppingBag, 
  ChevronRight, 
  QrCode, 
  Search, 
  Sparkles, 
  Check, 
  ArrowLeft, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  Clock, 
  Bell, 
  Receipt,
  FileText,
  AlertTriangle,
  Coffee
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { placeOrderFn, submitTableRequestFn, verifyMenuAccessFn, getNonceFn } from "@/lib/orderActions";
import { toast } from "sonner";
import { MenuPagePromotionBanner, CheckoutPromotionBanner } from "@/components/promotions/PromotionsEngine";

// 1. Zod Search Params Schema
const menuSearchSchema = z.object({
  table: z.coerce.number().int().positive().optional(),
  token: z.string().optional(),
  data: z.string().optional(),
  error: z.string().optional(),
});

// Types
interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: "Coffee" | "Mocktails" | "Shakes" | "Starters" | "Main Course" | "Desserts";
  image_url: string | null;
  is_available: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  selectedNotes: string[]; 
}

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  item_price: number;
  notes: string | null;
}

interface Order {
  id: string;
  status: "Pending" | "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled";
  total_amount: number;
  created_at: string;
  customer_name?: string;
  order_items: OrderItem[];
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-cream text-ink font-body pb-24">
      <header className="sticky top-0 z-40 bg-cream/80 backdrop-blur-md border-b border-sage/10 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="w-24 h-6 bg-sage/10 animate-pulse rounded-md" />
          <div className="w-32 h-8 bg-sage/10 animate-pulse rounded-md" />
          <div className="w-16 h-6 bg-sage/10 animate-pulse rounded-md" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 mt-8">
        <div className="w-full h-32 md:h-48 bg-sage/10 animate-pulse rounded-3xl mb-8" />
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="w-full md:w-64 h-12 bg-sage/10 animate-pulse rounded-full" />
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-24 h-10 bg-sage/10 animate-pulse rounded-full flex-shrink-0" />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4 p-4 border border-sage/10 rounded-2xl">
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-sage/10 animate-pulse rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-3 py-2">
                <div className="w-3/4 h-5 bg-sage/10 animate-pulse rounded-md" />
                <div className="w-full h-3 bg-sage/10 animate-pulse rounded-md" />
                <div className="w-5/6 h-3 bg-sage/10 animate-pulse rounded-md" />
                <div className="w-1/3 h-8 bg-sage/10 animate-pulse rounded-full mt-auto" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/menu")({
  validateSearch: (search) => menuSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: search }) => {
    const sessionStatus = await verifyMenuAccessFn({
      data: { table: search.table, token: search.token, data: search.data },
    });

    let menuItems: MenuItem[] = [];
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_available", true)
        .order("name", { ascending: true });

      if (!error && data) {
        menuItems = data as MenuItem[];
      }
    } catch (err) {
      console.error("Error fetching menu items:", err);
    }

    return {
      tableNumber: sessionStatus.tableNumber,
      isVerified: sessionStatus.isVerified,
      token: search.token || null,
      error: search.error || null,
      menuItems,
    };
  },
  pendingComponent: MenuSkeleton,
  component: MenuPage,
});

const CATEGORIES = ["All", "Coffee", "Mocktails", "Shakes", "Starters", "Main Course", "Desserts"];
const QUICK_NOTES = ["Less Sugar", "Extra Cheese", "No Onion", "Spicy", "Vegan", "Jain"];

function generateUUID() {
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  scale: number;
  xVel: number;
  yVel: number;
}

function ConfettiCelebration() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ["#8B9B74", "#D8B168", "#F5EFEB", "#6E5B4F", "#A38F7E"];
    const count = 40;
    const temp: Particle[] = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        id: i,
        x: 50,
        y: 40,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 6,
        rotation: Math.random() * 360,
        scale: Math.random() * 0.4 + 0.8,
        xVel: (Math.random() - 0.5) * 15,
        yVel: (Math.random() - 0.8) * 18 - 5,
      });
    }
    setParticles(temp);

    let animationFrameId: number;
    let localParticles = [...temp];

    const update = () => {
      localParticles = localParticles.map((p) => {
        const nextY = p.y + p.yVel * 0.15;
        const nextX = p.x + p.xVel * 0.15;
        const nextYVel = p.yVel + 1.2;
        const nextXVel = p.xVel * 0.98;
        return {
          ...p,
          x: nextX,
          y: nextY,
          yVel: nextYVel,
          xVel: nextXVel,
          rotation: p.rotation + p.xVel * 0.2,
        };
      }).filter((p) => p.y < 110 && p.x > -10 && p.x < 110);

      setParticles(localParticles);
      if (localParticles.length > 0) {
        animationFrameId = requestAnimationFrame(update);
      }
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
            borderRadius: p.id % 3 === 0 ? "50%" : p.id % 3 === 1 ? "2px" : "0px",
            opacity: Math.max(0, 1 - (p.y - 40) / 70),
            transition: "opacity 0.1s linear",
          }}
        />
      ))}
    </div>
  );
}

function MenuPage() {
  const router = useRouter();
  const { tableNumber, isVerified, error, menuItems, token } = Route.useLoaderData();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);

  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [isRequestingBill, setIsRequestingBill] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<{ id: string; total: number } | null>(null);

  const cartLocalStorageKey = tableNumber ? `smoobuds_cart_table_${tableNumber}` : "";

  useEffect(() => {
    if (isVerified && cartLocalStorageKey) {
      const savedCart = localStorage.getItem(cartLocalStorageKey);
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch {
          setCart([]);
        }
      }
      setIdempotencyKey(generateUUID());
    }
  }, [isVerified, cartLocalStorageKey]);

  useEffect(() => {
    if (isVerified && cartLocalStorageKey) {
      localStorage.setItem(cartLocalStorageKey, JSON.stringify(cart));
    }
  }, [cart, isVerified, cartLocalStorageKey]);

  // Promotions triggers
  useEffect(() => {
    if (isCartOpen) {
      window.dispatchEvent(new CustomEvent("smoobuds_cart_open"));
    }
  }, [isCartOpen]);

  useEffect(() => {
    if (cart.length > 0) {
      window.dispatchEvent(new CustomEvent("smoobuds_item_added"));
    }
  }, [cart.length]);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => 
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1, 
        notes: "", 
        selectedNotes: [] 
      }];
    });
    toast.success(`Added ${item.name} to cart`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => 
      prev.map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    toast.info("Item removed from cart");
  };

  const updateItemNotes = (id: string, customText: string) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes: customText } : item))
    );
  };

  const toggleQuickNote = (id: string, note: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const exists = item.selectedNotes.includes(note);
          const newNotes = exists
            ? item.selectedNotes.filter((n) => n !== note)
            : [...item.selectedNotes, note];
          return { ...item, selectedNotes: newNotes };
        }
        return item;
      })
    );
  };

  const getCompiledNotes = (item: CartItem): string => {
    const parts = [...item.selectedNotes];
    if (item.notes.trim()) {
      parts.push(item.notes.trim());
    }
    return parts.join(", ");
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handlePlaceOrder = async () => {
    console.log("BUTTON_CLICKED");
    if (cart.length === 0 || isOrdering) return;

    setIsOrdering(true);
    const loadingToastId = toast.loading("Submitting order to kitchen...");

    try {
      const itemsPayload = cart.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        notes: getCompiledNotes(item),
      }));

      const promoId = localStorage.getItem("smoobuds_applied_promo_id");
      console.log("CALLING_PLACE_ORDER_FN", { promoId });
      
      // Fetch dynamic single-use nonce for replay protection
      const { nonce } = await getNonceFn();

      const response = await placeOrderFn({
        data: {
          tableNumber: tableNumber!,
          token: token!,
          items: itemsPayload,
          idempotencyKey,
          appliedPromotionId: promoId || undefined,
          nonce,
        },
      });

      if (response.success) {
        toast.dismiss(loadingToastId);
        toast.success(response.isDuplicate ? "Order already placed!" : "Order sent to kitchen!");
        
        const total = getCartTotal();
        setCart([]);
        if (cartLocalStorageKey) {
          localStorage.removeItem(cartLocalStorageKey);
        }
        localStorage.removeItem("smoobuds_applied_promo_id");

        setIdempotencyKey(generateUUID());
        setIsCartOpen(false);

        setPlacedOrder({ id: response.orderId, total: total });

        if (promoId) {
          window.dispatchEvent(new CustomEvent("smoobuds_promotion_used", {
             detail: { promotionId: promoId }
          }));
        }
      }
    } catch (err: any) {
      toast.dismiss(loadingToastId);
      const errorMessage = err?.message || "Something went wrong while placing your order.";
      toast.error(errorMessage, { duration: 6000 });
      console.error("Order submission failure:", err);
      console.error(err);
    } finally {
      setIsOrdering(false);
    }
  };

  const handleTableRequest = async (type: "Call Waiter" | "Request Bill") => {
    const isWaiter = type === "Call Waiter";
    if (isWaiter) setIsCallingWaiter(true);
    else setIsRequestingBill(true);

    const loaderToast = toast.loading(`Sending request: ${type}...`);
    try {
      // Fetch dynamic single-use nonce for replay protection
      const { nonce } = await getNonceFn();

      const response = await submitTableRequestFn({
        data: {
          tableNumber: tableNumber!,
          token: token!,
          requestType: type,
          nonce,
        },
      });
      if (response.success) {
        toast.dismiss(loaderToast);
        toast.success(isWaiter ? "Waiter requested" : "Bill requested");
      }
    } catch (err: any) {
      toast.dismiss(loaderToast);
      toast.error(err?.message || "Failed to process table request.");
    } finally {
      if (isWaiter) setIsCallingWaiter(false);
      else setIsRequestingBill(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-cream text-ink font-body pb-28">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-cream/85 backdrop-blur-xl border-b border-sage/10 px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-1.5 text-sage hover:text-sage-deep transition-colors p-2 -ml-2"
            aria-label="Go back to home"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline text-[0.7rem] uppercase tracking-[0.2em] font-semibold font-display">Home</span>
          </Link>
          
          <span className="font-signature text-2xl md:text-3xl text-gold-gradient absolute left-1/2 -translate-x-1/2">
            Smoobuds
          </span>
          
          {isVerified ? (
            <div className="flex gap-2">
              <button
                disabled={isCallingWaiter}
                onClick={() => handleTableRequest("Call Waiter")}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:px-4 bg-sage/10 text-sage hover:bg-sage/20 border border-sage/20 rounded-full transition-all duration-300 disabled:opacity-50"
                aria-label="Call Waiter"
              >
                <Bell size={18} className={isCallingWaiter ? "animate-bounce" : ""} />
                <span className="hidden sm:inline ml-2 text-[0.65rem] uppercase tracking-wider font-display font-semibold">Waiter</span>
              </button>
              <button
                disabled={isRequestingBill}
                onClick={() => handleTableRequest("Request Bill")}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:px-4 bg-gold/10 text-sage hover:bg-gold/20 border border-gold/20 rounded-full transition-all duration-300 disabled:opacity-50"
                aria-label="Request Bill"
              >
                <Receipt size={18} className={isRequestingBill ? "animate-pulse" : ""} />
                <span className="hidden sm:inline ml-2 text-[0.65rem] uppercase tracking-wider font-display font-semibold">Bill</span>
              </button>
            </div>
          ) : (
            <div className="w-[88px] sm:w-[150px]"></div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 mt-6 md:mt-8">
        {/* Banner */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive-foreground flex items-center gap-3"
            >
              <AlertTriangle size={20} className="flex-shrink-0" />
              <p>
                {error === "invalid-token" && "The scanned table QR code has expired or is invalid. Please contact staff."}
                {error === "rate-limited" && "Too many verification requests. Please wait a moment and try again."}
                {error === "active-session-lock" && "You already have an active dining session."}
                {error === "qr-emergency-disabled" && "Ordering is temporarily disabled. Please scan again later."}
                {error === "lockdown-maintenance" && "Ordering is temporarily disabled due to system security lockdown."}
                {error === "invalid-signature" && "Invalid secure payload signature detected. Re-scan table QR."}
                {error === "legacy-disabled" && "Legacy plain QR scanning is disabled. Please scan a new signed QR code."}
              </p>
            </motion.div>
          )}

          {isVerified ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-[2rem] bg-gradient-sage text-cream p-6 sm:p-8 shadow-luxe mb-6 sm:mb-8"
            >
              <div className="absolute inset-0 bg-radial-glow opacity-40" />
              <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                    Welcome to <br className="sm:hidden" />
                    <span className="font-signature font-normal text-gold text-[1.25em] not-italic">Table {tableNumber}</span>
                  </h1>
                </div>
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-4 w-full sm:w-auto justify-center shadow-inner">
                  <div className="text-right">
                    <p className="text-[0.65rem] uppercase tracking-widest text-gold font-display font-bold">Self-Ordering</p>
                    <p className="text-xs text-cream/90 mt-0.5">Pay at counter</p>
                  </div>
                  <ShoppingBag className="text-gold" size={28} />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-[2rem] border border-sage/15 bg-white/40 backdrop-blur-xl p-8 shadow-soft mb-8 text-center"
            >
              <QrCode className="mx-auto text-sage mb-5 drop-shadow-sm" size={48} />
              <h1 className="font-display text-2xl md:text-3xl font-extrabold text-sage-deep tracking-tight">
                Dine-In Digital Ordering
              </h1>
              <p className="max-w-sm mx-auto text-sm text-sage-deep/80 mt-3 leading-relaxed">
                Scan the QR code available at your table to securely order desserts, mocktails, and shakes directly from your device.
              </p>
              <div className="mt-6 inline-flex items-center justify-center bg-sage/10 text-sage-deep border border-sage/15 rounded-full px-5 py-2.5 text-xs font-display font-bold tracking-widest shadow-sm">
                ✦ Mode Locked
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <MenuPagePromotionBanner />

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8 sticky top-[72px] sm:top-[76px] z-30 bg-cream/95 backdrop-blur-xl py-3 -mx-4 px-4 sm:mx-0 sm:px-0 border-b sm:border-none border-sage/5">
          <div className="relative w-full max-w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/50" size={20} />
            <input
              type="text"
              placeholder="Search handcrafted dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/70 border border-sage/15 rounded-full pl-12 pr-6 py-3.5 text-base placeholder-sage/40 focus:outline-none focus:border-sage focus:bg-white focus:ring-4 focus:ring-sage/5 transition-all duration-300 shadow-sm"
            />
          </div>

          <div className="no-scrollbar flex gap-2.5 overflow-x-auto w-full snap-x snap-mandatory pb-2 -mb-2 px-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`snap-start flex-shrink-0 px-5 py-2.5 min-h-[44px] rounded-full text-[0.75rem] font-display font-bold tracking-wider transition-all duration-300 ${
                  selectedCategory === cat
                    ? "bg-sage text-cream shadow-md scale-105"
                    : "bg-white/60 border border-sage/15 text-sage-deep hover:bg-white hover:border-sage/30"
                }`}
              >
                {cat}
              </button>
            ))}
            {/* spacer for scroll padding */}
            <div className="w-2 flex-shrink-0 snap-start" aria-hidden="true" />
          </div>
        </div>

        {/* Menu Grid */}
        <motion.div layout className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="group relative overflow-hidden rounded-3xl border border-sage/10 bg-white/60 backdrop-blur-md p-4 sm:p-5 transition-all duration-300 hover:bg-white hover:shadow-luxe hover:border-sage/20 flex gap-4 sm:gap-5"
              >
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl bg-sage/5 flex-shrink-0 overflow-hidden relative flex items-center justify-center border border-sage/10">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name} 
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sage/5 to-gold/10">
                      <Sparkles className="text-gold-gradient opacity-60" size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-500" />
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display font-extrabold text-lg text-sage-deep tracking-tight truncate">
                        {item.name}
                      </h3>
                    </div>
                    <span className="font-display font-bold text-sage text-base inline-block mb-1.5 bg-sage/5 px-2 py-0.5 rounded-md">
                      ₹ {item.price}
                    </span>
                    <p className="text-[0.8rem] text-sage-deep/70 line-clamp-2 leading-snug">
                      {item.description || "Freshly handcrafted with select ingredients and premium artisanal details."}
                    </p>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] text-gold font-display font-bold">
                      {item.category}
                    </span>
                    {isVerified ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-sage text-cream hover:bg-sage-deep px-5 py-2.5 min-h-[44px] rounded-full text-[0.7rem] uppercase tracking-widest font-display font-bold shadow-soft transition-all duration-300 active:scale-95"
                        aria-label={`Add ${item.name} to cart`}
                      >
                        Add
                      </button>
                    ) : (
                      <span className="text-[0.65rem] text-sage/40 font-display font-semibold italic bg-sage/5 px-3 py-1.5 rounded-full">
                        Dine-in Only
                      </span>
                    )}
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>

          {filteredItems.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="col-span-full py-24 flex flex-col items-center justify-center text-center"
            >
              <div className="w-20 h-20 bg-sage/5 rounded-full flex items-center justify-center mb-4">
                <Coffee size={32} className="text-sage/40" />
              </div>
              <h3 className="font-display text-xl font-extrabold text-sage-deep mb-2">Nothing found</h3>
              <p className="text-sage-deep/50 text-sm max-w-xs font-medium">
                We couldn't find any culinary creations matching your search. Try another category or term.
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Floating Cart Trigger */}
      <AnimatePresence>
        {isVerified && cart.length > 0 && !isCartOpen && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-40"
          >
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full sm:w-auto flex items-center justify-between sm:justify-center gap-3 bg-sage hover:bg-sage-deep text-cream rounded-full px-6 py-4 min-h-[56px] shadow-luxe font-display font-bold tracking-wider text-sm border border-white/10 transition-transform active:scale-95"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingBag size={20} />
                  <span className="absolute -top-2 -right-2 bg-gold text-sage-deep text-[0.6rem] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <span className="ml-1 uppercase">View Cart</span>
              </div>
              <div className="flex items-center gap-2">
                <span>₹{getCartTotal()}</span>
                <ChevronRight size={18} />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-In Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-cream shadow-2xl flex flex-col border-l border-sage/10"
            >
              <div className="p-5 sm:p-6 border-b border-sage/10 flex items-center justify-between bg-white/40 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center text-sage">
                    <ShoppingBag size={20} />
                  </div>
                  <h2 className="font-display font-extrabold text-xl text-sage-deep">Your Order</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-sage/5 hover:bg-sage/15 text-sage-deep transition-colors"
                  aria-label="Close cart"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-sage-deep/50 py-20">
                    <ShoppingBag size={48} className="opacity-20" />
                    <p className="font-display font-bold">Your cart is empty.</p>
                  </div>
                ) : (
                  <>
                    <CheckoutPromotionBanner />
                    {cart.map((item) => (
                      <div key={item.id} className="bg-white/60 border border-sage/10 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-display font-extrabold text-base text-sage-deep leading-tight mb-1">{item.name}</h4>
                          <p className="text-[0.75rem] text-sage/80 font-bold bg-sage/5 px-2 py-0.5 rounded w-fit">₹{item.price} each</p>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="w-11 h-11 flex items-center justify-center rounded-full text-sage-deep/30 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center bg-white/80 p-2 rounded-2xl border border-sage/5">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-11 h-11 flex items-center justify-center rounded-full text-sage bg-sage/5 hover:bg-sage/15 transition-colors active:scale-95"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={18} />
                          </button>
                          <span className="text-base font-extrabold text-sage-deep min-w-[32px] text-center">
                            {item.quantity}
                          </span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-11 h-11 flex items-center justify-center rounded-full text-sage bg-sage/5 hover:bg-sage/15 transition-colors active:scale-95"
                            aria-label="Increase quantity"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <span className="text-lg font-extrabold text-sage pr-2">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[0.65rem] uppercase tracking-widest text-sage-deep/50 font-bold font-display ml-1">Customization</p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_NOTES.map((n) => {
                            const active = item.selectedNotes.includes(n);
                            return (
                              <button
                                key={n}
                                onClick={() => toggleQuickNote(item.id, n)}
                                className={`px-4 py-2 min-h-[40px] rounded-full text-[0.7rem] font-bold border transition-all active:scale-95 ${
                                  active 
                                    ? "bg-gold/20 border-gold/40 text-sage-deep shadow-sm" 
                                    : "bg-white/50 border-sage/10 text-sage-deep/70 hover:border-sage/30"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          placeholder="Type custom instructions..."
                          value={item.notes}
                          onChange={(e) => updateItemNotes(item.id, e.target.value)}
                          className="w-full bg-white/80 border border-sage/15 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-sage focus:ring-4 focus:ring-sage/5 placeholder-sage/30 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                    ))}
                  </>
                )}
              </div>

              <div className="p-5 sm:p-6 border-t border-sage/10 bg-cream/95 backdrop-blur-md space-y-4 sticky bottom-0 z-10 pb-8 sm:pb-6">
                <div className="flex justify-between items-center font-display text-lg font-extrabold text-sage-deep bg-white/50 p-4 rounded-2xl border border-sage/10">
                  <span>Subtotal</span>
                  <span className="text-2xl text-gold-gradient">₹{getCartTotal()}</span>
                </div>
                <p className="text-[0.7rem] text-sage-deep/60 leading-relaxed text-center px-4 font-medium">
                  Your hand-crafted order will be sent instantly to our kitchen. Payment is collected at the counter.
                </p>
                <button
                  disabled={isOrdering || cart.length === 0}
                  onClick={handlePlaceOrder}
                  className="w-full bg-sage hover:bg-sage-deep text-cream disabled:opacity-50 disabled:cursor-not-allowed font-display font-extrabold tracking-widest text-sm uppercase py-4 min-h-[56px] rounded-full border border-white/10 transition-all shadow-luxe flex items-center justify-center gap-2 active:scale-95"
                >
                  {isOrdering ? (
                    <span className="flex items-center gap-2 animate-pulse">
                      <Clock size={18} /> Sending...
                    </span>
                  ) : (
                    "Place Order Now"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Premium Order Success Modal */}
      <AnimatePresence>
        {placedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            {/* Confetti particles */}
            <ConfettiCelebration />

            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.1 }}
              className="bg-cream border border-gold/20 rounded-[2.5rem] p-8 max-w-md w-full text-center relative overflow-hidden shadow-luxe"
            >
              {/* Radial glow background */}
              <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none" />

              {/* Animated checkmark */}
              <div className="relative flex justify-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
                  className="w-20 h-20 rounded-full bg-sage flex items-center justify-center text-cream shadow-luxe"
                >
                  <motion.svg
                    className="w-10 h-10 stroke-current text-cream"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.polyline
                      points="20 6 9 17 4 12"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: "easeInOut", delay: 0.6 }}
                    />
                  </motion.svg>
                </motion.div>
                
                {/* Glow ring */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                  className="absolute inset-0 w-20 h-20 rounded-full border-4 border-sage/30 mx-auto pointer-events-none"
                />
              </div>

              {/* Success Message */}
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-sage-deep mb-2">
                Order Successfully Placed!
              </h2>
              <p className="text-sm text-sage-deep/70 mb-6">
                Your handcrafted treats are being prepared by our chefs.
              </p>

              {/* Order ID & Details Card */}
              <div className="bg-white/60 border border-sage/10 rounded-2xl p-5 mb-8 text-left space-y-3">
                <div className="flex justify-between items-center border-b border-sage/5 pb-2">
                  <span className="text-[10px] font-display uppercase tracking-widest text-sage/60 font-bold">Order ID</span>
                  <span className="text-xs font-mono font-bold text-sage-deep bg-sage/5 px-2 py-1 rounded">
                    #{placedOrder.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-display uppercase tracking-widest text-sage/60 font-bold">Table Number</span>
                  <span className="text-sm font-bold text-sage-deep">Table {tableNumber}</span>
                </div>
                <div className="flex justify-between items-center border-t border-sage/5 pt-2">
                  <span className="text-[10px] font-display uppercase tracking-widest text-sage/60 font-bold">Total Amount</span>
                  <span className="text-base font-extrabold text-gold-gradient">₹{placedOrder.total}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setPlacedOrder(null)}
                  className="w-full bg-sage hover:bg-sage-deep text-cream font-display font-extrabold tracking-widest text-xs uppercase py-4 rounded-full border border-white/10 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Back to Menu
                </button>
                <p className="text-[9px] text-sage-deep/50 tracking-wider">
                  You can view your active order and its progress in "Your Session Orders" below.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
