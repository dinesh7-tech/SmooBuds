import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAdmin } from "@/lib/adminContext";
import { supabase } from "@/lib/supabase";
import { 
  savePromotionFn, 
  deletePromotionFn, 
  duplicatePromotionFn, 
  togglePromotionStatusFn, 
  uploadPromotionAssetFn 
} from "@/lib/adminActions";
import { Promotion } from "@/components/promotions/PromotionDisplay";
import { PromotionPreview } from "@/components/promotions/PromotionPreview";
import { 
  Plus, 
  Edit3, 
  Copy, 
  Trash2, 
  Play, 
  Pause, 
  Eye, 
  Calendar, 
  ChevronRight, 
  TrendingUp, 
  BarChart3, 
  MousePointerClick, 
  ShoppingBag, 
  DollarSign, 
  Percent, 
  Upload, 
  Link as LinkIcon, 
  X, 
  Check, 
  AlertCircle,
  HelpCircle,
  Megaphone,
  Smartphone,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/admin/promotions")({
  loader: async () => {
    // 1. Fetch Promotions
    const { data: promotions, error: promoError } = await supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });

    if (promoError) {
      console.error("Failed to load promotions:", promoError);
      return { promotionsList: [] as Promotion[], analyticsData: [] };
    }

    // 2. Fetch Aggregated Daily Analytics for charts
    const { data: analytics, error: analyticsError } = await supabase
      .from("promotion_analytics")
      .select("*")
      .order("date", { ascending: true });

    if (analyticsError) {
      console.error("Failed to load promotion analytics:", analyticsError);
      return { promotionsList: promotions as Promotion[], analyticsData: [] };
    }

    return { 
      promotionsList: promotions as Promotion[], 
      analyticsData: analytics || [] 
    };
  },
  component: AdminPromotionsPage,
});

const DISPLAY_LOCATIONS = [
  { id: "popup_modal", label: "Popup Modal" },
  { id: "top_banner", label: "Top Website Banner" },
  { id: "bottom_sticky_banner", label: "Bottom Sticky Banner" },
  { id: "floating_card", label: "Floating Corner Card" },
  { id: "full_screen", label: "Full Screen Promotion" },
  { id: "homepage_hero", label: "Homepage Hero Banner" },
  { id: "menu_banner", label: "Menu Page Banner" },
  { id: "checkout_banner", label: "Checkout Page Banner" }
];

const ANIMATIONS = ["fade", "zoom", "scale", "slide_up", "slide_down", "bounce", "flip", "rotate", "blur_in", "spring"];
const OFFER_TYPES = [
  { id: "percentage_discount", label: "Percentage Discount" },
  { id: "flat_discount", label: "Flat Discount" },
  { id: "bogo", label: "Buy 1 Get 1 (BOGO)" },
  { id: "free_item", label: "Free Item" },
  { id: "combo_offer", label: "Combo Offer" },
  { id: "happy_hours", label: "Happy Hours" },
  { id: "festival_offer", label: "Festival Offer" },
  { id: "weekend_offer", label: "Weekend Offer" },
  { id: "birthday_offer", label: "Birthday Offer" },
  { id: "coupon_code", label: "Coupon Code" },
  { id: "free_delivery", label: "Free Delivery" },
  { id: "limited_time", label: "Limited Time Offer" },
  { id: "custom", label: "Custom Promotion" }
];

const OCCASIONS = [
  "Diwali Special", "New Year Blast", "Christmas Joy", "Ramzan Treats", "Eid Special", 
  "Independence Day Offer", "Republic Day Offer", "Valentine's Day Deal", "Mother's Day Special", 
  "Father's Day Special", "IPL Season Special", "Weekend Feast", "Happy Hours", "Birthday Special", 
  "Anniversary Special", "Restaurant Custom Event"
];

