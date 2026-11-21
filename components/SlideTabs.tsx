"use client";

import { useSlidingPill } from "@/lib/useSlidingPill";
import { FOCUS_RING } from "@/lib/ui";

export type SlideOption<V extends string> = {
  value: V;
  label: React.ReactNode;
  ariaLabel?: string;
  // How many there are of it (a filter's matches), in a lighter shade after the label.
  count?: number;
  // An option that is a link (the Sandbox's choice chips): clicking it plainly calls
  // onChange, while a link opened elsewhere (a new tab, say) is left to the browser.
  href?: string;
};

// The site's one switch between a few options, in the look of the Search page's Ticker / Name
// switch: a white pill sits on a light grey track behind the chosen option and springs across
// to the next when another is picked; the others are grey and darken when pointed at. The
// options wrap onto another line when there is no room, and the pill follows. Used for the
// charts' ranges, the Sandbox's switches and choice chips, and the filters and Buy / Sell.
// `xs` is the smaller size, for the busier toolbars.
export default function SlideTabs<V extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  size = "sm",
  className = "",
}: {
  options: readonly SlideOption<V>[];
  value: V;
  onChange: (v: V) => void;
  label?: string; // what the switch chooses, for screen readers
  labelledBy?: string; // or the id of the words beside it that say so
  size?: "sm" | "xs";
  className?: string;
}) {
  const links = options.some((o) => o.href);
  // Until the pill is placed (before the page has run its script), the chosen option is
  // white itself, so it never shows as unchosen.
  const { group, pill, placed } = useSlidingPill(
    '[data-on="true"]',
    `${value}|${options.map((o) => o.value).join(",")}`,
  );

  const xs = size === "xs";

  return (
    <div
      ref={group}
      role={links ? "group" : "radiogroup"}
      aria-label={label}
      aria-labelledby={labelledBy}
      className={`relative inline-flex max-w-full flex-wrap rounded-lg bg-slate-100 font-semibold ${
        xs ? "gap-0.5 p-0.5 text-xs" : "gap-1 p-1 text-sm"
      } ${className}`}
    >
      <span
        ref={pill}
        aria-hidden
        className="range-pill pointer-events-none absolute left-0 top-0 rounded-md bg-white opacity-0 shadow-sm"
      />
      {options.map((o) => {
        const on = o.value === value;
        const look = `relative inline-flex items-center justify-center rounded-md transition-colors duration-200 ${FOCUS_RING} ${
          xs ? "px-2.5 py-1" : "px-4 py-1"
        } ${on ? `text-slate-900 ${placed ? "" : "bg-white shadow-sm"}` : "text-slate-500 hover:text-slate-700"}`;
        const inner = (
          <>
            {o.label}
            {o.count !== undefined && (
              <span className={`ml-1.5 tabular-nums ${on ? "text-slate-500" : "text-slate-400"}`}>{o.count}</span>
            )}
          </>
        );
        return o.href ? (
          <a
            key={o.value}
            href={o.href}
            data-on={on}
            aria-current={on ? "true" : undefined}
            aria-label={o.ariaLabel}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              if (!on) onChange(o.value);
            }}
            className={look}
          >
            {inner}
          </a>
        ) : (
          <button
            key={o.value}
            type="button"
            role="radio"
            data-on={on}
            aria-checked={on}
            aria-label={o.ariaLabel}
            onClick={() => {
              if (!on) onChange(o.value);
            }}
            className={look}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
