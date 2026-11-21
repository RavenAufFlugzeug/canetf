"use client";

import { useEffect, useRef, useState } from "react";
import { getSandboxEtfHoldingChart, getSandboxEtfHoldings, type EtfHolding } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import HoldingsMap from "@/components/HoldingsMap";
import KindMark from "@/components/KindMark";
import SandboxChart from "@/components/SandboxChart";
import type { EtfTreeNode } from "@/lib/db";
import Popup, { usePopupClose } from "@/components/Popup";
import { LABEL, SECTION_TITLE } from "@/lib/ui";
import CloseButton from "@/components/CloseButton";

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
      ? {
          sector: null,
          industry: null,
          hqCity: null,
          hqCountry: country,
          fundFamily: null,
          category: null,
          exchange: null,
        }
      : null,
    weight: 1,
    children: nodesOf(data.items, "0", data.kind === "rating", data.listed),
  };

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
          <span className="font-semibold text-slate-900">
            Holdings shown are current, not as of the test period.
          </span>{" "}
          {`Yahoo Finance publishes only a fund's latest holdings, so its composition between Day 1 and Day ${day} may have differed. Prices reflect the test period.`}
        </span>
      </p>
      <div className="sandbox-map">
        <HoldingsMap
          key={replay}
          tree={tree}
          links={false}
          sectorKey={false}
          legend={false}
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
  const { leaving, close } = usePopupClose(onClose);
  const [chart, setChart] = useState<Chart | "loading">("loading");
  const button = useRef<HTMLButtonElement>(null);

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

  return (
    <Popup
      label={`${holding.name}: its price`}
      leaving={leaving}
      onClose={close}
      initialFocus={button}
      className="kind-hover my-8 max-w-2xl p-5"
    >
      <div className="flex items-start gap-3">
        <span
          className="kind-badge grid size-11 shrink-0 place-items-center rounded-full shadow-sm"
          style={{ background: holding.color, color: holding.mark, ["--badge" as string]: holding.color }}
        >
          <KindMark kind={holding.kind} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${LABEL}`}>Held by the fund</p>
          <p className={SECTION_TITLE}>{holding.name}</p>
          <p className="text-xs text-slate-500">
            {`${pct(holding.weight)} of the fund · not one of your picks, so it can't be traded here`}
          </p>
        </div>
        <CloseButton ref={button} onClick={close} />
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
          <p className="mt-6 text-sm text-slate-500">
            {
              "No prices on record for it over your test's days: it may not have been trading yet (the holdings shown are today's)."
            }
          </p>
        )}
      </div>
    </Popup>
  );
}
