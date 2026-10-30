"use client";

import { useState } from "react";
import FoldButton from "@/components/FoldButton";
import KindMark from "@/components/KindMark";
import PickCards, { type PickCard } from "@/components/PickCards";
import SetComposition from "@/components/SetComposition";

// The picked set, before the test: what it is made of (SetComposition), always in view; then
// the picks themselves as cards (PickCards), folded away until asked for. Folded, a bar says
// how many there are, with a peek at their badges, and opens them (as does its Fold / Open
// button); open, they cascade in. Their pop-ups may reach past the bottom only once the fold
// has settled open.
export default function PickOverview({ cards }: { cards: PickCard[] }) {
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);

  function toggle() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSettled(calm && !open);
    setOpen(!open);
  }

  return (
    <div>
      <SetComposition cards={cards} />

      <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={toggle}
          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {/* A peek at the picks: the first few badges, fanned. */}
          <span className="flex shrink-0 -space-x-1.5" aria-hidden>
            {cards.slice(0, 5).map((c, i) => (
              <span
                key={c.symbol}
                className="kind-badge grid size-6 place-items-center rounded-md ring-2 ring-white"
                style={{
                  background: c.color,
                  color: c.mark,
                  ["--badge" as string]: c.color,
                  transitionDelay: `${i * 40}ms`,
                }}
              >
                <KindMark kind={c.kind} className="size-3.5" />
              </span>
            ))}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900">The picks, one by one</span>
            <span className="block truncate text-xs text-slate-500 transition group-hover:text-slate-900">
              {open
                ? "Point at a card for its figures today."
                : `${cards.length} cards with each one's industry, place and figures: open to see them.`}
            </span>
          </span>
        </button>
        <FoldButton open={open} controls="sandbox-pick-cards" onClick={toggle} className="text-xs" />
      </div>

      <div
        id="sandbox-pick-cards"
        className="legend-fold"
        data-closed={open ? undefined : ""}
        inert={!open}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && open) setSettled(true);
        }}
      >
        <div style={settled ? { overflow: "visible" } : undefined}>
          {/* Keyed by whether it is open, so the cards cascade in each time it opens. */}
          <PickCards key={String(open)} cards={cards} />
        </div>
      </div>
    </div>
  );
}
