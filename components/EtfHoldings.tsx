"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSandboxEtfHoldingChart, getSandboxEtfHoldings, type EtfHolding } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import HoldingsMap from "@/components/HoldingsMap";
import KindMark from "@/components/KindMark";
import SandboxChart from "@/components/SandboxChart";
import type { EtfTreeNode } from "@/lib/db";

type Holdings = Awaited<ReturnType<typeof getSandboxEtfHoldings>>;
type Chart = Awaited<ReturnType<typeof getSandboxEtfHoldingChart>>;

const pct = (w: number) => `${(w * 100).toFixed(w < 0.1 ? 1 : 0)}%`;

// What an ETF in the Sandbox test holds, in its general info, drawn as the Holdings Map draws
// a fund (HoldingsMap): the fund on the left, its largest holdings (as listed today) branching
// off it, each a box in its sector's colour with its mark, named by its kind and number, never
// its real name or ticker (the test is blind), with its share of the fund; pointing at one
// shows its sector in the map's card. Clicking a company opens a pop-up with its price on the
// same chart as the picks' (HoldingChart). Asked for as the info opens, and again each new day.
export default function EtfHoldings({
  entry,
  day,
  name,
  country = null,
  replay = 0,
}: {
  entry: { symbol: string; from: string };
  day: number;
  name: string; // the fund as the test names it ("ETF (2)", or its alias)
  country?: string | null; // where the fund is listed, for its flag at the root (as the full map has)
  replay?: number; // changed to play the map's entrance again (as the info opens)
}) {
  const [data, setData] = useState<Holdings | "loading">("loading");
  const [open, setOpen] = useState<EtfHolding | null>(null);

  useEffect(() => {
    let live = true;
    getSandboxEtfHoldings(entry, day).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [entry.symbol, entry.from, day]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data === "loading")
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <DiamondLoader className="size-3" />
        Looking inside the fund…
      </p>
    );
  if (!data) return <p className="text-xs text-slate-500">No list of what this fund holds is on record.</p>;

  // The fund and its holdings, as the map's tree: no tickers, the hidden names as labels, and
  // only what each holding is (its sector and industry) and where it is from (its country, for
  // its flag, as the full Holdings Map shows it), never who. A fund held is a black fund box
  // holding its own holdings in turn (folded until opened), each fund with what its list
  // leaves out as "Other holdings". `byId` finds a box's holding again when it is clicked.
  const byId = new Map<string, EtfHolding>();
  const details = (h: EtfHolding) =>
    h.sector || h.kind === "ETF" || h.country || h.exchange
      ? {
          sector: h.sector,
          industry: h.industry,
          hqCity: null,
          hqCountry: h.country,
          fundFamily: null,
          category: null,
          exchange: h.exchange,
        }
      : null;
  const rest = (id: string, listed: number, at: number): EtfTreeNode[] =>
    1 - listed > 0.005
      ? [
          {
            id: `${id}.${at}`,
            kind: "other",
            label: "Other holdings", // as the full Holdings Map names the rest
            symbol: null,
            stored: false,
            missing: null,
            details: null,
            weight: 1 - listed,
            children: [],
          },
        ]
      : [];
  const nodesOf = (items: EtfHolding[], parent: string, ratings: boolean, listed: number): EtfTreeNode[] => [
    ...items.map((h, i): EtfTreeNode => {
      const id = `${parent}.${i}`;
      byId.set(id, h);
      return {
        id,
        kind: ratings ? "rating" : h.kind === "ETF" ? "fund" : "holding",
        label: h.name,
        symbol: null,
        stored: false,
        missing: null,
        details: ratings ? null : details(h),
        weight: h.weight,
        children: h.children ? nodesOf(h.children, id, Boolean(h.ratings), h.listed ?? 1) : [],
      };
    }),
    ...rest(parent, listed, items.length),
  ];
  const tree: EtfTreeNode = {
    id: "0",
    kind: "fund",
    label: name,
    symbol: null,
    stored: false,
    missing: null,
    details: country
      ? { sector: null, industry: null, hqCity: null, hqCountry: country, fundFamily: null, category: null, exchange: null }
      : null,
    weight: 1,
    children: nodesOf(data.items, "0", data.kind === "rating", data.listed),
  };
  const nested = data.items.some((h) => h.children?.length);

  return (
    <div className="text-fade-in">
      {/* Plainly: these are the holdings today, not as they were over the test. */}
      <p className="flex items-start gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200">
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="mt-px size-3.5 shrink-0"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 7.2v3.6M8 5.1v.1" />
        </svg>
        <span>
          <span className="font-semibold text-slate-900">Holdings as of today, not of your test&apos;s days.</span>{" "}
          {`Yahoo Finance only gives a fund's current list, so what it held over Day 1 to Day ${day} may have differed; the prices shown are from your test's days.`}
        </span>
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {data.kind === "rating"
          ? "Its bonds by credit rating."
          : `Its ${data.items.length} largest holdings (${pct(Math.min(data.listed, 1))} of the fund), their names hidden. Click a company or fund to see its price${
              nested ? "; open a fund's arrow to see what it holds" : ""
            }.`}
      </p>
      <div className="sandbox-map">
        <HoldingsMap
          key={replay}
          tree={tree}
          links={false}
          sectorKey={false}
          onPick={(id) => {
            const h = byId.get(id);
            if (h && !h.id.includes("r")) setOpen(h); // not a credit rating, which has no price
          }}
        />
      </div>
      {open && <HoldingChart holding={open} entry={entry} day={day} onClose={() => setOpen(null)} />}
    </div>
  );
}

