import { createFileRoute, Link } from "@tanstack/react-router";
import { useAdmin } from "@/lib/adminContext";
import {
  ShoppingBag,
  ChefHat,
  Bell,
  MenuSquare,
  QrCode,
  BarChart3,
  Settings,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

interface NavCard {
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  badge?: string;
  roles: string[];
}

const NAV_CARDS: NavCard[] = [
  {
    label: "Live Orders",
    description: "Monitor and advance active dine-in tickets in real-time.",
    icon: ShoppingBag,
    href: "/admin/orders/live",
    color: "from-amber-500 to-orange-500",
    badge: "Real-time",
    roles: ["Owner", "Manager", "Staff"],
  },
  {
    label: "Kitchen Board",
    description: "Optimised tablet view for the kitchen prep queue.",
    icon: ChefHat,
    href: "/admin/kitchen",
    color: "from-purple-500 to-violet-600",
    badge: "Chef View",
    roles: ["Owner", "Manager", "Staff"],
  },
  {
    label: "Order History",
    description: "View, filter, and manage all past and present orders.",
    icon: Bell,
    href: "/admin/orders",
    color: "from-blue-500 to-cyan-500",
    roles: ["Owner", "Manager", "Staff"],
  },
  {
    label: "Menu Catalog",
    description: "Add, edit, or remove menu items, prices, and categories.",
    icon: MenuSquare,
    href: "/admin/menu",
    color: "from-teal-500 to-emerald-500",
    roles: ["Owner", "Manager"],
  },
  {
    label: "Tables & QR",
    description: "Manage table layout and regenerate QR access tokens.",
    icon: QrCode,
    href: "/admin/tables",
    color: "from-sage to-sage-deep",
    roles: ["Owner"],
  },
  {
    label: "Analytics",
    description: "Revenue trends, popular items, and peak-hour insights.",
    icon: BarChart3,
    href: "/admin/analytics",
    color: "from-pink-500 to-rose-500",
    badge: "Insights",
    roles: ["Owner", "Manager"],
  },
  {
    label: "Cafe Settings",
    description: "Configure cafe name, hours, tax rate, and appearance.",
    icon: Settings,
    href: "/admin/settings",
    color: "from-slate-500 to-slate-700",
    roles: ["Owner", "Manager"],
  },
];

function AdminDashboard() {
  const { role, userId } = useAdmin();

  const visibleCards = NAV_CARDS.filter(
    (card) => role && card.roles.includes(role)
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-8">
      {/* Welcome Hero */}
      <div className="relative overflow-hidden bg-sage-deep text-cream rounded-3xl p-8 shadow-luxe">
        {/* Background decoration */}
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-gold/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-display uppercase tracking-[0.25em] text-gold font-bold mb-2">
              {greeting}
            </p>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl leading-tight">
              Smoobuds Control Room
            </h1>
            <p className="text-cream/60 text-sm mt-2 max-w-md">
              Manage every aspect of your café from one place. Select a module below to get started.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold backdrop-blur-sm flex items-center gap-2">
              <Users size={14} className="text-gold" />
              <span className="text-cream/80 text-xs uppercase tracking-wider font-display">Role</span>
              <span className="text-gold font-bold capitalize ml-1">{role}</span>
            </div>
            <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-3 text-sm font-semibold backdrop-blur-sm flex items-center gap-2">
              <Clock size={14} className="text-cream/60" />
              <span className="text-cream/80 text-xs">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Routes", value: visibleCards.length.toString(), icon: TrendingUp, sub: "accessible" },
          { label: "Access Level", value: role ?? "—", icon: Users, sub: "current role" },
          { label: "System", value: "Online", icon: Clock, sub: "all systems" },
        ].map(({ label, value, icon: Icon, sub }) => (
          <div
            key={label}
            className="bg-white/60 border border-sage/10 rounded-2xl p-4 backdrop-blur-sm flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-display uppercase tracking-widest text-sage/60 font-semibold">{label}</span>
              <Icon size={14} className="text-sage/40" />
            </div>
            <p className="font-display font-extrabold text-xl text-sage-deep capitalize">{value}</p>
            <p className="text-[10px] text-sage/50">{sub}</p>
          </div>
        ))}
      </div>

      {/* Navigation Cards Grid */}
      <div>
        <h2 className="font-display font-bold text-xs uppercase tracking-[0.2em] text-sage/60 mb-4">
          Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                to={card.href}
                className="group relative bg-white border border-sage/10 rounded-3xl p-6 shadow-soft hover:shadow-luxe transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between gap-4 overflow-hidden"
              >
                {/* Gradient accent strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color} opacity-80 group-hover:opacity-100 transition-opacity`}
                />

                <div className="flex items-start justify-between">
                  <div
                    className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white shadow-soft`}
                  >
                    <Icon size={20} />
                  </div>
                  {card.badge && (
                    <span className="text-[9px] font-display uppercase tracking-widest font-extrabold bg-sage/8 border border-sage/10 text-sage px-2.5 py-1 rounded-full">
                      {card.badge}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-display font-extrabold text-base text-sage-deep mb-1">
                    {card.label}
                  </h3>
                  <p className="text-xs text-sage/65 leading-relaxed">{card.description}</p>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-display uppercase tracking-widest font-bold text-sage group-hover:text-sage-deep transition-colors">
                  Open
                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover:translate-x-1 duration-200"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
