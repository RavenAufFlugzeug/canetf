"use client";

import { pickForSandbox } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import { useSandboxSwap } from "@/components/SandboxSwap";

// The Sandbox's button for a random company or ETF, keeping the timeframe and starting
// amount chosen; `current` is the pick shown now (the key of the area below it), if any. It
// asks the server for a pick and goes straight to its address, so the page stays in place
// and only what is below the pick changes (going through an address that redirects to the
// pick would rebuild the whole page). Meanwhile the current pick's details fade (Swap) and
// the button shows the loading mark.
export default function PickButton({
  current,
  range,
  amount,
}: {
  current?: string;
  range?: string;
  amount?: number;
}) {
  const { pending, leaving, change } = useSandboxSwap();
  const picking = pending && leaving === (current ?? "none");

  return (
    <button
      type="button"
      onClick={() => change(current ?? "none", () => pickForSandbox(range, amount, current))}
      disabled={pending}
      aria-busy={picking}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-wait ${
        current
          ? "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
          : "bg-slate-900 text-white hover:bg-slate-700"
      }`}
    >
      {picking ? <DiamondLoader className="size-3.5" /> : current && <span aria-hidden>↻</span>}
      {current ? "Pick another" : "Pick a company or ETF"}
    </button>
  );
}
