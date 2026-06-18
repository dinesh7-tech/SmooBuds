import { useEffect, useRef, useState } from "react";

/**
 * Mouse-follow ambient glow + minimal luxury cursor accent.
 * Disabled on touch devices.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    setEnabled(true);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x, cy = y;
    const onMove = (e: MouseEvent) => { x = e.clientX; y = e.clientY; };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const loop = () => {
      cx += (x - cx) * 0.12;
      cy += (y - cy) * 0.12;
      if (ref.current) ref.current.style.transform = `translate3d(${cx - 250}px, ${cy - 250}px, 0)`;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${x - 5}px, ${y - 5}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[60] h-[500px] w-[500px] rounded-full opacity-70 mix-blend-screen"
        style={{ background: "radial-gradient(circle, oklch(0.83 0.055 85 / 0.22), transparent 60%)" }}
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[61] h-2.5 w-2.5 rounded-full bg-gold-soft mix-blend-difference"
      />
    </>
  );
}
