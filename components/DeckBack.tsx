"use client";

import { createContext, useContext } from "react";
import ClassicCardBack, { Fish } from "@/components/ClassicCardBack";
import MagicCardBack, { Sparkle } from "@/components/MagicCardBack";
import StrategyCardBack, { Clover } from "@/components/StrategyCardBack";
import { paletteColor } from "@/components/EtfBreakdown";
import { DEFAULT_BACK, type DeckBackName } from "@/lib/deckBack";

// The design for the card backs and suits inside it, where they don't name one, and the colour for
// its backs if it has one (the Sandbox's cards take the strategy's brought into the test; without
// one, each back keeps its own colour).
type DesignAround = { back: DeckBackName; color?: string };
const Design = createContext<DesignAround>({ back: DEFAULT_BACK });
export const DeckDesign = Design.Provider;

// The only colour the designs other than Classic come in.
const RED = paletteColor("red");

// A card's back in its deck's design (Classic, Teegesellschaft or Hexerei): Classic in the given
// colour (or the one round it), the others always red.
export default function DeckBack({ color, design }: { color: string; design?: DeckBackName }) {
  const around = useContext(Design);
  const back = design ?? around.back;
  if (back === "tea-party") return <StrategyCardBack color={RED} />;
  if (back === "magic") return <MagicCardBack color={RED} />;
  return <ClassicCardBack color={design ? color : (around.color ?? color)} />;
}

// A card face's "suit", under the rank in its corners, matching its deck's back: a fish for
// Classic, a four-leaf clover for Teegesellschaft, a sparkle for Hexerei, in the given colour.
export function Suit({ color, design }: { color: string; design?: DeckBackName }) {
  const around = useContext(Design);
  const back = design ?? around.back;
  if (back === "tea-party") return <Clover color={color} className="mt-0.5 size-3.5" />;
  if (back === "magic") return <Sparkle color={color} className="mt-0.5 size-3.5" />;
  return <Fish color={color} className="mt-0.5 h-3 w-[18px]" />;
}
