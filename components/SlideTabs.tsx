"use client";

import { useLayoutEffect, useRef } from "react";

export type SlideOption<V extends string> = { value: V; label: React.ReactNode; ariaLabel?: string };

// A small switch between a few options, as the charts' range tabs (RangeTabs) are: a dark
// pill sits behind the chosen one and slides to the next when another is picked, whose label
// gives a small pop; the others darken when pointed at, and every option dips when pressed.
// On a light grey track, for the Sandbox's switches (Market value / Count, cards / list).
export default function SlideTabs<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly SlideOption<V>[];
  value: V;
  onChange: (v: V) => void;
  label: string; // what the switch chooses, for screen readers
}) {
  const group = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const place = () => {
      const chosen = group.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      const el = pill.current;
      if (!chosen || !el) return;
      // The first time, it is simply put in place rather than sliding in from the corner.
      if (!placed.current) {
        el.style.transition = "none";
        requestAnimationFrame(() => (el.style.transition = ""));
        placed.current = true;
      }
      el.style.transform = `translate(${chosen.offsetLeft}px, ${chosen.offsetTop}px)`;
      el.style.width = `${chosen.offsetWidth}px`;
      el.style.height = `${chosen.offsetHeight}px`;
      el.style.opacity = "1";
    };
    place();
    const watch = new ResizeObserver(place);
    if (group.current) watch.observe(group.current);
    return () => watch.disconnect();
  }, [value, options]);

  return (
    <div ref={group} role="group" aria-label={label} className="relative flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
      <span
        ref={pill}
        aria-hidden
        className="range-pill pointer-events-none absolute left-0 top-0 rounded-md bg-slate-900 opacity-0 shadow-sm shadow-slate-900/25"
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-90 ${
              on ? "text-white" : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <span className={on ? "range-pop inline-flex items-center" : "inline-flex items-center"}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