// The pop-up for a holding: over the page, dimmed and softly blurred behind it, a card with its
// badge, hidden name and share of the fund, and its price on the same chart as the picks'
// (SandboxChart: its ranges, With history or Test only, pointing along it), without the 1D
// example day, which would need its ticker. It fades and rises in, and fades and sinks away
// when closed (the ×, Escape, or a click beside it).
function HoldingChart({
  holding,
  entry,
  day,
  onClose,
}: {
  holding: EtfHolding;
  entry: { symbol: string; from: string };
  day: number;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [chart, setChart] = useState<Chart | "loading">("loading");
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    if (leaving) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    window.setTimeout(onClose, calm ? 0 : 220);
  };

  useEffect(() => {
    let live = true;
    getSandboxEtfHoldingChart(entry, day, holding.id).then(
      (c) => live && setChart(c),
      () => live && setChart(null),
    );
    return () => {
      live = false;
    };
  }, [entry.symbol, entry.from, day, holding.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return createPortal(
    <div
      className={`fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-[3px] ${leaving ? "holding-out" : "holding-in"}`}
      onClick={close}
    >
      <div
        role="dialog"
        aria-label={`${holding.name}: its price`}
        onClick={(e) => e.stopPropagation()}
        className="holding-card kind-hover w-full max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            className="kind-badge grid size-11 shrink-0 place-items-center rounded-xl shadow-sm"
            style={{ background: holding.color, color: holding.mark, ["--badge" as string]: holding.color }}
          >
            <KindMark kind={holding.kind} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Held by the fund</p>
            <p className="text-lg font-semibold text-slate-900">{holding.name}</p>
            <p className="text-xs text-slate-500">
              {`${pct(holding.weight)} of the fund · not one of your picks, so it can't be traded here`}
            </p>
          </div>
          <button
            ref={button}
            type="button"
            onClick={close}
            aria-label="Close"
            className="group grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="size-3 transition-transform duration-300 group-hover:rotate-90"
            >
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
        <div className="min-h-64">
          {chart === "loading" ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <DiamondLoader className="size-3.5" />
              Loading its prices…
            </p>
          ) : chart ? (
            <div className="text-fade-in">
              <SandboxChart
                symbol={holding.id}
                exampleDay={false}
                history={chart.history}
                prices={chart.prices}
                yearStarts={chart.yearStarts}
              />
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">{"No prices on record for it over your test's days: it may not have been trading yet (the holdings shown are today's)."}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
