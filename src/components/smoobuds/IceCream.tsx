import { motion } from "framer-motion";
import icecreamImg from "@/assets/icecream-collection.jpg";

const flavors = [
  { name: "Pistachio Royale", note: "Sicilian pistachio · sea salt · honey", color: "oklch(0.85 0.08 130)" },
  { name: "Strawberry Velvet", note: "Hand-folded berries · cream", color: "oklch(0.78 0.12 20)" },
  { name: "Madagascar Vanilla", note: "Bourbon vanilla · single-origin", color: "oklch(0.94 0.03 85)" },
  { name: "Dark Cocoa", note: "70% cacao · gold leaf", color: "oklch(0.30 0.04 50)" },
  { name: "Salted Caramel", note: "Slow-burnt · fleur de sel", color: "oklch(0.70 0.09 65)" },
  { name: "Rose Lychee", note: "Persian rose · lychee", color: "oklch(0.84 0.08 0)" },
];

export function IceCream() {
  return (
    <section id="icecream" className="relative bg-cream py-28 md:py-40 overflow-hidden">
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gold/20 blur-3xl animate-pulse-glow" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-sage/20 blur-3xl animate-pulse-glow" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-20">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-sage font-display font-semibold mb-5">✦ Gelato Atelier</p>
          <h2 className="font-display text-4xl md:text-7xl font-extrabold text-sage-deep leading-[1.02] tracking-tight text-balance">
            The Ice Cream <span className="font-signature font-normal text-sage text-[1.2em] not-italic">Collection</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-sage-deep/75 text-lg">
            Six small-batch flavours, churned every morning. Float over each scoop to meet the ingredients.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-12 items-center">
          {/* Floating hero scoops */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-5 relative"
          >
            <div className="relative aspect-square mx-auto max-w-md">
              <div className="absolute inset-0 rounded-full bg-gradient-gold opacity-30 blur-3xl animate-pulse-glow" />
              <motion.img
                animate={{ y: [0, -16, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                src={icecreamImg}
                alt="Hand-scooped artisan ice creams"
                loading="lazy"
                decoding="async"
                className="relative h-full w-full object-cover rounded-[2rem] shadow-luxe"
              />
            </div>
          </motion.div>

          {/* Flavor grid */}
          <div className="md:col-span-7 grid gap-3 sm:grid-cols-2">
            {flavors.map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, delay: i * 0.06 }}
                className="group relative overflow-hidden rounded-2xl border border-sage/15 bg-white/60 backdrop-blur-sm p-5 transition-all duration-500 hover:bg-white hover:shadow-luxe hover:-translate-y-1"
              >
                <div className="flex items-center gap-4">
                  <span
                    className="relative h-12 w-12 rounded-full ring-2 ring-white shadow-soft flex-shrink-0 transition-transform duration-500 group-hover:scale-110"
                    style={{ background: `radial-gradient(circle at 30% 30%, ${f.color}, oklch(0.40 0.02 170))` }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-extrabold text-sage-deep tracking-tight">{f.name}</h3>
                    <p className="text-xs text-sage-deep/65 mt-0.5 max-h-0 overflow-hidden group-hover:max-h-10 transition-all duration-500">
                      {f.note}
                    </p>
                  </div>
                  <span className="font-signature text-2xl text-gold-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    nº{(i + 1).toString().padStart(2, "0")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
