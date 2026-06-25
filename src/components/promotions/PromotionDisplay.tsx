import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone, Gift, ShoppingBag, ArrowRight } from "lucide-react";

export interface Promotion {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  banner_url: string | null;
  cta_text: string;
  cta_url: string;
  display_type: string[];
  animation_type: string;
  animation_duration: string;
  offer_type: string;
}

interface PromotionDisplayProps {
  promotion: Promotion;
  location: string;
  onClose: () => void;
  onCtaClick: () => void;
  preview?: boolean;
}

export function PromotionDisplay({ promotion, location, onClose, onCtaClick, preview = false }: PromotionDisplayProps) {
  const {
    title,
    subtitle,
    description,
    image_url,
    banner_url,
    cta_text,
    cta_url,
    animation_type = "fade",
    animation_duration = "0.5s",
  } = promotion;

  const parsedDuration = parseFloat(animation_duration) || 0.5;

  // Animation variants mapped from configuration
  const getAnimationVariants = () => {
    switch (animation_type) {
      case "zoom":
        return {
          initial: { opacity: 0, scale: 0.3 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.3 }
        };
      case "scale":
        return {
          initial: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.8 }
        };
      case "slide_up":
        return {
          initial: { opacity: 0, y: 100 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 100 }
        };
      case "slide_down":
        return {
          initial: { opacity: 0, y: -100 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -100 }
        };
      case "bounce":
        return {
          initial: { opacity: 0, y: -200 },
          animate: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.55 } },
          exit: { opacity: 0, y: 200 }
        };
      case "flip":
        return {
          initial: { opacity: 0, rotateY: 90 },
          animate: { opacity: 1, rotateY: 0 },
          exit: { opacity: 0, rotateY: 90 }
        };
      case "rotate":
        return {
          initial: { opacity: 0, rotate: -45, scale: 0.85 },
          animate: { opacity: 1, rotate: 0, scale: 1 },
          exit: { opacity: 0, rotate: 45, scale: 0.85 }
        };
      case "blur_in":
        return {
          initial: { opacity: 0, filter: "blur(12px)" },
          animate: { opacity: 1, filter: "blur(0px)" },
          exit: { opacity: 0, filter: "blur(12px)" }
        };
      case "spring":
        return {
          initial: { opacity: 0, scale: 0.5 },
          animate: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 350, damping: 18 } },
          exit: { opacity: 0, scale: 0.5 }
        };
      case "fade":
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 }
        };
    }
  };

  const animationVariants = getAnimationVariants();
  const transition = animation_type !== "bounce" && animation_type !== "spring"
    ? { duration: parsedDuration, ease: [0.16, 1, 0.3, 1] }
    : undefined;

  // Render individual locations
  if (location === "popup_modal") {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${preview ? "absolute" : ""}`}>
        {/* Blur Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-sage-deep/40 backdrop-blur-md cursor-pointer"
        />

        {/* Modal content */}
        <motion.div
          variants={animationVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="bg-cream border border-sage/15 rounded-3xl shadow-luxe max-w-md w-full overflow-hidden relative z-10 flex flex-col"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/60 hover:bg-white text-sage-deep hover:text-sage p-2 rounded-full transition-colors z-20 cursor-pointer shadow-soft"
            aria-label="Close promotion"
          >
            <X size={16} />
          </button>

          {/* Promotion Image */}
          {image_url && (
            <div className="w-full h-48 sm:h-56 overflow-hidden relative">
              <img
                src={image_url}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-cream via-transparent to-transparent opacity-80" />
            </div>
          )}

          {/* Details */}
          <div className="p-6 flex-1 flex flex-col text-center items-center justify-center">
            <div className="inline-flex p-3 bg-gold/10 text-gold rounded-full mb-3">
              <Gift size={20} />
            </div>
            
            {subtitle && (
              <span className="text-[10px] tracking-[0.2em] font-extrabold text-gold uppercase mb-1 block">
                {subtitle}
              </span>
            )}
            
            <h3 className="font-display font-black text-xl text-sage-deep leading-tight">
              {title}
            </h3>
            
            {description && (
              <p className="text-xs text-sage-deep/70 mt-2 font-medium leading-relaxed max-w-sm">
                {description}
              </p>
            )}

            <button
              onClick={onCtaClick}
              className="mt-6 w-full bg-sage hover:bg-sage-deep text-cream font-display font-bold text-xs uppercase tracking-wider py-4 rounded-xl shadow-soft flex items-center justify-center gap-2 cursor-pointer transition-colors border border-white/5"
            >
              {cta_text} <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (location === "full_screen") {
    return (
      <div className={`fixed inset-0 z-50 bg-cream/98 backdrop-blur-lg flex flex-col justify-between p-6 sm:p-12 ${preview ? "absolute" : ""}`}>
        {/* Header/Close */}
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2 text-sage-deep">
            <Megaphone className="text-gold" size={20} />
            <span className="font-signature text-2xl text-gold-gradient">Smoobuds</span>
          </div>
          <button
            onClick={onClose}
            className="bg-sage/10 text-sage hover:bg-sage/20 p-2.5 rounded-full transition-colors cursor-pointer"
            aria-label="Dismiss screen"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body */}
        <motion.div
          variants={animationVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="max-w-2xl mx-auto flex flex-col lg:flex-row items-center gap-8 lg:gap-12 py-6 my-auto"
        >
          {image_url && (
            <div className="w-full lg:w-1/2 max-h-[300px] lg:max-h-[450px] aspect-square rounded-3xl overflow-hidden shadow-soft border border-sage/10">
              <img
                src={image_url}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
          
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
            {subtitle && (
              <span className="bg-gold/15 text-gold text-[10px] tracking-[0.25em] font-extrabold uppercase px-3 py-1.5 rounded-full border border-gold/10">
                {subtitle}
              </span>
            )}
            
            <h2 className="font-display font-black text-3xl sm:text-4xl text-sage-deep leading-tight">
              {title}
            </h2>
            
            {description && (
              <p className="text-sm text-sage-deep/75 font-medium leading-relaxed">
                {description}
              </p>
            )}

            <button
              onClick={onCtaClick}
              className="bg-sage hover:bg-sage-deep text-cream font-display font-bold text-xs uppercase tracking-wider px-8 py-4 rounded-xl shadow-soft flex items-center gap-2 cursor-pointer transition-colors border border-white/5"
            >
              {cta_text} <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="text-center text-[10px] text-sage/40 uppercase tracking-widest font-semibold">
          Limited Time Offer • Terms Apply
        </div>
      </div>
    );
  }

  if (location === "top_banner") {
    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-sage-deep text-cream text-xs relative overflow-hidden z-40 border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 pr-12 flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <Gift size={14} className="text-gold animate-bounce" />
            <span className="font-bold">{title}</span>
            {subtitle && <span className="text-gold font-medium">({subtitle})</span>}
          </div>
          {description && <span className="opacity-80 hidden md:inline">• {description}</span>}
          <button
            onClick={onCtaClick}
            className="text-[10px] uppercase font-bold tracking-wider text-gold hover:text-white underline cursor-pointer ml-2"
          >
            {cta_text}
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-1/2 -translate-y-1/2 right-4 text-cream/60 hover:text-white p-1 rounded-full cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>
      </motion.div>
    );
  }

  if (location === "bottom_sticky_banner") {
    return (
      <div className={`fixed bottom-0 inset-x-0 z-40 p-4 ${preview ? "absolute" : ""}`}>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="max-w-4xl mx-auto bg-cream border border-sage/20 rounded-2xl shadow-luxe p-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="flex items-center gap-4 flex-1">
            {image_url && (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-sage/10">
                <img src={image_url} alt={title} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <h4 className="font-display font-extrabold text-sm text-sage-deep">
                {title}
              </h4>
              {description && (
                <p className="text-[11px] text-sage-deep/70 line-clamp-1 font-medium mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onCtaClick}
              className="flex-1 sm:flex-none bg-sage hover:bg-sage-deep text-cream text-[10px] uppercase font-bold tracking-wider px-5 py-2.5 rounded-lg shadow-soft cursor-pointer transition-colors"
            >
              {cta_text}
            </button>
            <button
              onClick={onClose}
              className="bg-sage/10 text-sage hover:bg-sage/25 p-2 rounded-lg transition-colors cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (location === "floating_card") {
    return (
      <div className={`fixed bottom-6 right-6 z-40 max-w-xs w-full p-2 ${preview ? "absolute bottom-2 right-2" : ""}`}>
        <motion.div
          initial={{ scale: 0.8, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: 50, opacity: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 250 }}
          className="bg-cream border border-sage/15 rounded-2xl shadow-luxe p-4 relative overflow-hidden flex flex-col"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/60 hover:bg-white text-sage-deep p-1.5 rounded-full cursor-pointer z-10 transition-colors shadow-soft"
            aria-label="Dismiss card"
          >
            <X size={12} />
          </button>

          {image_url && (
            <div className="w-full h-24 rounded-lg overflow-hidden mb-3 border border-sage/10">
              <img src={image_url} alt={title} className="w-full h-full object-cover" />
            </div>
          )}

          {subtitle && (
            <span className="text-[9px] tracking-wider text-gold font-bold uppercase mb-0.5">
              {subtitle}
            </span>
          )}
          <h4 className="font-display font-black text-sm text-sage-deep">
            {title}
          </h4>
          {description && (
            <p className="text-[10px] text-sage-deep/70 line-clamp-2 mt-1 leading-relaxed">
              {description}
            </p>
          )}

          <button
            onClick={onCtaClick}
            className="mt-3.5 bg-sage hover:bg-sage-deep text-cream text-[9px] uppercase font-bold tracking-wider py-2.5 rounded-lg text-center cursor-pointer transition-colors"
          >
            {cta_text}
          </button>
        </motion.div>
      </div>
    );
  }

  // Inline Banners: homepage_hero, menu_banner, checkout_banner
  if (["homepage_hero", "menu_banner", "checkout_banner"].includes(location)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full bg-cream border border-sage/15 rounded-3xl overflow-hidden shadow-soft p-5 sm:p-6 flex flex-col md:flex-row items-center gap-5 sm:gap-6 relative group hover:shadow-md transition-all"
      >
        {/* Background Graphic */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-2xl pointer-events-none" />

        {banner_url || image_url ? (
          <div className="w-full md:w-1/3 aspect-video md:aspect-[4/3] rounded-2xl overflow-hidden border border-sage/10 relative">
            <img
              src={banner_url || image_url || ""}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
            <Gift size={24} />
          </div>
        )}

        <div className="flex-1 flex flex-col items-start space-y-2 text-left w-full">
          {subtitle && (
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-gold">
              {subtitle}
            </span>
          )}
          <h3 className="font-display font-extrabold text-lg text-sage-deep leading-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-sage-deep/70 leading-relaxed font-medium">
              {description}
            </p>
          )}
          <div className="pt-2 w-full flex items-center justify-between">
            <button
              onClick={onCtaClick}
              className="bg-sage hover:bg-sage-deep text-cream text-[10px] font-display font-bold uppercase tracking-wider px-5 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-soft transition-colors"
            >
              {cta_text} <ArrowRight size={12} />
            </button>
            
            {!preview && (
              <button
                onClick={onClose}
                className="text-[10px] text-sage hover:text-sage-deep font-semibold uppercase tracking-wider cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
