import { createFileRoute, Outlet, useNavigate, useLocation, Link, redirect } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Bell, 
  Receipt, 
  ShoppingBag, 
  Menu as MenuIcon, 
  QrCode, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  Volume2, 
  VolumeX,
  ChefHat,
  Shield,
  Menu,
  X,
  Megaphone
} from "lucide-react";
import { toast } from "sonner";
import { AdminContext } from "../lib/adminContext";
import type { AdminContextType } from "../lib/adminContext";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: "/admin/login",
      });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginPage = location.pathname === "/admin/login";

  // Auth & Role states
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"Owner" | "Manager" | "Staff" | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Notifications and Sound
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sound alert player
  const playAlert = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Simple synthesizer sound for alerts
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      // Double beep
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (err) {
      console.warn("Audio Context failed to initialize:", err);
    }
  };

  // 1. Listen for Auth Changes
  useEffect(() => {
    // Get initial session
    console.log("[ADMIN_AUTH] getSession() called");
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log("[ADMIN_AUTH] Session found, setting token");
        setUserId(session.user.id);
        setSessionToken(session.access_token);
        fetchUserRole(session.user.id);
      } else {
        console.log("[ADMIN_AUTH] No session, setting loading=false");
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUserId(session.user.id);
        setSessionToken(session.access_token);
        fetchUserRole(session.user.id);
      } else {
        setUserId(null);
        setRole(null);
        setSessionToken(null);
        setLoading(false);
        if (!isLoginPage) {
          navigate({ to: "/admin/login" });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isLoginPage]);

  // 2. Fetch User Role from database
  const fetchUserRole = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRole(data.role as "Owner" | "Manager" | "Staff");
      } else {
        // Fallback for first admin setup (If no roles table row exists, default to Staff so they aren't locked out of orders)
        // In production, the DB admin pre-configures this, but this is user-friendly for dev
        setRole("Staff");
      }
    } catch (err) {
      console.error("Failed to fetch user role:", err);
      setRole("Staff");
    } finally {
      console.log("[ADMIN_AUTH] LOADING_FALSE — auth fully resolved");
      setLoading(false);
    }
  };

  // 3. Load active requests (Waiter calls, Bill requests)
  useEffect(() => {
    if (!userId || isLoginPage) return;

    const loadRequests = async () => {
      const { data } = await supabase
        .from("table_requests")
        .select("*")
        .eq("status", "Pending")
        .order("created_at", { ascending: false });
      if (data) {
        setActiveRequests(data);
        setPendingRequestsCount(data.length);
      }
    };
    loadRequests();

    // Subscribe to new requests & new orders in real-time
    const requestChannel = supabase
      .channel("admin_dashboard_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "table_requests" },
        (payload) => {
          setActiveRequests((prev) => [payload.new, ...prev]);
          setPendingRequestsCount((c) => c + 1);
          playAlert();
          toast.info(`Table ${payload.new.table_number}: ${payload.new.request_type} requested!`);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          playAlert();
          toast.success(`New order placed! Table ${payload.new.table_number} (₹${payload.new.total_amount})`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestChannel);
    };
  }, [userId, isLoginPage, soundEnabled]);

  // Resolve Table Request
  const resolveRequest = async (id: string) => {
    const { error } = await supabase
      .from("table_requests")
      .update({ status: "Completed" })
      .eq("id", id);

    if (!error) {
      setActiveRequests((prev) => prev.filter((r) => r.id !== id));
      setPendingRequestsCount((c) => Math.max(0, c - 1));
      toast.success("Request marked as completed");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Successfully logged out");
    navigate({ to: "/admin/login" });
  };

  // If on login route, render sub-component without sidebar layout
  // Always mount AdminContext.Provider so useAdmin() never throws in children
  if (isLoginPage) {
    return (
      <AdminContext.Provider value={{ userId, role, sessionToken, authLoading: loading, soundEnabled, setSoundEnabled, pendingRequestsCount }}>
        {loading ? (
          <div className="min-h-screen bg-cream flex flex-col items-center justify-center text-sage">
            <ChefHat className="animate-spin mb-4" size={40} />
            <p className="font-display text-xs uppercase tracking-widest font-semibold">Verifying credentials...</p>
          </div>
        ) : (
          <Outlet />
        )}
      </AdminContext.Provider>
    );
  }


  // Define Nav links based on Role
  const navLinks = [
    { label: "Live Orders", icon: ShoppingBag, href: "/admin/orders/live", roles: ["Owner", "Manager", "Staff"] },
    { label: "Order History", icon: Bell, href: "/admin/orders", roles: ["Owner", "Manager", "Staff"] },
    { label: "Kitchen Board", icon: ChefHat, href: "/admin/kitchen", roles: ["Owner", "Manager", "Staff"] },
    { label: "Menu Catalog", icon: MenuIcon, href: "/admin/menu", roles: ["Owner", "Manager"] },
    { label: "Tables & QR", icon: QrCode, href: "/admin/tables", roles: ["Owner"] },
    { label: "Analytics", icon: BarChart3, href: "/admin/analytics", roles: ["Owner", "Manager"] },
    { label: "Promotions", icon: Megaphone, href: "/admin/promotions", roles: ["Owner", "Manager"] },
    { label: "Cafe Settings", icon: SettingsIcon, href: "/admin/settings", roles: ["Owner", "Manager"] },
  ];

  return (
    <AdminContext.Provider value={{ userId, role, sessionToken, authLoading: loading, soundEnabled, setSoundEnabled, pendingRequestsCount }}>
      <div className="min-h-screen bg-cream text-ink font-body flex">
        {/* Sidebar Container */}
        <aside 
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-sage-deep text-cream border-r border-white/5 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 lg:static lg:flex-shrink-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            {/* Sidebar Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChefHat className="text-gold" size={24} />
                <span className="font-signature text-2xl text-gold-gradient">Smoobuds</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-cream/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Admin Badge */}
            <div className="px-6 py-4 border-b border-white/5 bg-black/10 flex items-center gap-3">
              <Shield size={16} className="text-gold" />
              <div>
                <p className="text-[0.65rem] uppercase tracking-wider text-gold font-display font-bold">Role Access</p>
                <p className="text-xs text-cream/80 font-medium capitalize mt-0.5">{role}</p>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="p-4 space-y-1">
              {navLinks.map((link) => {
                const hasPermission = role && link.roles.includes(role);
                if (!hasPermission) return null;

                const LinkIcon = link.icon;
                const active = location.pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs uppercase tracking-wider font-display font-semibold transition-all ${
                      active 
                        ? "bg-gold text-sage-deep shadow-soft" 
                        : "text-cream/75 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <LinkIcon size={16} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer (Sound, Logout) */}
          <div className="p-4 border-t border-white/5 space-y-2 bg-black/10">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-display uppercase tracking-widest text-cream/70 hover:text-white hover:bg-white/5 transition-all"
            >
              <span className="flex items-center gap-2">
                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                Audio Alerts
              </span>
              <span className="text-[10px] text-gold">{soundEnabled ? "ON" : "OFF"}</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-display uppercase tracking-widest text-destructive-foreground hover:bg-destructive/10 transition-all cursor-pointer"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Header */}
          <header className="bg-cream/80 backdrop-blur-md border-b border-sage/10 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden rounded-full p-2 hover:bg-sage/10 text-sage-deep"
              >
                <MenuIcon size={20} />
              </button>
              <h1 className="font-display font-extrabold text-xl text-sage-deep">
                Admin Control Room
              </h1>
            </div>

            {/* Waiter Request Center */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="flex items-center gap-2 bg-white/60 border border-sage/15 rounded-full px-4 py-2 text-xs font-semibold hover:bg-white transition-all shadow-soft"
              >
                <Bell size={14} className={pendingRequestsCount > 0 ? "text-amber-600 animate-swing" : "text-sage"} />
                Requests
                {pendingRequestsCount > 0 && (
                  <span className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-[9px] font-bold">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-sage/15 shadow-luxe z-50 p-4 max-h-[360px] overflow-y-auto"
                    >
                      <h3 className="font-display font-bold text-xs uppercase text-sage-deep border-b border-sage/5 pb-2 mb-3">
                        Dine-In Customer Assistance
                      </h3>
                      <div className="space-y-3">
                        {activeRequests.map((req) => (
                          <div 
                            key={req.id} 
                            className="bg-cream/40 border border-sage/5 rounded-xl p-3 flex justify-between items-start gap-2"
                          >
                            <div className="text-xs">
                              <p className="font-bold text-sage-deep">Table {req.table_number}</p>
                              <p className="text-sage mt-1 font-semibold flex items-center gap-1">
                                {req.request_type === "Call Waiter" ? <Bell size={12} /> : <Receipt size={12} />}
                                {req.request_type}
                              </p>
                              <span className="text-[10px] text-sage-deep/50 block mt-1">
                                {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <button
                              onClick={() => resolveRequest(req.id)}
                              className="bg-sage text-cream hover:bg-sage-deep text-[9px] uppercase tracking-wider font-display font-bold px-2 py-1 rounded-md transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        ))}
                        {activeRequests.length === 0 && (
                          <p className="text-center py-6 text-xs text-sage/50 font-medium">
                            No pending requests. Table service is quiet.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>

          {/* Sub-page Outlet */}
          <div className="p-6 max-w-7xl w-full mx-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
