"use client";

import { useEffect, useRef, useState } from "react";
import KindMark from "@/components/KindMark";
import { EaseHeight } from "@/components/SandboxSwap";
import Tween from "@/components/Tween";
import { LISTING_KINDS as KINDS } from "@/lib/kinds";
import { countryFlag } from "@/lib/fx";
import { moneyFormatter } from "@/lib/money";
import { NAICS_GROUPS } from "@/lib/naics";

export type BoardPick = {
  symbol: string;
  name: string; // as shown: its alias, or its kind and number
  kind: string;
  color: string;
  ink: string;
  currency: string | null; // what it trades in
  price: number; // in that currency
  rate: number; // CAD for one unit of that currency today (1 for CAD), to compare across them
  move: number | null; // the day's change of its price, in percent (null on the first day)
  cadMove: number | null; // the same with its exchange rate's move too: its change in CAD
  held: number; // shares held
  naics: string | null; // its NAICS group's code (null for a fund or one unknown)
  country: string | null; // where it is from (a company's base, a fund's listing), for its flag
  fund: boolean;
};

type Status = "all" | "held" | "up" | "down";
const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "held", label: "Held" },
  { value: "up", label: "Rising" },
  { value: "down", label: "Falling" },
];

type Type = "all" | "companies" | "etfs";
const TYPES: { value: Type; label: string }[] = [
  { value: "all", label: "All" },
  { value: "companies", label: "Companies" },
  { value: "etfs", label: "ETFs" },
];

type Sort = "default" | "price-desc" | "price-asc" | "move-desc" | "move-asc" | "value-desc" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "default", label: "Universe order" },
  { value: "name", label: "Name, A to Z" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "move-desc", label: "Day change, best first" },
  { value: "move-asc", label: "Day change, worst first" },
  { value: "value-desc", label: "Position value, largest first" },
];

type View = "grid" | "list";

