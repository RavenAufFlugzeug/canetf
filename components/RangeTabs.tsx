"use client";

import { useLayoutEffect, useRef } from "react";

// A chart's range options (the Search page's chart and the Sandbox's). A dark pill sits
// behind the chosen one and slides to the next when another is picked, whose label gives a
// small pop; the others darken and rise a touch when pointed at, and every option dips
// when pressed.
export default function RangeTabs<R extends string>({
  ranges,
  range,
  onPick,
}: {
  ranges: readonly R[];
  range: R;
  onPick: (r: R) => void;
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
    // The options can wrap onto another line when the page narrows.
    const watch = new ResizeObserver(place);
    if (group.current) watch.observe(group.current);
    return () => watch.disconnect();
  }, [range, ranges]);

  return (
    <div ref={group} role="group" aria-label="Chart range" className="relative flex flex-wrap gap-1">
      <span
        ref={pill}
        aria-hidden
        className="range-pill pointer-events-none absolute left-0 top-0 rounded-md bg-slate-900 opacity-0 shadow-md shadow-slate-900/25"
      />
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={r === range}
          onClick={() => onPick(r)}
          className={`relative rounded-md px-3 py-1.5 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-90 ${
            r === range
              ? "text-white"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 motion-safe:hover:-translate-y-0.5"
          }`}
        >
          <span className={r === range ? "range-pop inline-block" : "inline-block"}>{r}</span>
        </button>
      ))}
    </div>
  );
}
