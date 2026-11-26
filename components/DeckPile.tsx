"use client";

import { useState } from "react";
import { isPaletteName, paletteColor, type PaletteName } from "@/components/EtfBreakdown";
import DeckBack from "@/components/DeckBack";
import { DEFAULT_BACK, isDeckBack } from "@/lib/deckBack";
import { TAG } from "@/lib/ui";
import type { Strategy } from "@/lib/strategy";

// A deck's size: a little bigger than a card (the Sandbox's, 116 by 150).
export const DECK_W = Math.round(116 * 1.1);
export const DECK_H = Math.round(150 * 1.1);

// A deck's colour family (one of the Search charts', blue unless another is chosen; always red in
// a design other than Classic, which come in red only), and its colour: that family's main shade.
export const deckPalette = (s: Strategy): PaletteName =>
  deckBack(s) !== "classic" ? "red" : isPaletteName(s.palette) ? s.palette : "blue";
export const deckColor = (s: Strategy) => paletteColor(deckPalette(s));
// The colour of a deck's cards (their edge, suit and mark), as against its backs: the deck's own
// for Classic; purple for Hexerei, and for Teegesellschaft the green of the hills on its backs,
// deeper and richer (their backs being red).
const CARD_COLORS = { magic: "oklch(0.5 0.2 300)", "tea-party": "oklch(0.64 0.13 165)" };
export const cardColor = (s: Strategy) => {
  const back = deckBack(s);
  return back === "classic" ? deckColor(s) : CARD_COLORS[back];
};
// A deck's card design: its own, else Classic (decks kept from before have theirs filled in as
// they are read: withBack in lib/strategy.ts).
export const deckBack = (s: Strategy) => (isDeckBack(s.back) ? s.back : DEFAULT_BACK);

// A deck (on the Strategies page's shelf, or to bring into a Sandbox test): up to three card
// backs in its colour (the cat hiding behind a cup of coffee, surprised when the deck is pointed
// at, happy when it is clicked), stacked a little askew, the top one lifting when pointed at;
// under it, its name and how many cards it holds. The one chosen is ringed and tagged (`tag`).
export default function DeckPile({
  deck,
  open,
  onOpen,
  tag = "Open",
  disabled = false,
}: {
  deck: Strategy;
  open: boolean;
  onOpen: () => void;
  tag?: string;
  disabled?: boolean;
}) {
  const color = deckColor(deck);
  const layers = Math.min(Math.max(deck.rules.length, 1), 3);
  const cards = `${deck.rules.length} ${deck.rules.length === 1 ? "card" : "cards"}`;
  // Clicked, the cat on its cards is happy until the pointer leaves it.
  const [happy, setHappy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onOpen();
        setHappy(true);
      }}
      disabled={disabled}
      data-happy={happy || undefined}
      onPointerLeave={() => setHappy(false)}
      aria-pressed={open}
      aria-label={`${deck.name.trim() || "Untitled strategy"}: ${cards}`}
      className="deck-pile group flex w-36 flex-col items-center gap-2 focus-visible:outline-none disabled:cursor-default"
    >
      <span className="relative block" style={{ width: DECK_W, height: DECK_H }}>
        {Array.from({ length: layers }, (_, k) => layers - 1 - k).map((depth) => (
          <span
            key={depth}
            className="absolute inset-0"
            style={{ transform: `translate(${depth * 2.5}px, ${depth * 2.5}px) rotate(${depth * 1.5}deg)` }}
          >
            <span
              className={`absolute inset-0 rounded-xl transition-[translate,rotate,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                depth === 0
                  ? "motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-2"
                  : ""
              } ${depth === 0 && open ? "ring-2 ring-slate-900 ring-offset-2" : ""} ${
                depth === 0
                  ? "group-focus-visible:ring-2 group-focus-visible:ring-slate-400 group-focus-visible:ring-offset-2"
                  : ""
              }`}
            >
              <DeckBack color={color} design={deckBack(deck)} />
            </span>
          </span>
        ))}
        <span
          aria-hidden
          className={`pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 ${TAG} shadow transition-[opacity,scale] duration-(--fade) ease-[cubic-bezier(0.3,1.25,0.5,1)] ${
            open ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        >
          {tag}
        </span>
      </span>
      <span className="w-full text-center leading-tight">
        <span className="block truncate text-xs font-semibold text-slate-900">
          {deck.name.trim() || "Untitled strategy"}
        </span>
        <span className="text-[11px] text-slate-500">{cards}</span>
      </span>
    </button>
  );
}
