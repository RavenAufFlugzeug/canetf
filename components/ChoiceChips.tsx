"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useSandboxSwap } from "@/components/SandboxSwap";

type Choice = { key: string; label: string; href: string };

// A row of the Sandbox's choice chips (its timeframes, or its starting amounts), each a link
// to the Sandbox with that choice made. The chosen one sits on a dark pill; choosing another
// slides the pill across to it at once while the area the choice changes (`swaps`, the key
// of a Swap) fades, and the page then moves to the new address. The others lift a touch
// when pointed at. A link opened elsewhere (a new tab, say) is left to the browser.
export default function ChoiceChips({
  choices,
  chosen,
  swaps,
  label,
}: {
  choices: Choice[];
  chosen?: string;
  swaps: string;
  label: string;
}) {
  const { change } = useSandboxSwap();
  // The choice just clicked, shown chosen before the page catches up.
  const [clicked, setClicked] = useState<string | null>(null);
  const [lastChosen, setLastChosen] = useState(chosen);
  if (chosen !== lastChosen) {
    setLastChosen(chosen);
    setClicked(null);
  }
  const shown = clicked ?? chosen;

  // The pill: where the chosen chip is, measured once laid out (until then, the chosen chip
  // is dark itself). It slides only once it has been placed.
  const list = useRef<HTMLUListElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number; placed: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const place = () => {
      // Where its item sits in the row (the chip itself sits at the item's corner).
      const chip = el.querySelector<HTMLElement>(`[data-choice="${shown}"]`);
      const item = chip?.parentElement;
      setPill((old) =>
        chip && item
          ? {
              x: item.offsetLeft + chip.offsetLeft,
              y: item.offsetTop + chip.offsetTop,
              w: chip.offsetWidth,
              h: chip.offsetHeight,
              placed: old !== null,
            }
          : null,
      );
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  function choose(event: React.MouseEvent, choice: Choice) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (choice.key === shown) return;
    setClicked(choice.key);
    change(swaps, () => choice.href);
  }

  return (
    <ul ref={list} aria-label={label} className="relative mt-3 flex flex-wrap gap-2">
      {pill && (
        <li
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 rounded-full bg-slate-900 ${
            pill.placed ? "transition-[translate,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""
          }`}
          style={{ translate: `${pill.x}px ${pill.y}px`, width: pill.w, height: pill.h }}
        />
      )}
      {choices.map((choice) => {
        const on = choice.key === shown;
        return (
          <li key={choice.key} className="relative">
            <a
              href={choice.href}
              data-choice={choice.key}
              aria-current={on ? "true" : undefined}
              onClick={(event) => choose(event, choice)}
              className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                on
                  ? `border-slate-900 text-white ${pill ? "" : "bg-slate-900"}`
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm motion-safe:hover:-translate-y-0.5"
              }`}
            >
              {choice.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
