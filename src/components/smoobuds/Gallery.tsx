import { motion } from "framer-motion";
import brownie from "@/assets/dessert-brownie.jpg";
import cheesecake from "@/assets/dessert-cheesecake.jpg";
import sundae from "@/assets/dessert-sundae.jpg";
import shake from "@/assets/dessert-shake.jpg";
import loaded from "@/assets/dessert-loaded.jpg";
import ice from "@/assets/icecream-collection.jpg";
import hero from "@/assets/hero-dessert.jpg";
import craft from "@/assets/craft-hands.jpg";
import interior from "@/assets/store-interior.jpg";
import { Instagram } from "lucide-react";

const tiles = [
  { src: brownie, h: "row-span-2" },
  { src: ice, h: "" },
  { src: sundae, h: "row-span-2" },
  { src: shake, h: "" },
  { src: cheesecake, h: "row-span-2" },
  { src: loaded, h: "" },
  { src: hero, h: "" },
  { src: craft, h: "row-span-2" },
  { src: interior, h: "" },
];

export function Gallery() {
  return (
    <section className="relative bg-sage-deep text-cream py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-14">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.5em] text-gold font-display font-semibold mb-5">✦ As seen on</p>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight text-balance">
              From the <span className="font-signature font-normal text-gold-gradient text-[1.3em] not-italic">moment</span>
            </h2>
          </div>
          <a
            href="https://www.instagram.com/smoobuds.kakinada/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 text-cream/85 font-display font-semibold text-sm tracking-[0.2em] uppercase underline-luxe self-start md:self-end"
          >
            <Instagram size={18} /> @smoobuds.kakinada
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[200px] gap-3">
          {tiles.map((t, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: (i % 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className={`group relative overflow-hidden rounded-2xl ${t.h}`}
            >
              <img
                src={t.src}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sage-deep/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-700" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <Instagram className="text-gold drop-shadow-lg" size={32} />
              </div>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
