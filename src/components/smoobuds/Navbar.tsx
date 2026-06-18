import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Home", href: "#home" },
  { label: "Menu", href: "#menu" },
  { label: "Desserts", href: "#desserts" },
  { label: "Ice Creams", href: "#icecream" },
  { label: "Shakes", href: "#shakes" },
  { label: "Gallery", href: "#gallery" },
  { label: "Reviews", href: "#reviews" },
  { label: "Reservations", href: "#reservations" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1, delay: 1.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-8 md:pt-6"
    >
      <nav
        className={`mx-auto flex max-w-[1400px] items-center justify-between rounded-full border px-5 py-3 transition-all duration-700 md:px-8 ${
          scrolled
            ? "border-white/10 bg-[oklch(0.20_0.018_170/0.65)] backdrop-blur-xl shadow-soft"
            : "border-white/15 bg-white/5 backdrop-blur-md"
        }`}
      >
        {/* Left links (desktop) */}
        <ul className="hidden lg:flex flex-1 gap-7 text-[0.7rem] uppercase tracking-[0.22em] text-cream/85 font-display font-semibold">
          {links.slice(0, 4).map((l) => (
            <li key={l.href}>
              <a href={l.href} className="underline-luxe transition-colors hover:text-gold">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Center logo */}
        <a href="#home" className="flex items-center gap-2 lg:flex-none">
          <span className="font-signature text-3xl md:text-4xl leading-none text-gold-gradient">
            Smoobuds
          </span>
        </a>

        {/* Right links (desktop) */}
        <ul className="hidden lg:flex flex-1 justify-end gap-7 text-[0.7rem] uppercase tracking-[0.22em] text-cream/85 font-display font-semibold">
          {links.slice(4).map((l) => (
            <li key={l.href}>
              <a href={l.href} className="underline-luxe transition-colors hover:text-gold">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden rounded-full p-2 text-cream"
          aria-label="Menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden mx-auto mt-3 max-w-[1400px] rounded-3xl border border-white/10 bg-[oklch(0.20_0.018_170/0.85)] backdrop-blur-xl p-6 shadow-luxe"
          >
            <ul className="grid gap-4 text-cream font-display uppercase tracking-[0.2em] text-sm">
              {links.map((l) => (
                <li key={l.href}>
                  <a onClick={() => setOpen(false)} href={l.href} className="block py-1 hover:text-gold transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
