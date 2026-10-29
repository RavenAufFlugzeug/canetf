"use client";

import DiamondLoader from "@/components/DiamondLoader";
import { useSandboxSwap } from "@/components/SandboxSwap";
import { newSeed, sandboxHref } from "@/lib/sandbox";

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
  count,
}: {
  current?: string;
  range: string;
  amount: number;
  count: number;
}) {
  const { pending, leaving, change } = useSandboxSwap();
  const picking = pending && leaving === (current ?? "none");

  return (
    <button
      type="button"
      onClick={() => change(current ?? "none", () => sandboxHref({ range, amount, count, seed: newSeed() }))}
      disabled={pending}
      aria-busy={picking}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 enabled:active:scale-95 disabled:cursor-wait ${
        current
          ? "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md hover:shadow-slate-300/60"
          : "bg-slate-900 text-white shadow-sm hover:bg-slate-700 hover:shadow-lg hover:shadow-slate-900/25"
      }`}
    >
      {picking ? <DiamondLoader className="size-3.5" /> : <ShuffleMark />}
      {current ? "Pick a new set" : `Pick ${count} companies & ETFs`}
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
