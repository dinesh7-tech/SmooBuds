import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

const reviews = [
  { name: "Aaradhya P.", role: "Food Blogger", text: "Genuinely the most beautiful dessert lounge in Kakinada. Every plate feels like it was made for a magazine cover.", rating: 5 },
  { name: "Karthik R.", role: "Regular Guest", text: "The brownie sundae is unreal. The lighting, the music, the smell of fresh waffles — pure escapism.", rating: 5 },
  { name: "Meera S.", role: "Pastry Chef", text: "As someone in the industry, I notice the details. SMOOBUDS doesn't cut corners — the cheesecake is textbook perfect.", rating: 5 },
  { name: "Vikram T.", role: "Family Visit", text: "Took the whole family. My kids loved the shakes, my parents loved the atmosphere. A new tradition for us.", rating: 5 },
  { name: "Priya K.", role: "Instagram Creator", text: "Every corner is a photo. The velvet seats and pendant lights are a dream. The desserts taste even better.", rating: 5 },
];

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const v = useMotionValue(0);
  const rounded = useTransform(v, (latest) => Math.floor(latest).toLocaleString());
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        animate(v, to, { duration: 2.4, ease: [0.22, 1, 0.36, 1] });
        io.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [to, v]);
  return (
    <span ref={ref} className="inline-flex items-baseline">
      <motion.span>{rounded}</motion.span>
      <span>{suffix}</span>
    </span>
  );
}

export function Reviews() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % reviews.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section id="reviews" className="relative bg-cream py-28 md:py-40 overflow-hidden">
      <div className="absolute inset-0 bg-radial-glow opacity-40" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-sage font-display font-semibold mb-5">✦ Loved By Kakinada</p>
          <h2 className="font-display text-4xl md:text-6xl font-extrabold text-sage-deep leading-[1.02] tracking-tight text-balance">
            Words from our <span className="font-signature font-normal text-sage text-[1.3em] not-italic">guests</span>
          </h2>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-16">
          {[
            { v: 24000, s: "+", l: "Happy guests" },
            { v: 4, s: ".9", l: "Avg. rating" },
            { v: 120, s: "+", l: "Signature recipes" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-display text-4xl md:text-6xl font-extrabold text-sage-deep tracking-tight">
                <Counter to={s.v} suffix={s.s} />
              </div>
              <p className="mt-2 text-xs tracking-[0.3em] uppercase text-sage-deep/65 font-display font-semibold">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Carousel */}
        <div className="relative mx-auto max-w-3xl">
          <div className="relative h-[300px] sm:h-[260px]">
            {reviews.map((r, i) => (
              <motion.article
                key={i}
                initial={false}
                animate={{
                  opacity: i === idx ? 1 : 0,
                  y: i === idx ? 0 : 20,
                  scale: i === idx ? 1 : 0.96,
                  pointerEvents: i === idx ? "auto" : "none",
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 rounded-3xl glass border-sage/20 bg-white/50 p-8 md:p-12 shadow-soft text-center flex flex-col items-center justify-center"
              >
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: r.rating }).map((_, k) => (
                    <Star key={k} className="text-gold fill-gold" size={16} />
                  ))}
                </div>
                <p className="font-display text-lg md:text-2xl text-sage-deep leading-relaxed text-balance">
                  "{r.text}"
                </p>
                <div className="mt-6">
                  <p className="font-display font-extrabold text-sage-deep">{r.name}</p>
                  <p className="text-xs text-sage-deep/65 tracking-[0.2em] uppercase mt-1">{r.role}</p>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-2">
            {reviews.map((_, i) => (
              <button
                key={i}
                aria-label={`Review ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1 rounded-full transition-all duration-500 ${i === idx ? "w-10 bg-sage" : "w-2 bg-sage/30"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