function AdminPromotionsPage() {
  const router = useRouter();
  const { promotionsList, analyticsData } = Route.useLoaderData();
  const { sessionToken } = useAdmin();

  // Active View Tab: 'list' | 'editor' | 'analytics'
  const [activeTab, setActiveTab] = useState<"list" | "editor" | "analytics">("list");
  
  // Editor form state
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("Order Now");
  const [ctaUrl, setCtaUrl] = useState("/menu");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["popup_modal"]);
  const [animationType, setAnimationType] = useState("fade");
  const [animationDuration, setAnimationDuration] = useState("0.5s");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("IST");
  const [status, setStatus] = useState<Promotion["status"]>("Draft");
  const [offerType, setOfferType] = useState("percentage_discount");

  // Targeting fields
  const [audience, setAudience] = useState("everyone");
  const [oncePerDevice, setOncePerDevice] = useState(false);
  const [oncePerDay, setOncePerDay] = useState(false);
  const [oncePerSession, setOncePerSession] = useState(false);
  const [neverShowAgain, setNeverShowAgain] = useState(true);
  const [triggerCondition, setTriggerCondition] = useState("immediate");
  const [triggerDelay, setTriggerDelay] = useState(0);
  const [scrollPercent, setScrollPercent] = useState(30);

  // Advanced target lists
  const [targetTables, setTargetTables] = useState<number[]>([]);
  const [targetCategories, setTargetCategories] = useState<string[]>([]);
  const [tableInput, setTableInput] = useState("");

  // Loading and helper UI states
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Renders live preview in side panel
  const getLivePromoObject = (): Partial<Promotion> => ({
    title,
    subtitle: subtitle || null,
    description: description || null,
    image_url: imageUrl || null,
    banner_url: bannerUrl || null,
    cta_text: ctaText,
    cta_url: ctaUrl,
    display_type: selectedLocations,
    animation_type: animationType,
    animation_duration: animationDuration,
    offer_type: offerType
  });

  // Open Create Form
  const handleOpenAdd = () => {
    setEditingPromo(null);
    setTitle("");
    setSubtitle("");
    setDescription("");
    setCtaText("Order Now");
    setCtaUrl("/menu");
    setImageUrl("");
    setBannerUrl("");
    setSelectedLocations(["popup_modal"]);
    setAnimationType("fade");
    setAnimationDuration("0.5s");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setTimezone("IST");
    setStatus("Draft");
    setOfferType("percentage_discount");
    
    // Default targeting
    setAudience("everyone");
    setOncePerDevice(false);
    setOncePerDay(false);
    setOncePerSession(false);
    setNeverShowAgain(true);
    setTriggerCondition("immediate");
    setTriggerDelay(0);
    setScrollPercent(30);
    setTargetTables([]);
    setTargetCategories([]);
    setTableInput("");

    setActiveTab("editor");
  };

  // Open Edit Form
  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setSubtitle(promo.subtitle || "");
    setDescription(promo.description || "");
    setCtaText(promo.cta_text);
    setCtaUrl(promo.cta_url);
    setImageUrl(promo.image_url || "");
    setBannerUrl(promo.banner_url || "");
    setSelectedLocations(promo.display_type);
    setAnimationType(promo.animation_type);
    setAnimationDuration(promo.animation_duration);
    setStartDate(promo.start_date || "");
    setEndDate(promo.end_date || "");
    setStartTime(promo.start_time || "");
    setEndTime(promo.end_time || "");
    setTimezone(promo.timezone || "IST");
    setStatus(promo.status);
    setOfferType(promo.offer_type);

    // Parse targeting and display rules
    const targeting = (promo as any).targeting || {};
    setAudience(targeting.audience || "everyone");
    setOncePerDevice(targeting.oncePerDevice || false);
    setTargetTables(targeting.tables || []);
    setTargetCategories(targeting.categories || []);

    const rules = (promo as any).display_rules || {};
    setOncePerDay(rules.oncePerDay || false);
    setOncePerSession(rules.oncePerSession || false);
    setNeverShowAgain(rules.neverShowAgainAfterClose !== false);
    setTriggerCondition(rules.trigger || "immediate");
    setTriggerDelay(rules.delay || 0);
    setScrollPercent(rules.scrollPercent || 30);

    setActiveTab("editor");
  };

  // Save Promotion
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || selectedLocations.length === 0) {
      toast.error("Please fill in the title and select at least one display type.");
      return;
    }

    if (!sessionToken) {
      toast.error("Session token expired. Please re-login.");
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Saving promotion...");

    try {
      const payload = {
        id: editingPromo?.id,
        title,
        subtitle: subtitle || null,
        description: description || null,
        imageUrl: imageUrl || null,
        bannerUrl: bannerUrl || null,
        ctaText,
        ctaUrl,
        displayType: selectedLocations,
        animationType,
        animationDuration,
        startDate: startDate || null,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        timezone,
        targeting: {
          audience,
          oncePerDevice,
          tables: targetTables,
          categories: targetCategories
        },
        displayRules: {
          oncePerDay,
          oncePerSession,
          neverShowAgainAfterClose: neverShowAgain,
          trigger: triggerCondition,
          delay: triggerDelay,
          scrollPercent
        },
        offerType,
        status
      };

      const response = await savePromotionFn({
        data: { payload, token: sessionToken }
      });

      if (response.success) {
        toast.dismiss(toastId);
        toast.success(editingPromo ? "Campaign Updated" : "Campaign Created");
        setActiveTab("list");
        router.invalidate();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to save promotion.");
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Promotion
  const handleDuplicate = async (id: string) => {
    if (!sessionToken) return;
    const toastId = toast.loading("Duplicating campaign...");
    try {
      const response = await duplicatePromotionFn({
        data: { id, token: sessionToken }
      });
      if (response.success) {
        toast.dismiss(toastId);
        toast.success("Campaign duplicated as Draft!");
        router.invalidate();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to duplicate.");
    }
  };

  // Toggle Status (Pause / Resume)
  const handleToggleStatus = async (id: string, currentStatus: Promotion["status"]) => {
    if (!sessionToken) return;
    const newStatus: Promotion["status"] = currentStatus === "Active" ? "Paused" : "Active";
    const toastId = toast.loading(`${newStatus === "Active" ? "Resuming" : "Pausing"} campaign...`);
    try {
      const response = await togglePromotionStatusFn({
        data: { id, status: newStatus, token: sessionToken }
      });
      if (response.success) {
        toast.dismiss(toastId);
        toast.success(`Campaign ${newStatus === "Active" ? "activated" : "paused"}`);
        router.invalidate();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to update status.");
    }
  };

  // Delete Promotion
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this promotion campaign?")) return;
    if (!sessionToken) return;

    const toastId = toast.loading("Deleting promotion...");
    try {
      const response = await deletePromotionFn({
        data: { id, token: sessionToken }
      });
      if (response.success) {
        toast.dismiss(toastId);
        toast.success("Promotion campaign deleted.");
        router.invalidate();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Failed to delete.");
    }
  };

  // Handle Local File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum limit of 5MB.");
      return;
    }

    if (!sessionToken) return;

    const isImage = type === "image";
    if (isImage) setIsUploadingImage(true);
    else setIsUploadingBanner(true);

    const toastId = toast.loading(`Uploading ${type}...`);

    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await uploadPromotionAssetFn({
            data: {
              payload: {
                base64File: base64Data,
                fileName: file.name,
                contentType: file.type
              },
              token: sessionToken
            }
          });

          if (res.success && res.url) {
            toast.dismiss(toastId);
            toast.success(`Uploaded ${type} successfully!`);
            if (isImage) setImageUrl(res.url);
            else setBannerUrl(res.url);
          }
        } catch (err: any) {
          toast.dismiss(toastId);
          toast.error(err.message || "Upload failed.");
        } finally {
          if (isImage) setIsUploadingImage(false);
          else setIsUploadingBanner(false);
        }
      };
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("Failed to read file.");
      if (isImage) setIsUploadingImage(false);
      else setIsUploadingBanner(false);
    }
  };

  // Checkbox/Selection helpers
  const toggleLocation = (locId: string) => {
    setSelectedLocations((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const addTargetTable = () => {
    const num = Number(tableInput.trim());
    if (isNaN(num) || num <= 0) {
      toast.error("Please enter a valid table number.");
      return;
    }
    if (targetTables.includes(num)) return;
    setTargetTables((prev) => [...prev, num].sort((a, b) => a - b));
    setTableInput("");
  };

  const removeTargetTable = (num: number) => {
    setTargetTables((prev) => prev.filter((n) => n !== num));
  };

  const toggleTargetCategory = (cat: string) => {
    setTargetCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Filter campaigns
  const filteredPromos = promotionsList.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.subtitle && p.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "All" || p.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Calculate analytics totals
  const totalViews = analyticsData.reduce((sum: number, r: any) => sum + r.views, 0);
  const totalUniqueViews = analyticsData.reduce((sum: number, r: any) => sum + r.unique_views, 0);
  const totalClicks = analyticsData.reduce((sum: number, r: any) => sum + r.clicks, 0);
  const totalOrders = analyticsData.reduce((sum: number, r: any) => sum + r.orders_count, 0);
  const totalRevenue = analyticsData.reduce((sum: number, r: any) => sum + Number(r.revenue), 0);
  const averageCTR = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
  const averageConvRate = totalUniqueViews > 0 ? (totalOrders / totalUniqueViews) * 100 : 0;

  // Chart data aggregation helper
  const dailyMetrics = analyticsData.map((d: any) => ({
    date: format(new Date(d.date), "dd MMM"),
    Views: d.views,
    Clicks: d.clicks,
    Orders: d.orders_count,
    Revenue: Number(d.revenue)
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 border border-sage/15 rounded-3xl p-6 backdrop-blur-sm shadow-soft">
        <div>
          <span className="bg-sage/10 text-sage-deep text-[0.65rem] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full border border-sage/10">Marketing & Offers</span>
          <h2 className="font-display font-black text-2xl text-sage-deep mt-3">Promotions & Campaigns</h2>
          <p className="text-xs text-sage/75 mt-1">Schedule popup offers, website banners, set audience targeting, and monitor CTR conversions in real time.</p>
        </div>
        
        {activeTab === "list" && (
          <button
            onClick={handleOpenAdd}
            className="bg-sage hover:bg-sage-deep text-cream font-display font-semibold tracking-wider text-xs uppercase px-5 py-3 rounded-full border border-white/10 transition-all shadow-soft flex items-center gap-2 cursor-pointer"
          >
            <Plus size={15} /> Create Campaign
          </button>
        )}

        {activeTab !== "list" && (
          <button
            onClick={() => setActiveTab("list")}
            className="bg-white hover:bg-sage/5 text-sage border border-sage/15 font-display font-semibold tracking-wider text-xs uppercase px-5 py-3 rounded-full transition-all shadow-soft flex items-center gap-2 cursor-pointer"
          >
            Back to List
          </button>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-sage/10 gap-6">
        <button
          onClick={() => setActiveTab("list")}
          className={`pb-3 text-xs uppercase tracking-widest font-display font-bold transition-all border-b-2 cursor-pointer ${activeTab === "list" ? "border-sage text-sage-deep" : "border-transparent text-sage-deep/45 hover:text-sage-deep"}`}
        >
          Active Campaigns ({promotionsList.length})
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 text-xs uppercase tracking-widest font-display font-bold transition-all border-b-2 cursor-pointer ${activeTab === "analytics" ? "border-sage text-sage-deep" : "border-transparent text-sage-deep/45 hover:text-sage-deep"}`}
        >
          Performance Analytics
        </button>
        {activeTab === "editor" && (
          <button
            className="pb-3 text-xs uppercase tracking-widest font-display font-bold border-sage text-sage-deep border-b-2"
            disabled
          >
            {editingPromo ? `Editing: ${title}` : "New Campaign"}
          </button>
        )}
      </div>

      {/* VIEW TAB 1: LIST / MANAGEMENT TABLE */}
      {activeTab === "list" && (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-sage/15 rounded-full pl-6 pr-6 py-2.5 text-xs placeholder-sage/40 focus:outline-none focus:border-sage transition-all shadow-sm"
              />
            </div>

            <div className="flex gap-2 bg-sage/5 p-1 rounded-xl border border-sage/10 overflow-x-auto w-full sm:w-auto">
              {["All", "Active", "Draft", "Paused", "Scheduled", "Expired"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-display font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${statusFilter === st ? "bg-white text-sage-deep shadow-sm" : "text-sage-deep/50 hover:text-sage-deep"}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Table Grid */}
          <div className="bg-white border border-sage/15 rounded-3xl shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sage/5 border-b border-sage/10 text-sage font-display uppercase tracking-wider text-[10px]">
                    <th className="p-4 pl-6 font-extrabold">Campaign details</th>
                    <th className="p-4 font-extrabold">Display locations</th>
                    <th className="p-4 font-extrabold text-center">Status</th>
                    <th className="p-4 font-extrabold">Schedule</th>
                    <th className="p-4 font-extrabold text-right">Views</th>
                    <th className="p-4 font-extrabold text-right">Clicks</th>
                    <th className="p-4 font-extrabold text-right">Revenue</th>
                    <th className="p-4 pr-6 font-extrabold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage/10">
                  {filteredPromos.map((promo) => {
                    const stats = analyticsData.filter((r: any) => r.promotion_id === promo.id);
                    const views = stats.reduce((sum: number, r: any) => sum + r.views, 0);
                    const clicks = stats.reduce((sum: number, r: any) => sum + r.clicks, 0);
                    const revenue = stats.reduce((sum: number, r: any) => sum + Number(r.revenue), 0);
                    
                    return (
                      <tr key={promo.id} className="hover:bg-sage/2 transition-colors">
                        {/* Info / Image */}
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-16 bg-sage/5 rounded-lg border border-sage/10 flex-shrink-0 overflow-hidden relative flex items-center justify-center">
                              {promo.image_url || promo.banner_url ? (
                                <img
                                  src={promo.image_url || promo.banner_url || ""}
                                  alt={promo.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Megaphone className="text-gold opacity-55 animate-pulse" size={16} />
                              )}
                            </div>
                            <div>
                              <p className="font-display font-extrabold text-sage-deep text-sm leading-tight">
                                {promo.title}
                              </p>
                              {promo.subtitle && (
                                <p className="text-[10px] text-gold font-bold mt-0.5">{promo.subtitle}</p>
                              )}
                              <span className="text-[9px] uppercase font-bold tracking-wider text-sage-deep/45 mt-1 block">
                                {promo.offer_type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Display Locations */}
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {promo.display_type.map((type) => (
                              <span
                                key={type}
                                className="bg-sage/5 border border-sage/10 text-sage-deep text-[9px] px-2 py-0.5 rounded-full font-semibold"
                              >
                                {type.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="p-4 text-center">
                          <span
                            className={`text-[9px] uppercase font-display font-black tracking-widest px-3 py-1 rounded-full ${
                              promo.status === "Active" ? "bg-emerald-100 text-emerald-800" :
                              promo.status === "Draft" ? "bg-amber-100 text-amber-800" :
                              promo.status === "Paused" ? "bg-rose-100 text-rose-800" :
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {promo.status}
                          </span>
                        </td>

                        {/* Schedule Dates */}
                        <td className="p-4">
                          <div className="space-y-0.5 text-sage-deep/70">
                            <p className="font-semibold flex items-center gap-1">
                              <Calendar size={12} className="text-gold" />
                              {promo.start_date ? promo.start_date : "Immediate"}
                            </p>
                            {promo.end_date && (
                              <p className="text-[10px] text-sage-deep/50 pl-4">to {promo.end_date}</p>
                            )}
                          </div>
                        </td>

                        {/* Stats Columns */}
                        <td className="p-4 text-right font-bold text-sage-deep">{views}</td>
                        <td className="p-4 text-right font-bold text-sage-deep">{clicks}</td>
                        <td className="p-4 text-right font-display font-extrabold text-gold">₹{revenue.toLocaleString()}</td>

                        {/* Actions */}
                        <td className="p-4 pr-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Toggle Pause/Resume */}
                            {promo.status === "Active" ? (
                              <button
                                onClick={() => handleToggleStatus(promo.id, "Active")}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Pause Campaign"
                              >
                                <Pause size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(promo.id, promo.status)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Resume Campaign"
                              >
                                <Play size={14} />
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              onClick={() => handleOpenEdit(promo)}
                              className="p-2 text-sage hover:bg-sage/5 rounded-lg transition-colors cursor-pointer"
                              title="Edit details"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* Duplicate */}
                            <button
                              onClick={() => handleDuplicate(promo.id)}
                              className="p-2 text-gold hover:bg-gold/5 rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Campaign"
                            >
                              <Copy size={14} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(promo.id)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Campaign"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredPromos.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-20 text-center text-sage/40 font-display">
                        No promotional campaigns found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: MULTI-STEP CREATION & EDIT EDITOR WITH SPLIT-SCREEN PREVIEW */}
      {activeTab === "editor" && (
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Edit Form (Left column) */}
          <form onSubmit={handleSave} className="lg:col-span-7 bg-white border border-sage/15 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-soft text-xs">
            <div className="border-b border-sage/10 pb-4 flex justify-between items-center">
              <div>
                <h3 className="font-display font-extrabold text-lg text-sage-deep">
                  {editingPromo ? "Modify Promotional Campaign" : "Design New Campaign"}
                </h3>
                <p className="text-[10px] text-sage/60 mt-0.5">Customize layouts, targeting limits, offer rules, and visual settings.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="bg-white border border-sage/10 rounded-xl px-3 py-2 text-xs text-sage-deep font-semibold focus:outline-none"
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Expired">Expired</option>
                  <option value="Archived">Archived</option>
                </select>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-sage hover:bg-sage-deep text-cream px-5 py-2.5 rounded-xl font-display font-bold uppercase tracking-wider transition-colors shadow-soft cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : <><Check size={14} /> Save</>}
                </button>
              </div>
            </div>

            {/* Step 1: Basic details */}
            <div className="space-y-4">
              <h4 className="font-display font-extrabold text-xs uppercase tracking-widest text-gold border-b border-sage/5 pb-1">1. Basic Details</h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Campaign Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Weekend Special Feast"
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Subtitle / Badge</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. FLAT 20% OFF"
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Body Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Body copy displayed inside popups or banners..."
                  rows={3}
                  className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="Order Now"
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">CTA Redirect URL</label>
                  <input
                    type="text"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="/menu"
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Image Management */}
            <div className="space-y-4">
              <h4 className="font-display font-extrabold text-xs uppercase tracking-widest text-gold border-b border-sage/5 pb-1">2. Images & Banners</h4>
              
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Popup/Modal Image */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block">Popup Card Image</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste Image URL..."
                      className="flex-1 bg-white border border-sage/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-sage text-[11px] transition-all"
                    />
                    <label className="bg-sage/10 text-sage hover:bg-sage/20 border border-sage/15 p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center flex-shrink-0">
                      <Upload size={14} />
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingImage}
                        onChange={(e) => handleFileUpload(e, "image")}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-[9px] text-sage-deep/50">Supports JPG, PNG, WEBP (Max 5MB). Renders inside dialog cards.</p>
                </div>

                {/* Banner Image */}
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block">Inline Banner Image</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      placeholder="Paste Image URL..."
                      className="flex-1 bg-white border border-sage/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-sage text-[11px] transition-all"
                    />
                    <label className="bg-sage/10 text-sage hover:bg-sage/20 border border-sage/15 p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center flex-shrink-0">
                      <Upload size={14} />
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingBanner}
                        onChange={(e) => handleFileUpload(e, "banner")}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-[9px] text-sage-deep/50">Supports JPG, PNG, WEBP (Max 5MB). Renders inside page banners.</p>
                </div>
              </div>
            </div>

            {/* Step 3: Location & Animations */}
            <div className="space-y-4">
              <h4 className="font-display font-extrabold text-xs uppercase tracking-widest text-gold border-b border-sage/5 pb-1">3. Display Locations & Animations</h4>
              
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Locations Checklist */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-2">Select Display locations</label>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto bg-sage/5 p-3 rounded-2xl border border-sage/10">
                    {DISPLAY_LOCATIONS.map((loc) => {
                      const active = selectedLocations.includes(loc.id);
                      return (
                        <label key={loc.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleLocation(loc.id)}
                            className="rounded border-sage/20 text-sage focus:ring-sage"
                          />
                          <span className={`text-[11px] font-semibold ${active ? "text-sage-deep font-bold" : "text-sage-deep/60"}`}>
                            {loc.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Animation Config */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Entrance Animation</label>
                    <select
                      value={animationType}
                      onChange={(e) => setAnimationType(e.target.value)}
                      className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-semibold capitalize"
                    >
                      {ANIMATIONS.map((anim) => (
                        <option key={anim} value={anim}>{anim.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Animation Duration</label>
                    <select
                      value={animationDuration}
                      onChange={(e) => setAnimationDuration(e.target.value)}
                      className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-semibold"
                    >
                      <option value="0.3s">0.3 seconds</option>
                      <option value="0.5s">0.5 seconds</option>
                      <option value="1s">1.0 second</option>
                      <option value="1.5s">1.5 seconds</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Scheduling & Timezone */}
            <div className="space-y-4">
              <h4 className="font-display font-extrabold text-xs uppercase tracking-widest text-gold border-b border-sage/5 pb-1">4. Scheduling & Timezones</h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="IST"
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Step 5: Advanced Targeting & Display Rules */}
            <div className="space-y-4">
              <h4 className="font-display font-extrabold text-xs uppercase tracking-widest text-gold border-b border-sage/5 pb-1">5. Targeting & Display Rules</h4>
              
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Targeting filters */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Target Audience</label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-semibold"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="first_visit">First Visit Only</option>
                      <option value="returning">Returning Customers Only</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={oncePerDevice}
                        onChange={(e) => setOncePerDevice(e.target.checked)}
                        className="rounded border-sage/20 text-sage focus:ring-sage"
                      />
                      <span className="text-[11px] font-semibold text-sage-deep/80">Limit to once per device</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={oncePerDay}
                        onChange={(e) => setOncePerDay(e.target.checked)}
                        className="rounded border-sage/20 text-sage focus:ring-sage"
                      />
                      <span className="text-[11px] font-semibold text-sage-deep/80">Only show once per day</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={oncePerSession}
                        onChange={(e) => setOncePerSession(e.target.checked)}
                        className="rounded border-sage/20 text-sage focus:ring-sage"
                      />
                      <span className="text-[11px] font-semibold text-sage-deep/80">Only show once per session</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={neverShowAgain}
                        onChange={(e) => setNeverShowAgain(e.target.checked)}
                        className="rounded border-sage/20 text-sage focus:ring-sage"
                      />
                      <span className="text-[11px] font-semibold text-sage-deep/80">Never show again after manual closing</span>
                    </label>
                  </div>
                </div>

                {/* Display Trigger Conditions */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Trigger Popup</label>
                    <select
                      value={triggerCondition}
                      onChange={(e) => setTriggerCondition(e.target.value)}
                      className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-semibold"
                    >
                      <option value="immediate">Immediately</option>
                      <option value="delay">After custom delay (seconds)</option>
                      <option value="scroll">After scrolling page (%)</option>
                      <option value="exit_intent">On Exit Intent</option>
                      <option value="cart_open">After Cart Opens</option>
                      <option value="item_added">After First Item Added to Cart</option>
                    </select>
                  </div>

                  {triggerCondition === "delay" && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Trigger Delay (Seconds)</label>
                      <input
                        type="number"
                        min="1"
                        value={triggerDelay}
                        onChange={(e) => setTriggerDelay(Number(e.target.value))}
                        className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                      />
                    </div>
                  )}

                  {triggerCondition === "scroll" && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Scroll Percentage (%)</label>
                      <input
                        type="number"
                        min="5"
                        max="95"
                        value={scrollPercent}
                        onChange={(e) => setScrollPercent(Number(e.target.value))}
                        className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage transition-all font-semibold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Targeting (Tables / Categories) */}
              <div className="grid sm:grid-cols-2 gap-6 pt-2 border-t border-sage/5">
                {/* Specific Tables */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block">Target Specific Tables</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 5"
                      value={tableInput}
                      onChange={(e) => setTableInput(e.target.value)}
                      className="flex-1 bg-white border border-sage/10 rounded-xl px-3 py-2 focus:outline-none focus:border-sage"
                    />
                    <button
                      type="button"
                      onClick={addTargetTable}
                      className="bg-sage text-cream px-3 py-2 rounded-xl font-bold cursor-pointer hover:bg-sage-deep"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1 bg-sage/5 p-2 rounded-xl border border-sage/10 min-h-[40px]">
                    {targetTables.map((t) => (
                      <span
                        key={t}
                        onClick={() => removeTargetTable(t)}
                        className="bg-white border border-sage/15 text-sage-deep text-[10px] px-2 py-0.5 rounded-md font-bold cursor-pointer hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1"
                      >
                        Table {t} <X size={10} />
                      </span>
                    ))}
                    {targetTables.length === 0 && (
                      <span className="text-[10px] text-sage/40 font-semibold italic p-1">All tables targeted.</span>
                    )}
                  </div>
                </div>

                {/* Specific Categories */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block">Target Menu Categories</label>
                  <div className="flex flex-wrap gap-1.5 bg-sage/5 p-2 rounded-xl border border-sage/10 min-h-[82px] max-h-[120px] overflow-y-auto">
                    {["Coffee", "Mocktails", "Shakes", "Starters", "Main Course", "Desserts"].map((cat) => {
                      const active = targetCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleTargetCategory(cat)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${active ? "bg-sage text-cream border-sage" : "bg-white border-sage/10 text-sage-deep hover:border-sage/35"}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 6: Offer details */}
            <div className="space-y-4">
              <h4 className="font-display font-extrabold text-xs uppercase tracking-widest text-gold border-b border-sage/5 pb-1">6. Offer Configuration</h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Offer Type Classification</label>
                  <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value)}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-semibold capitalize"
                  >
                    {OFFER_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-sage font-display font-bold block mb-1">Select Occasion Template</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setTitle(`🎉 ${e.target.value} Offer`);
                        setSubtitle(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-sage/10 rounded-xl px-4 py-3 focus:outline-none focus:border-sage focus:bg-white transition-all font-semibold"
                  >
                    <option value="">Custom Occasion Template...</option>
                    {OCCASIONS.map((occ) => (
                      <option key={occ} value={occ}>{occ}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </form>

          {/* Sandbox Live Preview (Right column) */}
          <div className="lg:col-span-5 lg:sticky lg:top-[90px] h-[calc(100vh-140px)] min-h-[600px]">
            <PromotionPreview promotion={getLivePromoObject()} />
          </div>
        </div>
      )}

      {/* VIEW TAB 3: MARKETING PERFORMANCE ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="space-y-8">
          {/* KPI Analytics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
            <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft hover:shadow-md transition-shadow">
              <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Total Impressions</p>
              <p className="font-display font-black text-2xl text-sage-deep">{totalViews}</p>
              <p className="text-[9px] text-sage-deep/50 mt-1 font-semibold">Total banner/popup displays</p>
            </div>
            
            <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft hover:shadow-md transition-shadow">
              <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Unique Views</p>
              <p className="font-display font-black text-2xl text-sage-deep">{totalUniqueViews}</p>
              <p className="text-[9px] text-sage-deep/50 mt-1 font-semibold">Unique device impressions</p>
            </div>

            <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft hover:shadow-md transition-shadow">
              <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">CTA Clicks</p>
              <p className="font-display font-black text-2xl text-sage-deep">{totalClicks}</p>
              <p className="text-[9px] text-sage-deep/50 mt-1 font-semibold">Total button interactions</p>
            </div>

            <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft hover:shadow-md transition-shadow">
              <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Click Through Rate (CTR)</p>
              <p className="font-display font-black text-2xl text-sage-deep">{averageCTR.toFixed(1)}%</p>
              <p className="text-[9px] text-sage-deep/50 mt-1 font-semibold">Average conversion from view</p>
            </div>

            <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft hover:shadow-md transition-shadow">
              <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Orders Generated</p>
              <p className="font-display font-black text-2xl text-emerald-600">{totalOrders}</p>
              <p className="text-[9px] text-sage-deep/50 mt-1 font-semibold">Paid checkout orders linked</p>
            </div>

            <div className="bg-white border border-sage/15 rounded-3xl p-5 shadow-soft hover:shadow-md transition-shadow">
              <p className="text-[10px] text-sage/60 uppercase tracking-widest font-bold mb-2">Campaign Revenue</p>
              <p className="font-display font-black text-2xl text-gold-gradient">₹{totalRevenue.toLocaleString()}</p>
              <p className="text-[9px] text-sage-deep/50 mt-1 font-semibold">Total revenue generated</p>
            </div>
          </div>

          {/* Time Series Performance Graphs */}
          <div className="grid lg:grid-cols-2 gap-6">
            
            {/* Impressions & Clicks Area Chart */}
            <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep">Daily CTR Engagement</h3>
                  <p className="text-[10px] text-sage/60 font-medium">Daily views versus total CTA button clicks.</p>
                </div>
                <TrendingUp size={16} className="text-gold" />
              </div>
              
              <div className="flex-1 min-h-0">
                {dailyMetrics.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyMetrics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4A5D23" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4A5D23" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="Views" stroke="#4A5D23" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" name="Views" />
                      <Area type="monotone" dataKey="Clicks" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" name="Clicks" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-sage/40">No analytics data recorded for active campaigns yet.</div>
                )}
              </div>
            </div>

            {/* Revenue Contribution Bar Chart */}
            <div className="bg-white border border-sage/15 rounded-3xl p-6 shadow-soft h-[360px] flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-sm uppercase tracking-widest text-sage-deep">Campaign Revenue Contribution</h3>
                  <p className="text-[10px] text-sage/60 font-medium">Daily order count and total checkout amount generated.</p>
                </div>
                <ShoppingBag size={16} className="text-sage" />
              </div>
              
              <div className="flex-1 min-h-0">
                {dailyMetrics.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyMetrics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#6B7280' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="Revenue" fill="#8FA971" radius={[4, 4, 0, 0]} maxBarSize={30} name="Revenue (INR)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-sage/40">No analytics data recorded for active campaigns yet.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
