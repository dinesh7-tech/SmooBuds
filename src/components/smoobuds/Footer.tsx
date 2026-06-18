import { motion } from "framer-motion";
import { Instagram, Facebook, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative bg-[oklch(0.20_0.018_170)] text-cream pt-20 pb-10 overflow-hidden">
      {/* Marquee */}
      <div className="border-y border-white/10 py-8 mb-16 overflow-hidden">
        <div className="flex marquee gap-16 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-16 items-center shrink-0">
              {["Handcrafted Daily", "Kakinada · Est.", "Every Dessert Tells A Story", "Open Late", "Family Friendly", "Premium Quality"].map((w) => (
                <span key={w} className="inline-flex items-center gap-16">
                  <span className="font-signature text-4xl md:text-6xl text-gold-gradient leading-none">{w}</span>
                  <span className="text-gold/50">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <motion.div
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="font-signature text-6xl md:text-7xl text-gold-gradient leading-none"
            >
              Smoobuds
            </motion.div>
            <p className="mt-6 max-w-sm text-cream/65 leading-relaxed">
              A luxury dessert lounge in the heart of Kakinada. Crafted moments,
              served daily.
            </p>
            <div className="mt-6 flex gap-3">
              {[
                { Icon: Instagram, href: "https://www.instagram.com/smoobuds.kakinada/" },
                { Icon: Facebook, href: "https://facebook.com/smoobuds.kakinada" },
                { Icon: Twitter, href: "https://twitter.com/smoobuds" }
              ].map(({ Icon, href }, i) => (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 hover:border-gold/50 hover:bg-gold/10 hover:-translate-y-1 transition-all">
                  <Icon size={16} className="text-gold" />
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-gold font-display font-semibold mb-5">Explore</p>
            <ul className="space-y-3 text-cream/80 font-display">
              {["Menu", "Desserts", "Ice Creams", "Shakes", "Gallery", "Contact"].map((l) => (
                <li key={l}><a href={`#${l.toLowerCase().replace(" ", "")}`} className="hover:text-gold underline-luxe transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-gold font-display font-semibold mb-5">Stay in the loop</p>
            <p className="text-cream/70 text-sm mb-5">New flavours, seasonal menus, private events.</p>
            <form className="flex items-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md p-1.5 focus-within:border-gold/50 transition-colors">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 bg-transparent px-4 py-2 text-sm text-cream placeholder:text-cream/40 outline-none"
              />
              <button type="submit" className="rounded-full bg-gradient-gold px-5 py-2 text-xs font-display font-bold uppercase tracking-[0.2em] text-sage-deep hover:shadow-gold transition-shadow">
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-center text-xs text-cream/50 tracking-[0.15em] uppercase font-display">
          <p>© {new Date().getFullYear()} SMOOBUDS Kakinada. All rights reserved.</p>
          <p>
            Developed by{" "}
            <a
              href="https://dineshshowcase.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:text-gold-soft transition-colors"
            >
              DINESH
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
