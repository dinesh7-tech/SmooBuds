import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import interior from "@/assets/store-interior.jpg";

const features = [
  "Velvet seating",
  "Warm pendant lighting",
  "Marble tabletops",
  "Family-friendly corners",
  "Instagram nooks",
  "Open dessert kitchen",
];

export function StoreExperience() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.05, 1, 1.05]);

  return (
    <section id="gallery" ref={ref} className="relative bg-cream overflow-hidden">
      {/* Full-bleed cinematic image */}
      <div className="relative h-[80vh] min-h-[600px] overflow-hidden">
        <motion.img
          style={{ y, scale }}
          src={interior}
          alt="SMOOBUDS lounge interior with velvet seating and warm pendant lighting"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-[120%] w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sage-deep/40 via-transparent to-sage-deep/80" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-6 pb-16">
          <motion.p
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-[0.65rem] uppercase tracking-[0.5em] text-gold font-display font-semibold mb-5"
          >
            ✦ The Lounge
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22,1,0.36,1] }}
            className="font-display text-4xl md:text-7xl font-extrabold text-cream leading-[1.02] tracking-tight text-balance max-w-4xl"
          >
            A room designed to <span className="font-signature font-normal text-gold-gradient text-[1.2em] not-italic">linger in</span>
          </motion.h2>
        </div>
      </div>

      {/* Feature grid */}
      <div className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.06 }}
              className="group flex items-center gap-4 rounded-2xl border border-sage/15 bg-white/60 backdrop-blur-sm px-6 py-5 transition-all duration-500 hover:bg-white hover:-translate-y-1 hover:shadow-soft"
            >
              <span className="font-signature text-2xl text-sage opacity-50 group-hover:opacity-100 transition-opacity">
                ✦
              </span>
              <span className="font-display font-semibold tracking-tight text-sage-deep">{f}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
