"use client";

import { useEffect, useRef } from "react";

// A figure in the About section that counts up from zero the first time it scrolls into
// view, easing out as it nears its value, as an amount ("13.27B USD") or a count
// ("150,000"). The page is rendered with the final figure, so it reads right before (and
// without) the script; with reduced motion it stays as it is.
const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 2 });
const DURATION_MS = 1100;

export function formatFigure(n: number, kind: "amount" | "count", currency?: string | null) {
  if (kind === "count") return Math.round(n).toLocaleString("en-CA");
  return `${compact.format(n)}${currency ? ` ${currency}` : ""}`;
}

export default function CountUp({
  value,
  kind,
  currency,
}: {
  value: number;
  kind: "amount" | "count";
  currency?: string | null;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Written straight to the element, frame by frame, rather than through React state.
    const show = (n: number) => (el.textContent = formatFigure(n, kind, currency));
    show(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / DURATION_MS, 1);
          show(value * (1 - (1 - t) ** 3)); // ease-out cubic
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      show(value);
    };
  }, [value, kind, currency]);

  return <span ref={ref}>{formatFigure(value, kind, currency)}</span>;
}
