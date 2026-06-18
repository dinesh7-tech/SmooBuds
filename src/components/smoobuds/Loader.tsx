import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/631484342_17849450895674195_6595394381590443669_n.jpg";

export function PageLoader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1700);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-sage"
        >
          <div className="absolute inset-0 bg-radial-glow opacity-60" />
          <div className="relative flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center"
            >
              <img
                src={logoImg}
                alt="Smoobuds Logo"
                className="h-28 md:h-36 w-auto object-contain rounded-2xl border border-gold/30 shadow-luxe"
              />
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "8rem" }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              className="mt-6 h-px bg-gradient-gold"
            />
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-5 text-[0.65rem] tracking-[0.5em] uppercase text-cream/80 font-display"
            >
              Kakinada · Est.
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
