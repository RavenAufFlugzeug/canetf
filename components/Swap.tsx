"use client";

import { useEffect, useState } from "react";

// Words that change smoothly (the Risk rating's methodology and scale): when `id` changes, the
// old words fade and drift up as the new ones fade and rise in, stacked in the same place
// (.swap-out / .swap-in in globals.css, quick, to keep up with a pointer). The new words are
// the live children; the old, a copy kept from when they were shown. With motion reduced, they
// simply change.
const SWAP_MS = 200; // .swap-out

export default function Swap({ id, inline = false, children }: { id: number; inline?: boolean; children: React.ReactNode }) {
  const [shown, setShown] = useState({ id, node: children, n: 0 });
  const [leaving, setLeaving] = useState<{ node: React.ReactNode; n: number } | null>(null);
  if (id !== shown.id) {
    setLeaving(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : { node: shown.node, n: shown.n });
    setShown({ id, node: children, n: shown.n + 1 });
  }
  useEffect(() => {
    if (!leaving) return;
    const gone = window.setTimeout(() => setLeaving((l) => (l?.n === leaving.n ? null : l)), SWAP_MS);
    return () => window.clearTimeout(gone);
  }, [leaving]);
  return (
    <span className={`${inline ? "inline-grid" : "grid"} align-top`}>
      {leaving && (
        <span key={`out-${leaving.n}`} aria-hidden inert className="swap-out pointer-events-none col-start-1 row-start-1">
          {leaving.node}
        </span>
      )}
      <span key={`in-${shown.n}`} className={`col-start-1 row-start-1 ${shown.n ? "swap-in" : ""}`}>
        {children}
      </span>
    </span>
  );
}
