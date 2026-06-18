import { motion } from "framer-motion";
import { Phone, MapPin, Clock, Instagram, Facebook, ArrowRight } from "lucide-react";

export function Contact() {
  return (
    <section id="contact" className="relative bg-sage-deep text-cream py-28 md:py-40 overflow-hidden">
      <div className="absolute inset-0 bg-radial-glow opacity-60" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-gold font-display font-semibold mb-5">✦ Visit Us</p>
          <h2 className="font-display text-5xl md:text-8xl font-extrabold leading-[0.95] tracking-tight text-balance">
            Find us in <br />
            <span className="font-signature font-normal text-gold-gradient text-[1.3em] not-italic">Kakinada</span>
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Map / address */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}
            className="lg:col-span-7 rounded-3xl overflow-hidden glass-dark shadow-luxe"
          >
            <div className="aspect-[16/10] w-full bg-sage-deep">
              <iframe
                title="SMOOBUDS Kakinada location"
                src="https://www.google.com/maps?q=Kakinada,Andhra+Pradesh&output=embed"
                className="h-full w-full"
                style={{ filter: "grayscale(0.4) contrast(1.05)" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </motion.div>

          {/* Info cards */}
          <div className="lg:col-span-5 grid gap-4">
            {[
              { icon: MapPin, t: "Address", d: "Main Road, Kakinada, Andhra Pradesh" },
              { icon: Phone, t: "Reservations", d: "+91 91212 92306" },
              { icon: Clock, t: "Open Daily", d: "11:00 AM — 11:30 PM" },
            ].map((c, i) => (
              <motion.div
                key={c.t}
                initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className="group flex items-start gap-5 rounded-3xl glass-dark p-7 transition-all duration-500 hover:border-gold/40 hover:-translate-y-1"
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-gold text-sage-deep">
                  <c.icon size={20} />
                </span>
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.4em] text-gold font-display font-semibold">{c.t}</p>
                  <p className="mt-2 font-display text-lg text-cream">{c.d}</p>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.3 }}
              className="rounded-3xl bg-gradient-gold p-7 text-sage-deep flex items-center justify-between"
            >
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.4em] font-display font-semibold">Reserve a table</p>
                <p className="mt-1 font-display text-xl font-extrabold">Plan your visit</p>
              </div>
              <a href="#reservations" className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-deep text-cream transition-transform hover:scale-110">
                <ArrowRight size={18} />
              </a>
            </motion.div>

            <div className="flex gap-3 mt-2">
              {[
                { Icon: Instagram, href: "https://www.instagram.com/smoobuds.kakinada/" },
                { Icon: Facebook, href: "https://facebook.com/smoobuds.kakinada" }
              ].map(({ Icon, href }, i) => (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full glass-dark hover:border-gold/40 transition-all hover:-translate-y-1">
                  <Icon size={18} className="text-gold" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
