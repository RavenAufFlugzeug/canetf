"use client";

import { useState } from "react";
import SlideTabs from "@/components/SlideTabs";
import { useSandboxSwap } from "@/components/SandboxSwap";

type Choice = { key: string; label: string; href: string };

// A row of the Sandbox's choices (its timeframes, or its starting amounts), each a link to the
// Sandbox with that choice made, on the site's switch (SlideTabs). Choosing another slides
// the pill across to it at once while the area the choice changes (`swaps`, the key of a
// Swap) fades, and the page then moves to the new address. A link opened elsewhere (a new
// tab, say) is left to the browser.
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

  return (
    <SlideTabs
      label={label}
      className="mt-3"
      value={clicked ?? chosen ?? ""}
      options={choices.map((c) => ({ value: c.key, label: c.label, href: c.href }))}
      onChange={(key) => {
        const choice = choices.find((c) => c.key === key);
        if (!choice) return;
        setClicked(key);
        change(swaps, () => choice.href);
      }}
    />
  );
}
