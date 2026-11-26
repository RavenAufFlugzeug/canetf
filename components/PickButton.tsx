"use client";

import DiamondLoader from "@/components/DiamondLoader";
import FadeText from "@/components/FadeText";
import { useSandboxSwap } from "@/components/SandboxSwap";
import { newSeed, sandboxHref, type Monthly } from "@/lib/sandbox";
import { button } from "@/lib/ui";

// The Sandbox's button for a random set of `count` companies and ETFs, keeping the timeframe
// and starting amount chosen; `current` is the set shown now (the key of the area below it),
// if any. It goes to the address of a new set (a new seed: the page picks its listings), so
// the page stays in place and only what is below changes; meanwhile the current set fades
// (Swap) and the button shows the loading mark. Pointed at, it lifts with a shadow, and the
// two arrows of its shuffle mark slide on and cross a little further; pressed, it sinks.
export default function PickButton({
  current,
  range,
  amount,
  monthly,
  count,
}: {
  current?: string;
  range: string;
  amount: number;
  monthly: Monthly;
  count: number;
}) {
  const { pending, leaving, change } = useSandboxSwap();
  const picking = pending && leaving === (current ?? "none");

  return (
    <button
      type="button"
      onClick={() => change(current ?? "none", () => sandboxHref({ range, amount, monthly, count, seed: newSeed() }))}
      disabled={pending}
      aria-busy={picking}
      className={`group shrink-0 disabled:cursor-wait ${button(current ? "secondary" : "primary")}`}
    >
      {picking ? <DiamondLoader className="size-3.5" /> : <ShuffleMark />}
      {/* Its words cross-fade when they change (a new number, or a set picked). */}
      <FadeText inline text={current ? "Regenerate universe" : "Generate universe"} />
    </button>
  );
}

// Two arrows crossing, as for shuffling: pointed at, each slides on along its way.
function ShuffleMark() {
  const slide =
    "transition-transform duration-300 ease-out motion-safe:group-enabled:group-hover:translate-x-[1.5px]";
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M3 14h2.5c1.6 0 2.6-.7 3.5-2l2-4c.9-1.3 1.9-2 3.5-2H16" />
      <path d="M3 6h2.5c1.2 0 2 .4 2.7 1.1M11.8 12.9c.7.7 1.5 1.1 2.7 1.1H16" />
      <path className={slide} d="m14 4 2 2-2 2" />
      <path className={slide} d="m14 12 2 2-2 2" />
    </svg>
  );
}
