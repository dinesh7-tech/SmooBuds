import { motion } from "framer-motion";
import shake from "@/assets/dessert-shake.jpg";
import sundae from "@/assets/dessert-sundae.jpg";
import biscoffStorm from "@/assets/biscoff-storm.png";
import oreoRoyale from "@/assets/oreo-royale.png";
import strawberryCloud from "@/assets/strawberry-cloud.png";

const shakes = [
  { name: "Belgian Cocoa", price: "₹ 280", note: "Double chocolate · ganache · cream", img: shake, span: "md:col-span-2 md:row-span-2" },
  { name: "Biscoff Storm", price: "₹ 320", note: "Caramelised cookie · vanilla bean", img: biscoffStorm },
  { name: "Oreo Royale", price: "₹ 260", note: "Crushed cocoa · whipped tower", img: oreoRoyale },
  { name: "Strawberry Cloud", price: "₹ 240", note: "Fresh berries · house cream", img: strawberryCloud },
  { name: "Cold Brew Float", price: "₹ 280", note: "Espresso · gelato · gold dust", img: sundae, span: "md:col-span-2" },
];

export function Shakes() {
  return (
    <section id="shakes" className="relative bg-sage-deep text-cream py-28 md:py-40 overflow-hidden">
      <div className="absolute inset-0 bg-radial-glow opacity-50" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.5em] text-gold font-display font-semibold mb-5">✦ Liquid Indulgence</p>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight text-balance">
              Shakes & <span className="font-signature font-normal text-gold-gradient text-[1.3em] not-italic">Signatures</span>
            </h2>
          </div>
          <p className="max-w-md text-cream/75">
            Triple-thick blends finished tableside with hand-piped cream towers, ganache veils, and gold dust.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 md:auto-rows-[220px]">
          {shakes.map((s, i) => (
            <motion.article
              key={s.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`group relative overflow-hidden rounded-3xl glass-dark p-7 transition-all duration-700 hover:border-gold/40 ${s.span ?? ""}`}
            >
              {s.img && (
                <img
                  src={s.img}
                  alt={`${s.name} signature shake at SMOOBUDS Kakinada`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-50 transition-all duration-[1.4s] group-hover:opacity-80 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-sage-deep via-sage-deep/60 to-sage-deep/10" />

              {/* Animated liquid */}
              <motion.div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gold/15 to-transparent"
                animate={{ y: [10, 0, 10] }}
                transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative flex h-full flex-col justify-between min-h-[180px]">
                <div className="flex items-start justify-between">
                  <span className="font-signature text-2xl text-gold-gradient">nº0{i + 1}</span>
                  <span className="text-xs font-display font-semibold tracking-[0.2em] text-gold">{s.price}</span>
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight">{s.name}</h3>
                  <p className="mt-2 text-sm text-cream/75 max-w-xs">{s.note}</p>
                  <div className="mt-4 h-px w-10 bg-gold transition-all duration-700 group-hover:w-20" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
