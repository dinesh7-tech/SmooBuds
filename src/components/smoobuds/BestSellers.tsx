import { motion } from "framer-motion";
import { useRef } from "react";
import brownie from "@/assets/dessert-brownie.jpg";
import cheesecake from "@/assets/dessert-cheesecake.jpg";
import sundae from "@/assets/dessert-sundae.jpg";
import shake from "@/assets/dessert-shake.jpg";
import loaded from "@/assets/dessert-loaded.jpg";

const items = [
  { name: "Molten Brownies", tag: "Signature", img: brownie, note: "Slow-baked Belgian cocoa, vanilla bean cream, edible gold." },
  { name: "Velvet Cheesecake", tag: "Bestseller", img: cheesecake, note: "Hand-whipped mascarpone, berry confit, almond sablé." },
  { name: "Crystal Sundae", tag: "Limited", img: sundae, note: "Five-scoop tower, salted caramel ribbons, fresh berries." },
  { name: "Royale Shake", tag: "Iconic", img: shake, note: "Triple-thick blend, hand-piped cream, dark ganache." },
  { name: "Loaded Indulgence", tag: "Sharing", img: loaded, note: "Waffle, gelato, berries, ganache — built for two." },
];

function Card({ item, i }: { item: typeof items[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${-py * 8}deg) rotateY(${px * 10}deg) translateY(-6px)`;
  };
  const onLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = `perspective(1100px) rotateX(0deg) rotateY(0deg) translateY(0)`;
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex-shrink-0 w-[78vw] sm:w-[440px]"
    >
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)" }}
        className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-luxe bg-sage-deep"
      >
        <img
          src={item.img}
          alt={`${item.name} — ${item.tag} dessert at SMOOBUDS Kakinada`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.08]"
        />
        {/* Glass reflection */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        {/* Gradient base */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[oklch(0.15_0.012_170/0.95)] via-[oklch(0.15_0.012_170/0.5)] to-transparent" />
        {/* Tag */}
        <span className="absolute left-5 top-5 rounded-full glass px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-cream font-display font-semibold">
          {item.tag}
        </span>
        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-7">
          <h3 className="font-display text-2xl md:text-3xl font-extrabold text-cream tracking-tight">
            {item.name}
          </h3>
          <p className="mt-2 max-w-xs text-sm text-cream/75 leading-relaxed">{item.note}</p>
          <div className="mt-5 h-px w-12 bg-gold transition-all duration-700 group-hover:w-24" />
        </div>
        {/* Floating glow */}
        <div className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ boxShadow: "0 30px 80px -10px oklch(0.83 0.055 85 / 0.45)" }} />
      </div>
    </motion.article>
  );
}

export function BestSellers() {
  return (
    <section id="menu" className="relative bg-cream py-28 md:py-40 overflow-hidden">
      <div className="absolute inset-0 bg-radial-glow opacity-30" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.5em] text-sage font-display font-semibold mb-4">
              ✦ The Signature Edit
            </p>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold text-sage-deep text-balance leading-[1.02] tracking-tight">
              Bestsellers,<br />
              <span className="font-signature font-normal text-sage text-[1.2em] not-italic">handcrafted daily</span>
            </h2>
          </div>
          <p className="max-w-md text-sage-deep/80 text-base leading-relaxed">
            A curation of our most beloved creations — every plate built with
            patience, served as a moment worth savouring.
          </p>
        </div>
      </div>

      {/* Horizontal scroll showcase */}
      <div className="relative">
        <div className="no-scrollbar flex gap-7 overflow-x-auto px-6 md:px-[max(1.5rem,calc((100vw-80rem)/2))] pb-10 snap-x snap-mandatory">
          {items.map((it, i) => (
            <div key={it.name} className="snap-start">
              <Card item={it} i={i} />
            </div>
          ))}
          <div className="flex-shrink-0 w-1" />
        </div>
      </div>
    </section>
  );
}
