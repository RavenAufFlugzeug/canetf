"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSandboxDates } from "@/app/actions/sandbox";

// Whether the Sandbox's set was chosen by hand, when nothing about it is hidden (its names, its
// holdings' names and its dates); and if so, each pick's dates, read once (getSandboxDates):
// those before Day 1 its history covers, and Day 1 on. A random set's test stays blind: no
// dates are read for it.
export type PickDates = { before: string[]; during: string[] };
type Open = { open: boolean; dates: Record<string, PickDates> | null };
const OpenContext = createContext<Open>({ open: false, dates: null });

export function SandboxOpen({
  open,
  entries,
  days,
  children,
}: {
  open: boolean;
  entries: { symbol: string; from: string }[];
  days: number;
  children: React.ReactNode;
}) {
  const [dates, setDates] = useState<Record<string, PickDates> | null>(null);
  const key = entries.map((e) => `${e.symbol}@${e.from}`).join(",");
  useEffect(() => {
    if (!open || !entries.length) return;
    let live = true;
    getSandboxDates(entries, days).then(
      (d) => live && setDates(d),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [open, key, days]); // eslint-disable-line react-hooks/exhaustive-deps
  return <OpenContext.Provider value={{ open, dates: open ? dates : null }}>{children}</OpenContext.Provider>;
}

export function useSandboxOpen() {
  return useContext(OpenContext);
}

// The date of Day `d` (Day 1 the test's first; 0 and below the days before it) in a pick's
// dates, or null where they don't reach.
export function dateOf(dates: PickDates | null | undefined, d: number): string | null {
  if (!dates) return null;
  return (d >= 1 ? dates.during[d - 1] : dates.before[dates.before.length - 1 + d]) ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// A date written out ("Mar 4, 2019"), or shorter for a chart's axis: by month ("Mar 2019")
// when its labels are a month or more apart, by year when a year or more.
export function dateText(iso: string, step = 1) {
  const [y, m, d] = iso.split("-").map(Number);
  if (step >= 252) return String(y);
  if (step >= 21) return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
