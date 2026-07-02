import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getInitial(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}

type MotionProps = {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
};

// Collapse rich enter animations (x / y / scale / stagger / blur) to a quick
// opacity-only transition when the user prefers reduced motion.
export function enterMotion(reduced: boolean, full: MotionProps): MotionProps {
  if (!reduced) return full;
  const out: MotionProps = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  };
  if (full.exit !== undefined) out.exit = { opacity: 0 };
  return out;
}
