"use client";

import ClassicCardBack, { Fish } from "@/components/ClassicCardBack";
import MagicCardBack, { Sparkle } from "@/components/MagicCardBack";
import StrategyCardBack, { Clover } from "@/components/StrategyCardBack";
import { useDeckBack, type DeckBackName } from "@/lib/deckBack";

// A card's back in the design chosen on the account page (or the one given, for previews):
// Classic, Teegesellschaft or Magic, in the given colour.
export default function DeckBack({ color, design }: { color: string; design?: DeckBackName }) {
  const chosen = useDeckBack();
  const back = design ?? chosen;
  if (back === "tea-party") return <StrategyCardBack color={color} />;
  if (back === "magic") return <MagicCardBack color={color} />;
  return <ClassicCardBack color={color} />;
}

// A card face's "suit", under the rank in its corners, matching the chosen back's corners: a
// fish for Classic, a four-leaf clover for Teegesellschaft, a sparkle for Magic, in the given
// colour.
export function Suit({ color }: { color: string }) {
  const back = useDeckBack();
  if (back === "tea-party") return <Clover color={color} className="mt-0.5 size-3.5" />;
  if (back === "magic") return <Sparkle color={color} className="mt-0.5 size-3.5" />;
  return <Fish color={color} className="mt-0.5 h-3 w-[18px]" />;
}
