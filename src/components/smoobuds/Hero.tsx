import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import heroImg from "@/assets/hero-dessert.jpg";
import { ArrowRight, Calendar } from "lucide-react";

const headline = "Every Dessert Tells A Story";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  return (
    <section id="home" ref={ref} className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-sage-deep">
      {/* Background image with parallax */}
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <img
          src={heroImg}
          alt="Molten chocolate cascading over a luxury dessert at SMOOBUDS Kakinada"
          className="h-full w-full object-cover"
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="absolute inset-0 bg-radial-glow opacity-80" />
      </motion.div>

      {/* Floating particles */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute block rounded-full bg-gold/60"
            style={{
              width: 4 + (i % 4),
              height: 4 + (i % 4),
              left: `${(i * 73) % 100}%`,
              top: `${(i * 37) % 100}%`,
              filter: "blur(0.5px)",
            }}
            animate={{ y: [0, -40, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 6 + (i % 5), repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div style={{ opacity }} className="relative z-10 mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 text-[0.65rem] uppercase tracking-[0.5em] text-gold/90 font-display font-semibold"
        >
          ✦ Kakinada's Luxury Dessert Lounge ✦
        </motion.p>

        <h1 className="font-display text-cream text-balance">
          <span className="block text-[clamp(2.2rem,7vw,6.5rem)] leading-[0.95] font-extrabold tracking-tight">
            {headline.split(" ").map((word, i) => (
              <span key={i} className="inline-block overflow-hidden align-bottom mr-[0.25em]">
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ delay: 2.0 + i * 0.09, duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                >
                  {i === 2 ? <em className="font-signature not-italic text-gold-gradient text-[1.25em] font-normal pr-2">{word}</em> : word}
                </motion.span>
              </span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 2.7, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 max-w-2xl text-base md:text-lg leading-relaxed text-cream/80 font-body"
        >
          Experience handcrafted desserts, premium ice creams, signature shakes
          and unforgettable moments at Kakinada's most loved dessert destination.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3, duration: 0.9 }}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <a href="#menu" className="btn-luxe btn-luxe-primary">
            Explore Menu <ArrowRight size={16} />
          </a>
          <a href="#reservations" className="btn-luxe btn-luxe-ghost">
            <Calendar size={16} /> Reservation
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.4, duration: 1 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-cream/70"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-[0.6rem] uppercase tracking-[0.45em] font-display">Scroll</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="h-10 w-px bg-gradient-to-b from-gold to-transparent"
          />
        </div>
      </motion.div>
    </section>
  );
}
