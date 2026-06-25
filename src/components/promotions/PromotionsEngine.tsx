import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AnimatePresence } from "framer-motion";
import { Promotion, PromotionDisplay } from "./PromotionDisplay";

interface PromotionsContextType {
  promotions: Promotion[];
  dismissPromotion: (id: string) => void;
  trackClick: (id: string) => void;
}

const PromotionsContext = createContext<PromotionsContextType | null>(null);

export function usePromotions() {
  const context = useContext(PromotionsContext);
  if (!context) {
    throw new Error("usePromotions must be used within a PromotionsProvider");
  }
  return context;
}

// Helper: Generate or retrieve device fingerprint
function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fingerprint = localStorage.getItem("smoobuds_device_fingerprint");
  if (!fingerprint) {
    try {
      fingerprint = crypto.randomUUID();
      localStorage.setItem("smoobuds_device_fingerprint", fingerprint);
    } catch {
      fingerprint = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("smoobuds_device_fingerprint", fingerprint);
    }
  }
  return fingerprint;
}

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [allPromotions, setAllPromotions] = useState<Promotion[]>([]);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [popupQueue, setPopupQueue] = useState<Promotion[]>([]);
  const [activePopup, setActivePopup] = useState<Promotion | null>(null);
  
  // Track scroll position for scroll rule
  const [scrollProgress, setScrollProgress] = useState(0);

  // In-memory handled state to prevent immediate re-trigger on route changes during current page load
  const [sessionHandledPromos, setSessionHandledPromos] = useState<Record<string, boolean>>({});

  // Set visited state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasVisited = localStorage.getItem("smoobuds_visited");
      if (!hasVisited) {
        // We'll mark as visited after 5 seconds of first session
        const timer = setTimeout(() => {
          localStorage.setItem("smoobuds_visited", "true");
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Fetch promotions on mount (or path change to check for fresh state)
  useEffect(() => {
    // Skip checking on admin routes
    if (location.pathname.startsWith("/admin")) return;

    const fetchPromotions = async () => {
      try {
        // Select active promotions
        const { data, error } = await supabase
          .from("promotions")
          .select("*")
          .eq("status", "Active")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data) {
          setAllPromotions(data as Promotion[]);
        }
      } catch (err) {
        console.error("Failed to load promotions:", err);
      }
    };

    fetchPromotions();
  }, [location.pathname]);

  // Evaluate targeting and display rules
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    if (allPromotions.length === 0) {
      setActivePromotions([]);
      setPopupQueue([]);
      return;
    }

    const fingerprint = getDeviceFingerprint();
    const hasVisited = localStorage.getItem("smoobuds_visited") === "true";
    
    // Extract Table/QR contexts
    const searchParams = new URLSearchParams(window.location.search);
    const tableParam = searchParams.get("table");
    const tokenParam = searchParams.get("token");

    if (tableParam) {
      localStorage.setItem("smoobuds_last_table", tableParam);
    }
    const currentTable = tableParam || localStorage.getItem("smoobuds_last_table") || "";

    // Read Cart Items for item targeting
    let cartItems: any[] = [];
    try {
      const cartKey = currentTable ? `smoobuds_cart_table_${currentTable}` : "";
      const savedCart = cartKey ? localStorage.getItem(cartKey) : null;
      if (savedCart) cartItems = JSON.parse(savedCart);
    } catch (e) {
      console.warn("Failed to parse cart for promotions:", e);
    }

    const filtered = allPromotions.filter((promo) => {
      // 1. Frequency Capping
      const dismissed = localStorage.getItem(`smoobuds_promo_dismissed_${promo.id}`);
      if (dismissed === "true") return false;

      // Clicked or handled in this SPA session/context check
      if (sessionHandledPromos[promo.id]) return false;
      if (sessionStorage.getItem(`smoobuds_promo_session_${promo.id}`) === "true") return false;
      if (sessionStorage.getItem(`smoobuds_promo_handled_${promo.id}`) === "true") return false;

      const oncePerDevice = promo.targeting?.oncePerDevice;
      if (oncePerDevice && localStorage.getItem(`smoobuds_promo_shown_${promo.id}`) === "true") {
        return false;
      }

      const oncePerDay = promo.display_rules?.oncePerDay;
      if (oncePerDay) {
        const lastShown = localStorage.getItem(`smoobuds_promo_last_shown_${promo.id}`);
        if (lastShown) {
          const lastDate = new Date(lastShown).toDateString();
          const today = new Date().toDateString();
          if (lastDate === today) return false;
        }
      }

      const oncePerSession = promo.display_rules?.oncePerSession;
      if (oncePerSession) {
        const sessionKey = `smoobuds_promo_session_${promo.id}`;
        if (sessionStorage.getItem(sessionKey) === "true") return false;
      }

      // 2. Audience Targeting
      const audience = promo.targeting?.audience || "everyone";
      if (audience === "first_visit" && hasVisited) return false;
      if (audience === "returning" && !hasVisited) return false;

      // 3. Table / QR code targeting
      const targetedTables = promo.targeting?.tables || [];
      if (targetedTables.length > 0) {
        if (!currentTable || !targetedTables.includes(Number(currentTable))) {
          return false;
        }
      }

      const targetedQrs = promo.targeting?.qrs || [];
      if (targetedQrs.length > 0) {
        if (!tokenParam || !targetedQrs.includes(tokenParam)) {
          return false;
        }
      }

      // 4. Category / Item targeting
      const targetedCategories = promo.targeting?.categories || [];
      if (targetedCategories.length > 0) {
        const hasMatchingCategory = cartItems.some((ci) => targetedCategories.includes(ci.category));
        if (!hasMatchingCategory) return false;
      }

      const targetedItems = promo.targeting?.items || [];
      if (targetedItems.length > 0) {
        const hasMatchingItem = cartItems.some((ci) => targetedItems.includes(ci.id));
        if (!hasMatchingItem) return false;
      }

      return true;
    });

    setActivePromotions(filtered);

    // Queue Popups & Full Screen Promos
    const popups = filtered.filter(
      (promo) => promo.display_type.includes("popup_modal") || promo.display_type.includes("full_screen")
    );
    setPopupQueue(popups);
  }, [allPromotions, location.pathname, sessionHandledPromos]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(progress);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Process Popups triggering conditions: Effect 1 (Non-scroll triggers)
  useEffect(() => {
    if (popupQueue.length === 0 || activePopup) return;

    const nextPromo = popupQueue[0];
    const trigger = nextPromo.display_rules?.trigger || "immediate";
    const delay = Number(nextPromo.display_rules?.delay) || 0;

    // Skip scroll triggers, they are handled by Effect 2
    if (trigger === "scroll") return;

    let timer: NodeJS.Timeout;

    const showPopup = () => {
      setActivePopup(nextPromo);
      setPopupQueue((prev) => prev.slice(1));
      
      // Log View event to database
      trackView(nextPromo.id);

      // Save display states for frequency caps
      localStorage.setItem(`smoobuds_promo_shown_${nextPromo.id}`, "true");
      localStorage.setItem(`smoobuds_promo_last_shown_${nextPromo.id}`, new Date().toISOString());
      
      if (nextPromo.display_rules?.oncePerSession) {
        sessionStorage.setItem(`smoobuds_promo_session_${nextPromo.id}`, "true");
      }
    };

    // Immediately trigger
    if (trigger === "immediate") {
      timer = setTimeout(showPopup, delay * 1000);
    } 
    // After delay
    else if (trigger === "delay") {
      timer = setTimeout(showPopup, (delay || 3) * 1000);
    } 
    // Exit intent trigger
    else if (trigger === "exit_intent") {
      const handleMouseLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) {
          showPopup();
          document.removeEventListener("mouseleave", handleMouseLeave);
        }
      };
      document.addEventListener("mouseleave", handleMouseLeave);
      return () => document.removeEventListener("mouseleave", handleMouseLeave);
    }
    // Cart triggers
    else if (trigger === "cart_open" || trigger === "item_added") {
      const handleCartTrigger = () => {
        showPopup();
        window.removeEventListener(`smoobuds_${trigger}`, handleCartTrigger);
      };
      window.addEventListener(`smoobuds_${trigger}`, handleCartTrigger);
      return () => window.removeEventListener(`smoobuds_${trigger}`, handleCartTrigger);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [popupQueue, activePopup]);

  // Process Popups triggering conditions: Effect 2 (Scroll triggers)
  useEffect(() => {
    if (popupQueue.length === 0 || activePopup) return;

    const nextPromo = popupQueue[0];
    const trigger = nextPromo.display_rules?.trigger || "immediate";

    // Only handle scroll triggers in this effect
    if (trigger !== "scroll") return;

    const showPopup = () => {
      setActivePopup(nextPromo);
      setPopupQueue((prev) => prev.slice(1));
      
      // Log View event to database
      trackView(nextPromo.id);

      // Save display states for frequency caps
      localStorage.setItem(`smoobuds_promo_shown_${nextPromo.id}`, "true");
      localStorage.setItem(`smoobuds_promo_last_shown_${nextPromo.id}`, new Date().toISOString());
      
      if (nextPromo.display_rules?.oncePerSession) {
        sessionStorage.setItem(`smoobuds_promo_session_${nextPromo.id}`, "true");
      }
    };

    const targetScroll = Number(nextPromo.display_rules?.scrollPercent) || 30;
    if (scrollProgress >= targetScroll) {
      showPopup();
    }
  }, [popupQueue, activePopup, scrollProgress]);

  // DB View Tracker
  const trackView = async (promoId: string) => {
    try {
      const fingerprint = getDeviceFingerprint();
      const { data: { session } } = await supabase.auth.getSession();
      
      await supabase.from("promotion_views").insert({
        promotion_id: promoId,
        user_id: session?.user?.id || null,
        device_fingerprint: fingerprint,
      });
    } catch (e) {
      console.warn("View tracking failed:", e);
    }
  };

  // DB Click Tracker
  const trackClick = async (promoId: string) => {
    try {
      const fingerprint = getDeviceFingerprint();
      const { data: { session } } = await supabase.auth.getSession();

      await supabase.from("promotion_clicks").insert({
        promotion_id: promoId,
        user_id: session?.user?.id || null,
        device_fingerprint: fingerprint,
      });
    } catch (e) {
      console.warn("Click tracking failed:", e);
    }
  };

  const dismissPromotion = (id: string) => {
    const isPopup = activePopup?.id === id;
    const promo = isPopup ? activePopup : allPromotions.find((p) => p.id === id);

    if (!promo) return;

    // Always mark as handled locally and in session storage to prevent immediate re-trigger on route changes
    setSessionHandledPromos((prev) => ({ ...prev, [id]: true }));
    sessionStorage.setItem(`smoobuds_promo_handled_${id}`, "true");

    // Apply frequency rules
    const neverShowAgain = promo.display_rules?.neverShowAgainAfterClose;
    const oncePerDevice = promo.targeting?.oncePerDevice;
    const oncePerDay = promo.display_rules?.oncePerDay;
    const oncePerSession = promo.display_rules?.oncePerSession;

    if (oncePerDevice || neverShowAgain) {
      localStorage.setItem(`smoobuds_promo_dismissed_${id}`, "true");
    } else if (oncePerDay) {
      localStorage.setItem(`smoobuds_promo_last_shown_${id}`, new Date().toISOString());
    } else if (oncePerSession) {
      sessionStorage.setItem(`smoobuds_promo_session_${id}`, "true");
    }

    if (isPopup) {
      setActivePopup(null);
    } else {
      setActivePromotions((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleCtaClick = (promo: Promotion) => {
    trackClick(promo.id);
    // Cache clicked promotion so we can link it during checkout order creation
    localStorage.setItem("smoobuds_applied_promo_id", promo.id);
    
    // Always mark as handled locally and in session storage to prevent reopening in the same session
    setSessionHandledPromos((prev) => ({ ...prev, [promo.id]: true }));
    sessionStorage.setItem(`smoobuds_promo_handled_${promo.id}`, "true");

    // Apply frequency rules
    const oncePerDevice = promo.targeting?.oncePerDevice;
    const oncePerDay = promo.display_rules?.oncePerDay;
    const oncePerSession = promo.display_rules?.oncePerSession;
    const neverShowAgain = promo.display_rules?.neverShowAgainAfterClose;

    if (oncePerDevice || neverShowAgain) {
      localStorage.setItem(`smoobuds_promo_dismissed_${promo.id}`, "true");
    } else if (oncePerDay) {
      localStorage.setItem(`smoobuds_promo_last_shown_${promo.id}`, new Date().toISOString());
    } else if (oncePerSession) {
      sessionStorage.setItem(`smoobuds_promo_session_${promo.id}`, "true");
    }

    // Close modal if popup
    if (activePopup?.id === promo.id) {
      setActivePopup(null);
    }

    // Navigate to CTA URL
    if (promo.cta_url) {
      window.location.href = promo.cta_url;
    }
  };

  return (
    <PromotionsContext.Provider value={{ promotions: activePromotions, dismissPromotion, trackClick }}>
      {children}

      {/* Global Modals/Popups */}
      <AnimatePresence>
        {activePopup && (
          <PromotionDisplay
            promotion={activePopup}
            location={activePopup.display_type.includes("popup_modal") ? "popup_modal" : "full_screen"}
            onClose={() => dismissPromotion(activePopup.id)}
            onCtaClick={() => handleCtaClick(activePopup)}
          />
        )}
      </AnimatePresence>

      {/* Sticky Banners & Floating Cards */}
      <AnimatePresence>
        {activePromotions
          .filter((p) => !activePopup || p.id !== activePopup.id)
          .map((promo) => {
            const displays = promo.display_type;
            const shownBanners = [];

            if (displays.includes("top_banner") && location.pathname !== "/admin") {
              shownBanners.push(
                <PromotionDisplay
                  key={`top-${promo.id}`}
                  promotion={promo}
                  location="top_banner"
                  onClose={() => dismissPromotion(promo.id)}
                  onCtaClick={() => handleCtaClick(promo)}
                />
              );
            }
            if (displays.includes("bottom_sticky_banner") && location.pathname !== "/admin") {
              shownBanners.push(
                <PromotionDisplay
                  key={`bottom-${promo.id}`}
                  promotion={promo}
                  location="bottom_sticky_banner"
                  onClose={() => dismissPromotion(promo.id)}
                  onCtaClick={() => handleCtaClick(promo)}
                />
              );
            }
            if (displays.includes("floating_card") && location.pathname !== "/admin") {
              shownBanners.push(
                <PromotionDisplay
                  key={`float-${promo.id}`}
                  promotion={promo}
                  location="floating_card"
                  onClose={() => dismissPromotion(promo.id)}
                  onCtaClick={() => handleCtaClick(promo)}
                />
              );
            }

            return shownBanners;
          })}
      </AnimatePresence>
    </PromotionsContext.Provider>
  );
}

// Specialised Layout Banners: Homepage, Menu and Checkout Banners
export function HomepageHeroPromotionBanner() {
  const { promotions, dismissPromotion, trackClick } = usePromotions();
  const promo = promotions.find((p) => p.display_type.includes("homepage_hero"));

  if (!promo) return null;

  return (
    <div className="my-6 max-w-7xl mx-auto px-4 sm:px-6">
      <PromotionDisplay
        promotion={promo}
        location="homepage_hero"
        onClose={() => dismissPromotion(promo.id)}
        onCtaClick={() => {
          trackClick(promo.id);
          localStorage.setItem("smoobuds_applied_promo_id", promo.id);
          if (promo.cta_url) window.location.href = promo.cta_url;
        }}
      />
    </div>
  );
}

export function MenuPagePromotionBanner() {
  const { promotions, dismissPromotion, trackClick } = usePromotions();
  const promo = promotions.find((p) => p.display_type.includes("menu_banner"));

  if (!promo) return null;

  return (
    <div className="my-6">
      <PromotionDisplay
        promotion={promo}
        location="menu_banner"
        onClose={() => dismissPromotion(promo.id)}
        onCtaClick={() => {
          trackClick(promo.id);
          localStorage.setItem("smoobuds_applied_promo_id", promo.id);
          if (promo.cta_url) window.location.href = promo.cta_url;
        }}
      />
    </div>
  );
}

export function CheckoutPromotionBanner() {
  const { promotions, dismissPromotion, trackClick } = usePromotions();
  const promo = promotions.find((p) => p.display_type.includes("checkout_banner"));

  if (!promo) return null;

  return (
    <div className="my-4">
      <PromotionDisplay
        promotion={promo}
        location="checkout_banner"
        onClose={() => dismissPromotion(promo.id)}
        onCtaClick={() => {
          trackClick(promo.id);
          localStorage.setItem("smoobuds_applied_promo_id", promo.id);
          if (promo.cta_url) window.location.href = promo.cta_url;
        }}
      />
    </div>
  );
}
