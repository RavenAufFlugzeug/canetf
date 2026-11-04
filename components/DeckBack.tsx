"use client";

import ClassicCardBack, { Fish } from "@/components/ClassicCardBack";
import StrategyCardBack, { Clover } from "@/components/StrategyCardBack";
import { useDeckBack, type DeckBackName } from "@/lib/deckBack";

// A card's back in the design chosen on the account page (or the one given, for previews):
// Classic or Teegesellschaft, in the given colour.
export default function DeckBack({ color, design }: { color: string; design?: DeckBackName }) {
  const chosen = useDeckBack();
  return (design ?? chosen) === "tea-party" ? (
    <StrategyCardBack color={color} />
  ) : (
    <ClassicCardBack color={color} />
  );
}

// A card face's "suit", under the rank in its corners, matching the chosen back's corners: a
// fish for Classic, a four-leaf clover for Teegesellschaft, in the given colour.
export function Suit({ color }: { color: string }) {
  return useDeckBack() === "tea-party" ? (
    <Clover color={color} className="mt-0.5 size-3.5" />
  ) : (
    <Fish color={color} className="mt-0.5 h-3 w-[18px]" />
  );
}