// How long the board takes to fade out when the filters change, before it shows the new ones.
const FADE_MS = 170;

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const moneyText = (x: number) => money.format(x);
// Whether a listing trades in another currency than CAD (its CAD price and change are shown too).
const foreign = (p: BoardPick) => Boolean(p.currency && p.currency !== "CAD");
// A price in the currency it trades in: as money for CAD; else the figure alone, with that
// currency's decimals (its code is shown beside it).
const priceText = (x: number, currency: string | null) => {
  if (!currency || currency === "CAD") return moneyText(x);
  const { decimals } = moneyFormatter(currency);
  return x.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const pctText = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}%`;
const tone = (x: number) => (x > 0 ? "text-green-700" : x < 0 ? "text-red-600" : "text-slate-500");
const labelOf = (kind: string) => KINDS.find((k) => k.kind === kind)?.label ?? "Other";

const segment = (on: boolean) =>
  `rounded-md px-2.5 py-1 text-xs font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
    on ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-white hover:text-slate-900"
  }`;

// The Sandbox test's investment universe: every listing in the set, to choose the one to
// trade. Narrowed by a search (name, alias or sector), by what is held or how it moved today,
// by type (companies or ETFs), by sector (its mark) and by NAICS group (its colour), each of
// those two a menu of every one there is, with what the one chosen means beside it; ordered as chosen (by name, price, today's move or position value). The
// filters in use are listed as tokens, each removable on its own. Shown as cards (Grid) or
// as rows of a table (List, the default), whose column headings sort it too; the board scrolls when it
// doesn't fit. The chosen listing stays chosen while filtered out of view.
export default function PickBoard({
  picks,
  chosen,
  onChoose,
}: {
  picks: BoardPick[];
  chosen: string;
  onChoose: (symbol: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [type, setType] = useState<Type>("all");
  // The sector (a kind of mark) and the NAICS group to show, or every one.
  const [sector, setSector] = useState("all");
  const [naics, setNaics] = useState("all");
  const [sort, setSort] = useState<Sort>("default");
  const [view, setView] = useState<View>("list");
  // The filters the board shows, which follow the ones chosen once the board has faded out (so
  // a change fades the old listings out and the new ones in, rather than jumping).
  const chosenKey = JSON.stringify({ query, status, type, sector, naics, sort });
  const [applied, setApplied] = useState({ query, status, type, sector, naics, sort });
  const appliedKey = JSON.stringify(applied);
  const changing = appliedKey !== chosenKey;
  useEffect(() => {
    if (!changing) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = window.setTimeout(() => setApplied(JSON.parse(chosenKey)), calm ? 0 : FADE_MS);
    return () => window.clearTimeout(wait);
  }, [chosenKey, changing]);

  const words = query.trim().toLowerCase();
  const matchesStatus = (p: BoardPick, s: Status) =>
    s === "all" ||
    (s === "held" && p.held > 0) ||
    (s === "up" && (p.move ?? 0) > 0) ||
    (s === "down" && (p.move ?? 0) < 0);
  const matchesType = (p: BoardPick, t: Type) =>
    t === "all" || (t === "etfs" ? p.kind === "ETF" : p.kind !== "ETF");
  const seek = applied.query.trim().toLowerCase();
  const shown = picks
    .filter(
      (p) =>
        (!seek ||
          p.name.toLowerCase().includes(seek) ||
          labelOf(p.kind).toLowerCase().includes(seek) ||
          (KINDS.find((k) => k.kind === p.kind)
            ?.from.toLowerCase()
            .includes(seek) ??
            false)) &&
        matchesStatus(p, applied.status) &&
        matchesType(p, applied.type) &&
        (applied.sector === "all" || p.kind === applied.sector) &&
        (applied.naics === "all" || p.naics === applied.naics),
    )
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const by =
        applied.sort === "name"
          ? a.p.name.localeCompare(b.p.name, "en", { numeric: true })
          : applied.sort === "price-desc"
            ? b.p.price * b.p.rate - a.p.price * a.p.rate
            : applied.sort === "price-asc"
              ? a.p.price * a.p.rate - b.p.price * b.p.rate
              : applied.sort === "move-desc"
                ? (b.p.move ?? 0) - (a.p.move ?? 0)
                : applied.sort === "move-asc"
                  ? (a.p.move ?? 0) - (b.p.move ?? 0)
                  : applied.sort === "value-desc"
                    ? b.p.held * b.p.price * b.p.rate - a.p.held * a.p.price * a.p.rate
                    : 0;
      return by || a.i - b.i;
    })
    .map(({ p }) => p);

  // The filters in use, as tokens to remove one by one.
  const tokens: { key: string; label: string; clear: () => void }[] = [
    ...(words ? [{ key: "q", label: `“${query.trim()}”`, clear: () => setQuery("") }] : []),
    ...(status !== "all"
      ? [{ key: "s", label: STATUSES.find((s) => s.value === status)!.label, clear: () => setStatus("all") }]
      : []),
    ...(type !== "all"
      ? [{ key: "t", label: TYPES.find((t) => t.value === type)!.label, clear: () => setType("all") }]
      : []),
    ...(sector !== "all" ? [{ key: "k", label: labelOf(sector), clear: () => setSector("all") }] : []),
    ...(naics !== "all"
      ? [
          {
            key: "n",
            label: `NAICS ${naics.replace("-", "\u2013")}`,
            clear: () => setNaics("all"),
          },
        ]
      : []),
  ];
  const clear = () => {
    setQuery("");
    setStatus("all");
    setType("all");
    setSector("all");
    setNaics("all");
  };
  // A table heading that sorts by its column (and back to the universe's order).
  const heading = (label: string, down: Sort, up: Sort | null, align = "text-right") => {
    const on = sort === down || sort === up;
    return (
      <th className={`px-2 py-1.5 font-medium ${align}`}>
        <button
          type="button"
          onClick={() => setSort(sort === down && up ? up : sort === up ? "default" : down)}
          className={`inline-flex items-center gap-1 transition hover:text-slate-900 ${on ? "text-slate-900" : ""}`}
        >
          {label}
          <span aria-hidden className={`text-[9px] transition ${on ? "opacity-100" : "opacity-0"}`}>
            {sort === up ? "▲" : "▼"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* A search, and how to show the board. */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search the universe</span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500"
          >
            <path d="M8.5 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10ZM12.2 12.2 16.5 16.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, alias or sector"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </label>
        <SortMenu value={sort} onChange={setSort} />
        <div role="group" aria-label="View" className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={v === "grid" ? "Show as cards" : "Show as a list"}
              onClick={() => setView(v)}
              className={`${segment(view === v)} px-2`}
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="size-3.5"
              >
                {v === "grid" ? (
                  <path
                    d="M2.5 2.5h4.5V7H2.5ZM9 2.5h4.5V7H9ZM2.5 9h4.5v4.5H2.5ZM9 9h4.5v4.5H9Z"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path d="M2.5 4h11M2.5 8h11M2.5 12h11" strokeLinecap="round" />
                )}
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* What to show: what is held or how it moved, and what type. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Show</span>
          <div role="group" aria-label="Show" className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={status === s.value}
                onClick={() => setStatus(s.value)}
                className={segment(status === s.value)}
              >
                {s.label}
                <span
                  className={`ml-1 tabular-nums ${status === s.value ? "text-white/70" : "text-slate-500"}`}
                >
                  {picks.filter((p) => matchesStatus(p, s.value) && matchesType(p, type)).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Type</span>
          <div role="group" aria-label="Type" className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() => setType(t.value)}
                className={segment(type === t.value)}
              >
                {t.label}
                <span
                  className={`ml-1 tabular-nums ${type === t.value ? "text-white/70" : "text-slate-500"}`}
                >
                  {picks.filter((p) => matchesType(p, t.value) && matchesStatus(p, status)).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sector (the mark: Yahoo Finance's sector) and NAICS group (the colour), each a menu of
          every one there is, with how many listings the other filters leave in it; beside each,
          what the one chosen means. */}
      {(() => {
        const others = (p: BoardPick) => matchesStatus(p, status) && matchesType(p, type);
        const kindInfo = KINDS.find((k) => k.kind === sector);
        const group = NAICS_GROUPS.find((g) => g.code === naics);
        return (
          <div className="mt-2 grid gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Sector
              </span>
              <FilterMenu
                label="Sector"
                value={sector}
                onChange={setSector}
                options={[
                  {
                    value: "all",
                    label: "All sectors",
                    hint: "Every kind of listing",
                    count: picks.filter((p) => others(p) && (naics === "all" || p.naics === naics)).length,
                  },
                  ...KINDS.map((k) => {
                    return {
                      value: k.kind,
                      label: k.label,
                      hint: k.from,
                      count: picks.filter(
                        (p) => p.kind === k.kind && others(p) && (naics === "all" || p.naics === naics),
                      ).length,
                      swatch: (
                        // The mark alone, without colour: colour is the NAICS group's (the other menu).
                        <span className="kind-badge grid size-5 shrink-0 place-items-center rounded-md bg-white text-slate-800 ring-1 ring-slate-200">
                          <KindMark kind={k.kind} className="size-3" />
                        </span>
                      ),
                    };
                  }),
                ]}
              />
              <p
                key={sector}
                className="text-fade-in min-w-0 flex-1 truncate text-[11px] text-slate-500"
                title={kindInfo?.about}
              >
                {kindInfo
                  ? `${kindInfo.from}: ${kindInfo.about}`
                  : "The mark: each listing's sector, as Yahoo Finance gives it."}
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                NAICS
              </span>
              <FilterMenu
                label="NAICS group"
                value={naics}
                onChange={setNaics}
                options={[
                  {
                    value: "all",
                    label: "All groups",
                    hint: "Every NAICS group",
                    count: picks.filter((p) => others(p) && (sector === "all" || p.kind === sector)).length,
                  },
                  ...NAICS_GROUPS.map((g) => ({
                    value: g.code,
                    label: g.code.replace("-", "\u2013"),
                    hint: g.name,
                    count: picks.filter(
                      (p) => p.naics === g.code && others(p) && (sector === "all" || p.kind === sector),
                    ).length,
                    swatch: <span className="size-4 shrink-0 rounded" style={{ background: g.color }} />,
                  })),
                ]}
              />
              <p
                key={naics}
                className="text-fade-in min-w-0 flex-1 truncate text-[11px] text-slate-500"
                title={group?.name}
              >
                {group
                  ? `${group.name} (NAICS ${group.code.replace("-", "\u2013")})`
                  : "The colour: each listing's NAICS sector group."}
              </p>
            </div>
          </div>
        );
      })()}

      {/* What is shown, and the filters in use, each removable. */}
      <div className="mt-2.5 flex min-h-6 flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <span key={`${shown.length}-${picks.length}`} className="text-fade-in mr-1">
          {tokens.length ? `Showing ${shown.length} of ${picks.length}` : `${picks.length} listings`} · choose
          one to trade it
        </span>
        {tokens.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={t.clear}
            aria-label={`Remove filter ${t.label}`}
            className="text-fade-in group inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1.5 font-semibold text-slate-900 transition hover:bg-slate-200"
          >
            {t.label}
            <span aria-hidden className="text-slate-500 transition group-hover:text-slate-900">
              ×
            </span>
          </button>
        ))}
        {tokens.length > 1 && (
          <button
            type="button"
            onClick={clear}
            className="text-fade-in font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:decoration-slate-900"
          >
            Clear all
          </button>
        )}
      </div>

      {/* The board: scrolls when it doesn't fit. Keyed by its view, so switching fades it over.
          The cards keep room above for their held badges; the table's heading row sits flush at
          the top, solid, so nothing shows above or through it as the rows scroll under it. */}
      <EaseHeight changeKey={`${appliedKey}-${view}`} duration={320}>
        <div
          style={{
            opacity: changing ? 0 : 1,
            transform: changing ? "translateY(4px)" : "none",
            filter: changing ? "blur(1px)" : "none",
            transition: `opacity ${changing ? FADE_MS : 260}ms ease, transform ${changing ? FADE_MS : 320}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${FADE_MS}ms ease`,
          }}
        >
          <div
            key={view}
            className={`pick-board text-fade-in -mx-1 mt-1 max-h-72 overflow-y-auto px-1 pb-1 ${view === "grid" ? "pt-2" : "pt-0"}`}
          >
            {shown.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                {/* A sector and NAICS group that no listing here has together, said so; else the
                    filters as a whole. */}
                {applied.sector !== "all" &&
                applied.naics !== "all" &&
                !picks.some((p) => p.kind === applied.sector && p.naics === applied.naics)
                  ? `No listing in this universe is both ${labelOf(applied.sector)} and in NAICS ${applied.naics.replace(
                      "-",
                      "–",
                    )} (${NAICS_GROUPS.find((g) => g.code === applied.naics)?.name ?? ""}): that combination isn't available. `
                  : "Nothing matches these filters. "}
                <button type="button" onClick={clear} className="font-semibold text-slate-900 underline">
                  Clear all
                </button>
              </p>
            ) : view === "grid" ? (
              <div
                className="grid grid-cols-2 gap-2 md:grid-cols-4"
                role="group"
                aria-label="Investment universe"
              >
                {shown.map((p, i) => {
                  const on = p.symbol === chosen;
                  return (
                    <button
                      key={p.symbol}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onChoose(p.symbol)}
                      data-on={on ? "" : undefined}
                      className={`universe-card kind-hover group/pick rise-in relative flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                        on
                          ? "border-slate-900 bg-white shadow-md shadow-slate-900/10"
                          : "border-slate-200 bg-slate-50/60 hover:border-slate-400 hover:bg-white motion-safe:hover:-translate-y-0.5 hover:shadow-sm"
                      }`}
                      style={{ animationDelay: `${Math.min(i, 12) * 25}ms`, animationDuration: "400ms" }}
                    >
                      <span
                        className="kind-badge grid size-7 shrink-0 place-items-center rounded-lg shadow-sm"
                        style={{ background: p.color, color: p.ink, ["--badge" as string]: p.color }}
                      >
                        <KindMark kind={p.kind} className="size-4" />
                      </span>
                      <CountryFlag pick={p} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-xs font-semibold leading-snug text-slate-900">
                          {p.name}
                        </span>
                        <span className="mt-0.5 flex items-baseline justify-between gap-2 tabular-nums">
                          <span className="text-sm font-semibold text-slate-900">
                            <Tween value={p.price} format={(x) => priceText(x, p.currency)} />
                            {p.currency && (
                              <span className="ml-1 text-[10px] font-bold text-slate-500">{p.currency}</span>
                            )}
                            {foreign(p) && (
                              <span className="block text-[10px] font-medium text-slate-500">
                                {money.format(p.price * p.rate)} CAD
                              </span>
                            )}
                          </span>
                          <span className="text-right text-[11px] font-semibold leading-tight">
                            <span className={`block transition-colors duration-500 ${tone(p.move ?? 0)}`}>
                              {p.move === null ? "" : pctText(p.move)}
                            </span>
                            {foreign(p) && p.cadMove !== null && (
                              <span className={`block text-[10px] ${tone(p.cadMove)}`}>
                                <span className="font-normal text-slate-400">FX </span>
                                {pctText(p.cadMove)}
                              </span>
                            )}
                          </span>
                        </span>
                      </span>
                      {p.held > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 px-1.5 text-[10px] font-bold tabular-nums text-white shadow">
                          {p.held.toLocaleString("en-CA")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <table className="w-full table-fixed text-sm tabular-nums" aria-label="Investment universe">
                {/* Fixed column widths (table-fixed), so the columns stay put as the listing being
                    traded (in bold, with its tag) changes; the listing's name takes what is left. */}
                <colgroup>
                  <col />
                  <col className="w-32" />
                  <col className="w-20" />
                  <col className="w-16" />
                  <col className="w-24" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-white text-[11px] font-semibold text-slate-500 shadow-[0_1px_0_#e2e8f0]">
                  <tr>
                    {heading("Listing", "name", null, "text-left")}
                    {heading("Price", "price-desc", "price-asc")}
                    {heading("Day change", "move-desc", "move-asc")}
                    <th className="px-2 py-1.5 text-right font-medium">Shares</th>
                    {heading("Value", "value-desc", null)}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => {
                    const on = p.symbol === chosen;
                    return (
                      <tr
                        key={p.symbol}
                        onClick={() => onChoose(p.symbol)}
                        data-on={on ? "" : undefined}
                        className="universe-row group/row kind-hover rise-in cursor-pointer border-t border-slate-100"
                        style={
                          {
                            animationDelay: `${Math.min(i, 12) * 20}ms`,
                            animationDuration: "350ms",
                            "--accent": p.color,
                          } as React.CSSProperties
                        }
                      >
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={(e) => {
                              e.stopPropagation();
                              onChoose(p.symbol);
                            }}
                            className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                          >
                            <span
                              className="universe-badge kind-badge grid size-6 shrink-0 place-items-center rounded-md shadow-sm"
                              style={{ background: p.color, color: p.ink, ["--badge" as string]: p.color }}
                            >
                              <KindMark kind={p.kind} className="size-3.5" />
                            </span>
                            <CountryFlag pick={p} />
                            <span className="min-w-0 transition duration-300 ease-out group-hover/row:translate-x-0.5">
                              <span
                                className={`block truncate text-xs ${
                                  on ? "font-bold text-slate-900" : "font-semibold text-slate-800"
                                }`}
                              >
                                {p.name}
                              </span>
                            </span>
                            {/* The listing being traded, said so. */}
                            {on && (
                              <span className="universe-tag shrink-0 rounded-full bg-slate-900 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                                Trading
                              </span>
                            )}
                          </button>
                        </td>
                        {/* Its price where it trades; in another currency than CAD, under it,
                            its price in CAD at today's rate. */}
                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold text-slate-900">
                          <Tween value={p.price} format={(x) => priceText(x, p.currency)} />
                          {p.currency && (
                            <span className="ml-1 text-[10px] font-bold text-slate-500">{p.currency}</span>
                          )}
                          {foreign(p) && (
                            <span className="block text-[10px] font-medium text-slate-500">
                              {money.format(p.price * p.rate)} CAD
                            </span>
                          )}
                        </td>
                        {/* Today's change of its price; in another currency, under it, the change
                            with the exchange rate's move too (FX). */}
                        <td className="px-2 py-1.5 text-right text-xs font-semibold">
                          <span className={`block ${tone(p.move ?? 0)}`}>{p.move === null ? "—" : pctText(p.move)}</span>
                          {foreign(p) && p.cadMove !== null && (
                            <span className={`block text-[10px] ${tone(p.cadMove)}`}>
                              <span className="font-normal text-slate-400">FX </span>
                              {pctText(p.cadMove)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs text-slate-700">
                          {p.held ? p.held.toLocaleString("en-CA") : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs font-semibold text-slate-900">
                          {p.held ? money.format(p.held * p.price * p.rate) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </EaseHeight>
    </div>
  );
}

// The sort menu: a button saying the order in use, opening a list of the orders below it,
// white with the one in use in black. It opens and closes with a quick fade and drop (its
// chevron turning over), its options sliding in one after another; a click outside, Escape
// or a choice closes it. Up and down move through the options, Enter or Space chooses.
function SortMenu({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = SORTS.find((s) => s.value === value) ?? SORTS[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    list.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (s: Sort) => {
    onChange(s);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setFocus(Math.max(0, SORTS.indexOf(current)));
          setOpen(!open);
        }}
        className={`group inline-flex items-center gap-2 rounded-lg border bg-white py-1.5 pl-3 pr-2.5 text-xs font-semibold text-slate-900 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
          open ? "border-slate-900 shadow-sm" : "border-slate-200 hover:border-slate-400"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-slate-500 transition group-hover:text-slate-900"
        >
          <path d="M4 2.5v9M1.8 9.3 4 11.5l2.2-2.2M10 11.5v-9M7.8 4.7 10 2.5l2.2 2.2" />
        </svg>
        <span key={current.value} className="text-fade-in">
          {current.label}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3 text-slate-500 transition duration-300 ease-out ${open ? "rotate-180 text-slate-900" : ""}`}
        >
          <path d="M3 4.5 6 7.5l3-3" />
        </svg>
      </button>
      <ul
        ref={list}
        role="listbox"
        aria-label="Sort by"
        tabIndex={-1}
        aria-activedescendant={open ? `sort-${SORTS[focus].value}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") setFocus((f) => Math.min(SORTS.length - 1, f + 1));
          else if (e.key === "ArrowUp") setFocus((f) => Math.max(0, f - 1));
          else if (e.key === "Enter" || e.key === " ") choose(SORTS[focus].value);
          else return;
          e.preventDefault();
        }}
        className={`sort-menu absolute right-0 top-full z-30 mt-1.5 w-56 origin-top-right rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 outline-none ${
          open ? "" : "pointer-events-none"
        }`}
        data-open={open ? "" : undefined}
      >
        {SORTS.map((s, i) => {
          const on = s.value === value;
          return (
            <li
              key={s.value}
              id={`sort-${s.value}`}
              role="option"
              aria-selected={on}
              onPointerEnter={() => setFocus(i)}
              onClick={() => choose(s.value)}
              className={`sort-option flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                on
                  ? "bg-slate-900 text-white"
                  : focus === i
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700"
              }`}
              style={{ "--i": i } as React.CSSProperties}
            >
              {s.label}
              {on && (
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3"
                >
                  <path d="m2.5 6.5 2.3 2.3 4.7-5" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type MenuOption = { value: string; label: string; hint?: string; count?: number; swatch?: React.ReactNode };

// A filter's menu, as the sort menu is: a button saying what is chosen (its swatch, if it has
// one), opening a list of every choice below it, each with its swatch, its name, what it is
// and how many listings it would show (greyed out at none, but still there to read), the one
// chosen in black. It fades and drops open, its options sliding in one after another, and it
// scrolls when they don't fit; a click outside, Escape or a choice closes it, and up, down,
// Enter and Space work it from the keyboard.
export function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: MenuOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    list.current?.focus({ preventScroll: true });
    list.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        onClick={() => {
          setFocus(Math.max(0, options.indexOf(current)));
          setOpen(!open);
        }}
        className={`group inline-flex min-w-36 items-center gap-2 rounded-lg border bg-white py-1 pl-1.5 pr-2.5 text-xs font-semibold text-slate-900 transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
          open ? "border-slate-900 shadow-sm" : "border-slate-200 hover:border-slate-400"
        }`}
      >
        <span key={current.value} className="text-fade-in flex min-w-0 flex-1 items-center gap-2">
          {current.swatch ?? <span className="size-5 shrink-0 rounded-md bg-slate-100" />}
          <span className="truncate">{current.label}</span>
        </span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3 shrink-0 text-slate-500 transition duration-300 ease-out ${open ? "rotate-180 text-slate-900" : ""}`}
        >
          <path d="M3 4.5 6 7.5l3-3" />
        </svg>
      </button>
      <ul
        ref={list}
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        aria-activedescendant={open ? `${label}-${options[focus]?.value}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") setFocus((f) => Math.min(options.length - 1, f + 1));
          else if (e.key === "ArrowUp") setFocus((f) => Math.max(0, f - 1));
          else if (e.key === "Enter" || e.key === " ") choose(options[focus].value);
          else return;
          e.preventDefault();
        }}
        className={`sort-menu absolute left-0 top-full z-30 mt-1.5 max-h-80 w-80 origin-top-left overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 outline-none ${
          open ? "" : "pointer-events-none"
        }`}
        data-open={open ? "" : undefined}
      >
        {options.map((o, i) => {
          const on = o.value === value;
          const none = o.count === 0 && !on;
          return (
            <li
              key={o.value}
              id={`${label}-${o.value}`}
              role="option"
              aria-selected={on}
              aria-disabled={none || undefined}
              onPointerEnter={() => setFocus(i)}
              onClick={() => choose(o.value)}
              className={`sort-option kind-hover flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 ${
                on
                  ? "bg-slate-900 text-white"
                  : focus === i
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700"
              } ${none ? "opacity-45" : ""}`}
              style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
            >
              {o.swatch ?? <span className="size-5 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold">{o.label}</span>
                {o.hint && (
                  <span className={`block truncate text-[11px] ${on ? "text-white/70" : "text-slate-500"}`}>
                    {o.hint}
                  </span>
                )}
              </span>
              {o.count !== undefined && (
                <span
                  className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                    on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {o.count === 0 ? "none" : o.count}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A listing's flag beside its badge: where a company is based, or where a fund is listed
// (said so when pointed at). Nothing when that isn't known.
function CountryFlag({ pick }: { pick: BoardPick }) {
  const src = countryFlag(pick.country, true);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG
    <img
      src={src}
      alt={pick.country ?? ""}
      title={`${pick.fund ? "Listed in" : "Based in"} ${pick.country}`}
      className="h-3 w-auto shrink-0 self-center rounded-[2px] ring-1 ring-black/10"
    />
  );
}
