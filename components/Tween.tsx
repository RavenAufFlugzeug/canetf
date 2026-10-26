"use client";

import { useEffect, useRef, useState } from "react";

// How long a figure takes to count to its new value.
const TWEEN_MS = 600;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

// A figure that, when it changes, counts smoothly from its old value to its new one rather
// than jumping (the Sandbox test's day, price and holdings as it moves on), shown by
// `format`. It starts at its first value; with reduced motion, it changes at once. Screen
// readers get the final figure, not every step.
export default function Tween({ value, format }: { value: number; format: (x: number) => string }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    let raf = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => {
        shownRef.current = value;
        setShown(value);
      });
      return () => cancelAnimationFrame(raf);
    }
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min((now - start) / TWEEN_MS, 1);
      shownRef.current = t < 1 ? from + (value - from) * easeOut(t) : value;
      setShown(shownRef.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
