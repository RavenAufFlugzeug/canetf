"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// How long the old words take to fade away (.fade-text-out in globals.css): they are removed
// after it, whether or not the animation ran.
const OUT_MS = 520;
// How long the text takes to ease to its new size.
const SIZE_MS = 520;

// Text that changes smoothly: when `text` changes, the old words fade and drift up out of
// place while the new ones fade and rise into it, the two overlapping (a cross-fade), and the
// text eases to its new size rather than jumping: a line (block) to its new height, if it
// wraps differently; a label (`inline`, as on a button) to its new width. Used for the
// Sandbox set-up's descriptions and its pick button, which change with each choice. With
// motion reduced, it simply changes.
export default function FadeText({
  text,
  className = "",
  inline = false,
}: {
  text: string;
  className?: string;
  inline?: boolean;
}) {
  // The words shown, and the ones leaving (each keyed, so each change animates afresh).
  const [shown, setShown] = useState({ text, n: 0 });
  const [leaving, setLeaving] = useState<{ text: string; n: number } | null>(null);
  if (text !== shown.text) {
    // With motion reduced (no animations to end), the old words just go.
    const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(calm ? null : shown);
    setShown({ text, n: shown.n + 1 });
  }

  // The old words go once they have faded.
  useEffect(() => {
    if (!leaving) return;
    const gone = window.setTimeout(() => setLeaving((l) => (l?.n === leaving.n ? null : l)), OUT_MS);
    return () => window.clearTimeout(gone);
  }, [leaving]);

  // Easing the size (height, or width for a label) between the old wording's and the new's,
  // measured from the new words alone.
  const box = useRef<HTMLSpanElement>(null);
  const size = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const now = el?.querySelector<HTMLElement>("[data-now]");
    if (!el || !now) return;
    const side = inline ? "width" : "height";
    const start = size.current;
    el.style[side] = "";
    const end = inline ? now.offsetWidth : now.offsetHeight;
    size.current = end;
    if (start === null || Math.abs(end - start) < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    el.style[side] = `${start}px`;
    el.getBoundingClientRect();
    el.style.transition = `${side} ${SIZE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    el.style[side] = `${end}px`;
    const done = window.setTimeout(() => {
      el.style[side] = "";
      el.style.transition = "";
    }, SIZE_MS);
    return () => window.clearTimeout(done);
  }, [shown.n, inline]);

  // A label stacks the old and new words in one cell; a line lays the old over the new.
  return (
    <span
      ref={box}
      className={`${inline ? "inline-grid overflow-hidden whitespace-nowrap" : "relative block"} ${className}`}
    >
      {leaving && (
        <span
          key={`out-${leaving.n}`}
          aria-hidden
          className={`fade-text-out pointer-events-none ${inline ? "col-start-1 row-start-1" : "absolute inset-x-0 top-0"}`}
        >
          {leaving.text}
        </span>
      )}
      <span
        key={`in-${shown.n}`}
        data-now=""
        className={`${inline ? "col-start-1 row-start-1 justify-self-start" : "block"} ${shown.n ? "fade-text-in" : ""}`}
      >
        {shown.text}
      </span>
    </span>
  );
}
