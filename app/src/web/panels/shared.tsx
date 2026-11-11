/** Shared sidebar helpers: open/close presence and fact rows. */

import { useEffect, useState, type ReactNode } from "react";

export function useAnimatedPresence(open: boolean): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--motion-layout");
    const ms = Number.parseFloat(raw);
    const delay = (Number.isFinite(ms) ? ms : 340) + 40;
    const timer = setTimeout(() => setMounted(false), delay);
    return () => clearTimeout(timer);
  }, [open]);

  return { mounted, shown: open && shown };
}

interface FactProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  title?: string;
}

export function DetailFact({ label, value, mono = false, title }: FactProps) {
  return (
    <div className={`detail-fact${mono ? " mono" : ""}`}>
      <span className="detail-fact-label">{label}</span>
      <span
        className="detail-fact-value"
        title={typeof value === "string" ? title || value : title}
      >
        {value}
      </span>
    </div>
  );
}
