import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import craft from "@/assets/craft-hands.jpg";

const pillars = [
  { n: "01", t: "Fresh Ingredients", d: "Local dairy, premium imported chocolate, single-origin vanilla." },
  { n: "02", t: "Handcrafted Daily", d: "Every batch built by hand in our open kitchen — never shortcut." },
  { n: "03", t: "Signature Recipes", d: "Years of refinement behind every plate, every scoop, every pour." },
  { n: "04", t: "Premium Quality", d: "Awarded by guests across Kakinada as the standard of indulgence." },
];

export function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);

  return (
    <section id="desserts" ref={ref} className="relative bg-sage-deep text-cream py-28 md:py-40 overflow-hidden">
      <div className="absolute inset-0 opacity-40 bg-radial-glow" />
      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 md:grid-cols-12 md:gap-12">
        {/* Image */}
        <div className="md:col-span-6 md:sticky md:top-28 self-start">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] shadow-luxe"
          >
            <motion.img
              style={{ y }}
              src={craft}
              alt="Chef plating a signature dessert with gold leaf"
              loading="lazy"
              decoding="async"
              className="h-[110%] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sage-deep/60 to-transparent" />
            <div className="absolute left-6 bottom-6 right-6 flex items-end justify-between">
              <span className="font-signature text-4xl text-gold-gradient leading-none">the craft</span>
              <span className="text-[0.6rem] tracking-[0.4em] uppercase font-display text-cream/80">
                Plated · 2025
              </span>
            </div>
          </motion.div>
        </div>

        {/* Story */}
        <div className="md:col-span-6 md:pt-8">
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
            className="text-[0.65rem] uppercase tracking-[0.5em] text-gold font-display font-semibold mb-6"
          >
            ✦ The Signature Experience
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1, ease: [0.22,1,0.36,1] }}
            className="font-display text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight text-balance"
          >
            A quiet kind of <span className="font-signature font-normal text-gold-gradient text-[1.3em] not-italic">indulgence</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.2 }}
            className="mt-8 text-cream/80 text-lg leading-relaxed max-w-xl"
          >
            We obsess over the details others overlook — the temper of chocolate,
            the slow churn of gelato, the warmth of the room. SMOOBUDS is built
            for the people who notice.
          </motion.p>

          <div className="mt-14 grid gap-px bg-white/10 rounded-3xl overflow-hidden sm:grid-cols-2">
            {pillars.map((p, i) => (
              <motion.div
                key={p.n}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.08 }}
                className="relative bg-sage-deep p-7 group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative">
                  <span className="font-signature text-3xl text-gold-gradient">{p.n}</span>
                  <h3 className="mt-3 font-display font-extrabold text-xl text-cream">{p.t}</h3>
                  <p className="mt-2 text-sm text-cream/70 leading-relaxed">{p.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
