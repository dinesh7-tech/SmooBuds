import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";

type Ctx = { reduced: boolean; toggle: () => void };
const MotionCtx = createContext<Ctx>({ reduced: false, toggle: () => {} });

export function useReducedMotionPref() {
  return useContext(MotionCtx);
}

const STORAGE_KEY = "smoobuds:reduced-motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "1") setReduced(true);
    else if (stored === "0") setReduced(false);
    else if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
    }
    setReady(true);
  }, []);

  const toggle = () => {
    setReduced((v) => {
      const next = !v;
      try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <MotionCtx.Provider value={{ reduced, toggle }}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>
        {children}
        {ready && <MotionToggleButton reduced={reduced} toggle={toggle} />}
      </MotionConfig>
    </MotionCtx.Provider>
  );
}

function MotionToggleButton({ reduced, toggle }: { reduced: boolean; toggle: () => void }) {
  return (
    <button
      onClick={toggle}
      aria-pressed={reduced}
      aria-label={reduced ? "Enable cinematic motion" : "Reduce motion"}
      title={reduced ? "Enable cinematic motion" : "Reduce motion"}
      className="fixed bottom-5 left-5 z-[70] flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[oklch(0.20_0.018_170/0.7)] backdrop-blur-xl text-gold shadow-luxe hover:scale-105 hover:border-gold/50 transition-all"
    >
      {reduced ? <Zap size={16} /> : <Sparkles size={16} />}
    </button>
  );
}
