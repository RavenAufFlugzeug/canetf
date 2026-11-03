"use client";

import { useState } from "react";
import DeckBack from "@/components/DeckBack";
import { DECK_BACKS, saveDeckBack, useDeckBack } from "@/lib/deckBack";

// The account page's choice of deck back, used by every deck on the site: each design as a small
// card (a deck of its own, so the cat on it is surprised when it is pointed at, and happy once it
// is clicked, until the pointer leaves, as on the decks), its name under it. The one chosen is
// ringed and tagged "In use".
const PREVIEW = "oklch(0.58 0.19 25)";

export default function DeckBackPicker() {
  const chosen = useDeckBack();
  // The design last clicked, its cat happy until the pointer leaves it.
  const [happy, setHappy] = useState<string | null>(null);
  return (
    <div role="radiogroup" aria-label="Deck back" className="mt-5 flex flex-wrap gap-6">
      {DECK_BACKS.map(({ value, label }) => {
        const on = chosen === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              saveDeckBack(value);
              setHappy(value);
            }}
            data-happy={happy === value || undefined}
            onPointerLeave={() => setHappy((h) => (h === value ? null : h))}
            className="deck-pile group flex flex-col items-center gap-2 focus-visible:outline-none"
          >
            <span className="relative block h-[150px] w-[116px]">
              <span
                className={`absolute inset-0 rounded-xl transition-[translate,rotate,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-2 group-focus-visible:ring-2 group-focus-visible:ring-slate-400 group-focus-visible:ring-offset-2 ${
                  on ? "ring-2 ring-slate-900 ring-offset-2" : ""
                }`}
              >
                <DeckBack color={PREVIEW} design={value} />
              </span>
              <span
                aria-hidden
                className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide whitespace-nowrap text-white shadow transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
                  on ? "scale-100 opacity-100" : "scale-75 opacity-0"
                }`}
              >
                In use
              </span>
            </span>
            <span className={`text-sm ${on ? "font-semibold text-slate-900" : "text-slate-600"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
