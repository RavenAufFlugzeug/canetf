"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useLayoutEffect, useRef, useState, useTransition } from "react";
import DiamondLoader from "@/components/DiamondLoader";

// How long a swapped area takes to fade out (.sandbox-swap in globals.css): a change waits
// at least this long, so the old contents always fade out fully before the new come in.
const FADE_MS = 260;
// How long a swapped area takes to ease to its new height.
const RESIZE_MS = 500;

type SandboxSwap = {
  pending: boolean;
  // Whether a choice has been changed since the page opened: what comes in after one comes in
  // whole and quickly (a fade), not by the slower first entrances.
  changed: boolean;
  // The area being left (its key), from the click until its new contents are in.
  leaving: string | null;
  // Leaves the area `from` for the address `to` gives (a new pick, timeframe or amount).
  change: (from: string, to: () => Promise<string | null> | string) => void;
};

const SwapContext = createContext<SandboxSwap | null>(null);

// Shares a change in progress between the Sandbox's controls (PickButton, ChoiceChips) and
// the areas that change with them (Swap): set round them all. A change fades the area it
// replaces, goes to the new address (so the page stays in place; only what is keyed anew
// changes) and keeps the area faded until the new contents are in.
export function SandboxSwapProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  function change(from: string, to: () => Promise<string | null> | string) {
    setLeaving(from);
    setChanged(true);
    startTransition(async () => {
      const [href] = await Promise.all([to(), new Promise((done) => window.setTimeout(done, FADE_MS))]);
      if (href) router.replace(href, { scroll: false });
      else setLeaving(null);
    });
  }

  return (
    <SwapContext.Provider value={{ pending, leaving, changed, change }}>{children}</SwapContext.Provider>
  );
}

// Whether a choice has been changed since the page opened (false outside the Sandbox).
export function useSwapChanged() {
  return useContext(SwapContext)?.changed ?? false;
}

export function useSandboxSwap() {
  const swap = useContext(SwapContext);
  if (!swap) throw new Error("useSandboxSwap needs a SandboxSwapProvider round it");
  return swap;
}

// A part of the Sandbox that changes with a choice, for the choices `swapKey` names (the pick,
// say, or the test's timeframe and amount). On a change it goes smoothly: the moment the
// choice is made, the old contents fade, soften and sink a little while the new ones are
// fetched (a small loading mark showing if that takes a while); then the new contents fade
// and rise in out of the same softness (.sandbox-swap-in), as the area eases to its new
// height (EaseHeight), rather than anything snapping or what is below it jumping. The first
// contents, as the page opens, come in by their own entrances alone.
export function Swap({ swapKey, children }: { swapKey: string; children: React.ReactNode }) {
  const { leaving } = useSandboxSwap();
  const [first] = useState(swapKey);
  const out = leaving === swapKey;
  return (
    <EaseHeight changeKey={swapKey}>
      <div className="relative">
        {/* Keyed, so the new contents are fresh, fading in rather than back from the old. */}
        <div
          key={swapKey}
          className={`sandbox-swap ${swapKey !== first ? "sandbox-swap-in" : ""}`}
          data-leaving={out ? "" : undefined}
        >
          {children}
        </div>
        {/* While the new contents are fetched: a loading mark over the old, after a moment
            (so a quick change doesn't flash it). */}
        {out && (
          <span
            aria-hidden
            className="swap-wait pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-white/90 p-2 shadow-md ring-1 ring-slate-200"
          >
            <DiamondLoader className="size-4" />
          </span>
        )}
      </div>
    </EaseHeight>
  );
}

// A box whose contents change wholesale with `changeKey` (a Swap's, or the Sandbox test's
// stage): it eases from its old height to its new one (over `duration` ms) rather than
// jumping, so what is below it glides. While it eases, it clips what spills over its edges; otherwise it doesn't, so a
// hover card can reach past its foot.
export function EaseHeight({
  changeKey,
  duration = RESIZE_MS,
  children,
}: {
  changeKey: string;
  duration?: number;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Its height as last laid out: the old contents', when the new ones come in.
  const height = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => (height.current = el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // New contents: ease from the old height to the new one.
  useLayoutEffect(() => {
    const el = box.current;
    const start = height.current;
    if (!el || start === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.height = "";
    const end = el.offsetHeight;
    if (Math.abs(end - start) < 1) return;
    el.style.height = `${start}px`;
    el.style.overflow = "clip";
    el.getBoundingClientRect(); // apply the starting height before easing to the new one
    el.style.transition = `height ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    el.style.height = `${end}px`;
    const done = window.setTimeout(() => {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
    }, duration);
    return () => window.clearTimeout(done);
  }, [changeKey, duration]);

  return <div ref={box}>{children}</div>;
}
