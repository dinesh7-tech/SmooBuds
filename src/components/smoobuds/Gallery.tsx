import { motion } from "framer-motion";
import insta1 from "@/assets/instagram-1.jpg";
import insta2 from "@/assets/instagram-2.jpg";
import insta3 from "@/assets/instagram-3.jpg";
import insta4 from "@/assets/instagram-4.jpg";
import insta5 from "@/assets/instagram-5.jpg";
import insta6 from "@/assets/instagram-6.jpg";
import insta7 from "@/assets/instagram-7.jpg";
import insta8 from "@/assets/instagram-8.jpg";
import insta9 from "@/assets/instagram-9.jpg";
import { Instagram } from "lucide-react";

const tiles = [
  { src: insta1, h: "row-span-2", href: "https://www.instagram.com/reel/DYO7jkYo4I3/?igsh=cW5lem94MXpzMXRq" },
  { src: insta2, h: "", href: "https://www.instagram.com/reel/DYAD0QIJL83/?igsh=MTVvOTM5ODFrdWtxOQ==" },
  { src: insta3, h: "row-span-2", href: "https://www.instagram.com/reel/DXiq53HDJ--/?igsh=aHQ3NXpibXQ4N25o" },
  { src: insta4, h: "", href: "https://www.instagram.com/reel/DVyaLMsibyR/?igsh=MXRrcXNhMjZqeXR1bw==" },
  { src: insta5, h: "row-span-2", href: "https://www.instagram.com/smoobuds.kakinada/" },
  { src: insta6, h: "", href: "https://www.instagram.com/smoobuds.kakinada/" },
  { src: insta7, h: "", href: "https://www.instagram.com/smoobuds.kakinada/" },
  { src: insta8, h: "row-span-2", href: "https://www.instagram.com/smoobuds.kakinada/" },
  { src: insta9, h: "", href: "https://www.instagram.com/smoobuds.kakinada/" },
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
            <a
              key={i}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`block relative rounded-2xl overflow-hidden ${t.h}`}
            >
              <motion.figure
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay: (i % 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="group relative overflow-hidden rounded-2xl h-full w-full"
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
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
