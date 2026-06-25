import { useState } from "react";
import { Monitor, Tablet, Smartphone, Eye } from "lucide-react";
import { Promotion, PromotionDisplay } from "./PromotionDisplay";

interface PromotionPreviewProps {
  promotion: Partial<Promotion>;
}

export function PromotionPreview({ promotion }: PromotionPreviewProps) {
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("mobile");
  
  // Locations in the promotion we can preview
  const displayTypes = promotion.display_type || ["popup_modal"];
  const [selectedPreviewType, setSelectedPreviewType] = useState<string>(
    displayTypes[0] || "popup_modal"
  );

  // Fallback default promotion object
  const previewPromo: Promotion = {
    id: "preview-id",
    title: promotion.title || "🎉 Special Offer Title",
    subtitle: promotion.subtitle || "Flat 20% OFF",
    description: promotion.description || "Indulge in our premium handcrafted desserts. Valid for dine-in orders only.",
    image_url: promotion.image_url || null,
    banner_url: promotion.banner_url || null,
    cta_text: promotion.cta_text || "Order Now",
    cta_url: promotion.cta_url || "/menu",
    display_type: displayTypes,
    animation_type: promotion.animation_type || "fade",
    animation_duration: promotion.animation_duration || "0.5s",
    offer_type: promotion.offer_type || "percentage_discount"
  };

  // Adjust preview display when promo display types change
  const currentPreviewType = displayTypes.includes(selectedPreviewType)
    ? selectedPreviewType
    : displayTypes[0] || "popup_modal";

  // Dimensions of viewport frames
  const getDeviceWidth = () => {
    switch (device) {
      case "desktop":
        return "w-full max-w-[1024px]";
      case "tablet":
        return "w-[768px]";
      case "mobile":
      default:
        return "w-[390px]";
    }
  };

  const getDeviceHeight = () => {
    switch (device) {
      case "desktop":
        return "h-[500px]";
      case "tablet":
        return "h-[550px]";
      case "mobile":
      default:
        return "h-[640px]";
    }
  };

  return (
    <div className="bg-white/40 border border-sage/15 rounded-[2rem] p-6 backdrop-blur-sm flex flex-col items-center justify-between gap-6 h-full min-h-[500px]">
      
      {/* Preview Controls Header */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-sage/10">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-gold" />
          <h4 className="font-display font-extrabold text-sm text-sage-deep uppercase tracking-wider">Live Preview Simulator</h4>
        </div>

        <div className="flex items-center gap-3">
          {/* Device selectors */}
          <div className="flex bg-sage/5 p-1 rounded-xl border border-sage/10">
            <button
              onClick={() => setDevice("desktop")}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${device === "desktop" ? "bg-white text-sage shadow-sm" : "text-sage-deep/50 hover:text-sage-deep"}`}
              title="Desktop View"
            >
              <Monitor size={15} />
            </button>
            <button
              onClick={() => setDevice("tablet")}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${device === "tablet" ? "bg-white text-sage shadow-sm" : "text-sage-deep/50 hover:text-sage-deep"}`}
              title="Tablet View"
            >
              <Tablet size={15} />
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${device === "mobile" ? "bg-white text-sage shadow-sm" : "text-sage-deep/50 hover:text-sage-deep"}`}
              title="Mobile View"
            >
              <Smartphone size={15} />
            </button>
          </div>

          {/* Location Selectors */}
          {displayTypes.length > 1 && (
            <select
              value={selectedPreviewType}
              onChange={(e) => setSelectedPreviewType(e.target.value)}
              className="bg-white border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-sage-deep font-semibold focus:outline-none focus:border-sage transition-all"
            >
              {displayTypes.map((type) => {
                const label = type
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <option key={type} value={type}>
                    {label}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* Viewport Sandbox container */}
      <div className="w-full flex-1 flex items-center justify-center bg-sage/5 rounded-[1.5rem] border border-sage/5 p-4 overflow-hidden relative min-h-[400px]">
        
        {/* Simulated Website Frame */}
        <div
          className={`bg-cream border border-sage/10 rounded-2xl shadow-soft relative overflow-hidden transition-all duration-300 flex flex-col justify-between ${getDeviceWidth()} ${getDeviceHeight()}`}
        >
          {/* Simulated Banner at top */}
          {currentPreviewType === "top_banner" && (
            <div className="w-full">
              <PromotionDisplay
                promotion={previewPromo}
                location="top_banner"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            </div>
          )}

          {/* Simulated Website Header */}
          <div className="p-4 border-b border-sage/5 bg-white/40 flex justify-between items-center flex-shrink-0 z-10">
            <span className="font-signature text-lg text-gold-gradient">Smoobuds Preview</span>
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-sage/20" />
              <div className="w-8 h-2.5 rounded-full bg-sage/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-sage/20" />
            </div>
          </div>

          {/* Simulated Website Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative flex flex-col justify-center select-none no-scrollbar">
            
            {/* Inline banners simulation */}
            {currentPreviewType === "homepage_hero" && (
              <PromotionDisplay
                promotion={previewPromo}
                location="homepage_hero"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            )}
            
            {currentPreviewType === "menu_banner" && (
              <PromotionDisplay
                promotion={previewPromo}
                location="menu_banner"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            )}

            {currentPreviewType === "checkout_banner" && (
              <PromotionDisplay
                promotion={previewPromo}
                location="checkout_banner"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            )}

            {/* Standard website dummy layout lines to give context */}
            {!["homepage_hero", "menu_banner", "checkout_banner", "full_screen"].includes(
              currentPreviewType
            ) && (
              <div className="space-y-3 opacity-25 py-12 px-6">
                <div className="h-6 bg-sage-deep/20 rounded-md w-1/3" />
                <div className="h-4 bg-sage-deep/10 rounded-md w-full" />
                <div className="h-4 bg-sage-deep/10 rounded-md w-5/6" />
                <div className="h-20 bg-sage-deep/5 rounded-2xl w-full flex items-center justify-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-sage-deep/40">Dine-In Menu Content</span>
                </div>
              </div>
            )}

            {/* Simulated Popup Modal */}
            {currentPreviewType === "popup_modal" && (
              <PromotionDisplay
                promotion={previewPromo}
                location="popup_modal"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            )}

            {/* Simulated Full Screen Promotion */}
            {currentPreviewType === "full_screen" && (
              <PromotionDisplay
                promotion={previewPromo}
                location="full_screen"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            )}

            {/* Simulated Floating Card */}
            {currentPreviewType === "floating_card" && (
              <PromotionDisplay
                promotion={previewPromo}
                location="floating_card"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            )}
          </div>

          {/* Simulated Sticky bottom banner */}
          {currentPreviewType === "bottom_sticky_banner" && (
            <div className="w-full">
              <PromotionDisplay
                promotion={previewPromo}
                location="bottom_sticky_banner"
                onClose={() => {}}
                onCtaClick={() => {}}
                preview
              />
            </div>
          )}

          {/* Simulated Website Footer */}
          <div className="p-3 bg-sage-deep/10 border-t border-sage/5 text-center text-[8px] text-sage-deep/45 uppercase tracking-widest font-semibold flex-shrink-0">
            © {new Date().getFullYear()} SmooBuds Cafe Lounge
          </div>
        </div>
      </div>
      
      {/* Device Info */}
      <span className="text-[10px] text-sage/50 font-bold uppercase tracking-wider">
        Simulating {device.toUpperCase()} Viewport ({device === "desktop" ? "Responsive" : device === "tablet" ? "768px" : "390px"})
      </span>
    </div>
  );
}
