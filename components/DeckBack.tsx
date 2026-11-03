"use client";

import ClassicCardBack from "@/components/ClassicCardBack";
import StrategyCardBack from "@/components/StrategyCardBack";
import { useDeckBack, type DeckBackName } from "@/lib/deckBack";

// A card's back in the design chosen on the account page (or the one given, for previews):
// Classic or Tea Party, in the given colour.
export default function DeckBack({ color, design }: { color: string; design?: DeckBackName }) {
  const chosen = useDeckBack();
  return (design ?? chosen) === "tea-party" ? (
    <StrategyCardBack color={color} />
  ) : (
    <ClassicCardBack color={color} />
  );
}
