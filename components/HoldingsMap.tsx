"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EtfTreeNode, MissingReason } from "@/lib/db";
import { listingOf } from "@/lib/exchanges";
import FoldButton, { FOLD_BUTTON } from "@/components/FoldButton";
import KindMark from "@/components/KindMark";
import { KINDS } from "@/lib/kinds";
import { NAICS_GROUPS, markOn, naicsOf, type NaicsGroup } from "@/lib/naics";
import { kindOf } from "@/lib/sandbox";

// The map reads left to right: the chosen ETF, then what it holds, then what those hold,
// until a branch ends in a company, a credit rating, or the part of a fund its holdings
// list doesn't itemise. Each product is a box; a line joins it to the fund it is in,
// thicker the more of the chosen ETF it stands for.
const NODE_W = 212;
const NODE_H = 30;
const ROW = 38; // one line of the map: a box and the space under it
const COL = 272; // from one level's left edge to the next's
const FOLD_MS = 550; // how long opening or folding one fund takes
const FOLD_ALL_MS = 950; // ...and several at once (Fold all, Open all), level after level
const LEVEL_GAP = 0.2; // share of that time between one level starting to move and the next
const SIBLING_GAP = 0.014; // ...and between one holding and the next in the same fund
// The hover card under a product (what it is, or why we have no data): its left edge lined
// up with the box's, a small pointer joining the two.
const CARD_W = 260;
const CARD_H = 170; // about its tallest, to decide whether it fits below the box on screen
const CARD_GAP = 10; // between the box and the card

type Placed = {
  node: EtfTreeNode;
  parent: Placed | null;
  depth: number;
  x: number;
  y: number; // top edge
  share: number; // share of the chosen ETF, 0..1
};

const pct = (w: number) => (w > 0 && w < 0.001 ? "<0.1%" : `${(w * 100).toFixed(1)}%`);
const nameOf = (n: EtfTreeNode) => n.symbol ?? n.label;

// Where every visible product goes. Products at the end of a branch (or folded shut) take
// one line each, top to bottom; a fund sits level with the first thing it holds, so the
// chosen ETF is at the top of the map however long it is.
function layout(root: EtfTreeNode, collapsed: Set<string>): Placed[] {
  const out: Placed[] = [];
  let line = 0;
  function place(node: EtfTreeNode, parent: Placed | null, depth: number): Placed {
    const placed: Placed = {
      node,
      parent,
      depth,
      x: depth * COL,
      y: 0,
      share: parent ? parent.share * node.weight : 1,
    };
    out.push(placed);
    if (!node.children.length || collapsed.has(node.id)) {
      placed.y = line++ * ROW;
    } else {
      const kids = node.children.map((child) => place(child, placed, depth + 1));
      placed.y = kids[0].y;
    }
    return placed;
  }
  place(root, null, 0);
  return out;
}

const byId = (placed: Placed[]) => new Map(placed.map((p) => [p.node.id, p]));
const sizeOf = (placed: Placed[]) => ({
  width: Math.max(...placed.map((p) => p.x)) + NODE_W,
  height: Math.max(...placed.map((p) => p.y)) + NODE_H,
});

// The nearest fund above `p` (or `p` itself) that the other layout also shows: where a
// product comes out of when its fund opens, and goes back into when it folds.
function anchorIn(p: Placed, other: Map<string, Placed>): Placed | undefined {
  for (let a: Placed | null = p; a; a = a.parent) {
    const found = other.get(a.node.id);
    if (found) return found;
  }
}

// Every product in the tree, folded or not.
function flatten(node: EtfTreeNode, depth = 0): { node: EtfTreeNode; depth: number }[] {
  return [{ node, depth }, ...node.children.flatMap((child) => flatten(child, depth + 1))];
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (t: number) => Math.min(Math.max(t, 0), 1);
// A product's place among its fund's holdings (the last number in its id), capped so a
// long list doesn't wait too long for its last rows.
const siblingIndex = (p: Placed) => Math.min(Number(p.node.id.split(".").pop()), 12);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const fmtTradeDay = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// What the notice on a holding we have no data on says.
function missingNotice({ reason, lastTrade }: MissingReason): { title: string; text: string } {
  switch (reason) {
    case "cash":
      return {
        title: "Cash holding",
        text: "A cash or money-market fund the ETF uses to hold cash. It isn't a company, so there's no share price to show.",
      };
    case "stopped":
      return {
        title: "No longer trades",
        text: `Its shares ${lastTrade ? `stopped trading on ${fmtTradeDay.format(new Date(`${lastTrade}T00:00:00Z`))}` : "have stopped trading"}, usually because the company was bought, merged with another or delisted. The fund's holdings list may not have caught up yet.`,
      };
    case "pending":
      return {
        title: "Not added yet",
        text: "New holdings join our data a few at a time during the hourly update. Check back soon.",
      };
    default:
      return {
        title: "Not in our data",
        text: "Yahoo Finance, where our prices come from, has no listing for it. It may be private, delisted, or traded on a market Yahoo doesn't cover.",
      };
  }
}

// A company's NAICS group (null for funds and anything Yahoo doesn't classify).
const sectorOf = (node: EtfTreeNode): NaicsGroup | null =>
  node.kind === "holding" && node.details ? naicsOf(node.details.sector, node.details.industry) : null;

// The colour of the lines and outlines along the route to the product pointed at.
const ROUTE = "#334155"; // slate-700

// The hover card's rows for a stored company or fund: what it does (a company's sector and
// industry, a fund's provider and category), its location (head office), its exchange,
// and how many holdings a fund lists. Rows Yahoo has nothing for are left out.
function detailRows(node: EtfTreeNode): [string, string][] {
  const d = node.details;
  if (!d) return [];
  const listing = listingOf(d.exchange);
  const listed = node.children.filter((c) => c.kind === "holding" || c.kind === "fund").length;
  const naics = sectorOf(node);
  const rows: [string, string | null][] = [
    ["NAICS", naics ? `${naics.code} · ${naics.name}` : null],
    ["Business", [d.sector, d.industry].filter(Boolean).join(" · ") || null],
    ["Provider", d.fundFamily],
    ["Category", d.category],
    ["Location", [d.hqCity, d.hqCountry].filter(Boolean).join(", ") || null],
    ["Exchange", listing ? `${listing.exchange}, ${listing.country}` : null],
    ["Holds", node.kind === "fund" && listed ? `${listed} listed ${listed === 1 ? "holding" : "holdings"} shown here` : null],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}

const LEGEND: { kind: EtfTreeNode["kind"]; text: string }[] = [
  { kind: "fund", text: "Fund" },
  { kind: "rating", text: "Credit rating" },
  { kind: "other", text: "Not itemised" },
];

// Funds are white, credit ratings black. A company's tile is filled with its NAICS
// group's colour (see lib/naics.ts), grey when its sector is unknown.
const BOX: Record<EtfTreeNode["kind"], string> = {
  fund: "border border-slate-400 bg-white text-slate-900",
  holding: "border border-black/10 bg-white text-slate-900",
  rating: "border border-black bg-slate-950 text-white",
  other: "border border-slate-300 bg-slate-200 text-slate-600",
};
const UNKNOWN_SECTOR = "#f1f5f9"; // slate-100

// The legend's swatch: a small tile in the sector's colour.
function SectorSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="legend-swatch h-3 w-5 shrink-0 rounded-sm border border-black/10"
      style={{ backgroundColor: color }}
    />
  );
}
// A holding we have no data on: dashed and greyed, with an info mark.
const MISSING_BOX = "border border-dashed border-slate-400 bg-slate-50 text-slate-500";

// One box's part in a change of the map: where it starts and ends, and how it gets there.
// stay: on screen throughout, it glides from its old place to its new one. enter: it fans
// out of its fund as it fades in. leave: it slides back into its fund as it fades out.
type Point = { x: number; y: number };
type Move = {
  p: Placed;
  mode: "stay" | "enter" | "leave";
  from: Point;
  to: Point;
  // The fund it comes out of or goes into, which may itself be gliding.
  anchorFrom: Point;
  anchorTo: Point;
  delay: number; // share of the time it waits for the levels and holdings before it
};
type Plan = { moves: Move[]; span: number; width: number; heightFrom: number; heightTo: number };

// Everything that happens between two settings of the map. Boxes appear a level at a
// time, one holding after another; they go the same way in reverse, deepest level first.
function planChange(tree: EtfTreeNode, from: Set<string>, to: Set<string>): Plan {
  const placed = layout(tree, to);
  const before = from === to ? placed : layout(tree, from);
  const now = byId(placed);
  const was = byId(before);
  const going = before.filter((p) => !now.has(p.node.id));
  // How many levels below a fund that stays on screen.
  const below = (p: Placed, other: Map<string, Placed>) => p.depth - (anchorIn(p, other)?.depth ?? p.depth);
  const deepest = Math.max(
    1,
    ...placed.filter((p) => !was.has(p.node.id)).map((p) => below(p, was)),
    ...going.map((p) => below(p, now)),
  );
  const wait = (level: number, p: Placed) => level * LEVEL_GAP + siblingIndex(p) * SIBLING_GAP;
  const moves: Move[] = [
    ...placed.map((p): Move => {
      const old = was.get(p.node.id);
      if (old) return { p, mode: "stay", from: old, to: p, anchorFrom: old, anchorTo: p, delay: 0 };
      const anchor = anchorIn(p, was) ?? p;
      return {
        p,
        mode: "enter",
        from: anchor,
        to: p,
        anchorFrom: anchor,
        anchorTo: now.get(anchor.node.id) ?? p,
        delay: wait(below(p, was) - 1, p),
      };
    }),
    ...going.map((p): Move => {
      const anchor = anchorIn(p, now) ?? p;
      return {
        p,
        mode: "leave",
        from: p,
        to: anchor,
        anchorFrom: was.get(anchor.node.id) ?? p,
        anchorTo: anchor,
        delay: wait(deepest - below(p, now), p),
      };
    }),
  ];
  return {
    moves,
    span: 1 - (deepest - 1) * LEVEL_GAP - 12 * SIBLING_GAP,
    width: Math.max(sizeOf(placed).width, sizeOf(before).width),
    heightFrom: sizeOf(before).height,
    heightTo: sizeOf(placed).height,
  };
}

// Where a box is, and how solid, `progress` (0..1) of the way through a change.
function pose(move: Move, progress: number, span: number) {
  const t = ease(progress);
  if (move.mode === "stay") {
    return { x: mix(move.from.x, move.to.x, t), y: mix(move.from.y, move.to.y, t), opacity: 1 };
  }
  const own = ease(clamp((progress - move.delay) / span));
  const anchor = { x: mix(move.anchorFrom.x, move.anchorTo.x, t), y: mix(move.anchorFrom.y, move.anchorTo.y, t) };
  return move.mode === "enter"
    ? { x: mix(anchor.x, move.to.x, own), y: mix(anchor.y, move.to.y, own), opacity: own }
    : { x: mix(move.from.x, anchor.x, own), y: mix(move.from.y, anchor.y, own), opacity: 1 - own };
}

// The line from a fund's right edge to the left edge of something it holds.
function linkPath(fund: Point, held: Point) {
  const x1 = fund.x + NODE_W;
  const y1 = fund.y + NODE_H / 2;
  const y2 = held.y + NODE_H / 2;
  // Clamped: a box still tucked behind its fund has no room for a curve.
  const x2 = Math.max(held.x, x1);
  const mid = (x1 + x2) / 2;
  return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
}

const linkWidth = (p: Placed) => Math.max(1.5, Math.sqrt(p.share) * 12);

// `detail` is the product whose chart and figures are showing under the map, if any.
// Without `links` (the Sandbox, where the ETF is kept hidden), tickers don't link to it.
export default function HoldingsMap({
  tree,
  detail = null,
  links = true,
}: {
  tree: EtfTreeNode;
  detail?: string | null;
  links?: boolean;
}) {
  // Funds folded shut (their holdings hidden), by id: `to` is how the map is set, `from`
  // how it was before the last change, `ms` how long that change takes to play, and
  // `changed` whether there has been one yet.
  // The map starts with every fund folded, showing only what the chosen ETF holds directly.
  const [fold, setFold] = useState(() => {
    const folded = new Set(
      flatten(tree)
        .filter(({ node, depth }) => depth > 0 && node.children.length > 0)
        .map(({ node }) => node.id),
    );
    return { from: folded, to: folded, ms: FOLD_MS, changed: false };
  });
  // True while a change plays.
  const [moving, setMoving] = useState(false);
  // The product under the pointer or with focus: its route back to the ETF lights up.
  const [active, setActive] = useState<string | null>(null);
  // Whether the NAICS sector legend is open (it starts open).
  const [legendOpen, setLegendOpen] = useState(true);
  const legendId = useId();
  // Where the active product's box is on screen, for its hover card (see below).
  const [cardBox, setCardBox] = useState<DOMRect | null>(null);

  const plan = useMemo(
    () => planChange(tree, moving ? fold.from : fold.to, fold.to),
    [tree, fold, moving],
  );

  // A change is played by moving the boxes and lines directly, frame by frame, rather
  // than by re-rendering the whole map sixty times a second. React draws the first frame
  // (below) and, once `moving` is false again, the finished map.
  const box = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLDivElement>());
  const linkEls = useRef(new Map<string, SVGPathElement>());
  useEffect(() => {
    if (!moving) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function step(time) {
      const progress = Math.min((time - started) / fold.ms, 1);
      const poses = new Map(plan.moves.map((m) => [m.p.node.id, pose(m, progress, plan.span)]));
      for (const { p } of plan.moves) {
        const at = poses.get(p.node.id)!;
        const el = nodeEls.current.get(p.node.id);
        if (el) {
          el.style.translate = `${at.x}px ${at.y}px`;
          el.style.opacity = String(at.opacity);
        }
        const link = linkEls.current.get(p.node.id);
        const fund = p.parent && poses.get(p.parent.node.id);
        if (link && fund) {
          link.setAttribute("d", linkPath(fund, at));
          link.style.opacity = String(at.opacity);
        }
      }
      if (box.current) box.current.style.height = `${mix(plan.heightFrom, plan.heightTo, ease(progress))}px`;
      if (progress < 1) frame = requestAnimationFrame(step);
      else setMoving(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [moving, fold.ms, plan]);

  // While a product is active, its card follows its box if the page (or the map) scrolls.
  useEffect(() => {
    if (active === null) return;
    const follow = () => {
      const el = nodeEls.current.get(active);
      if (el) setCardBox(el.getBoundingClientRect());
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [active]);

  function setCollapsed(next: Set<string>) {
    // With reduced motion the map changes at once.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFold((old) => {
      const changed =
        [...next].filter((id) => !old.to.has(id)).length + [...old.to].filter((id) => !next.has(id)).length;
      return { from: old.to, to: next, ms: changed > 1 ? FOLD_ALL_MS : FOLD_MS, changed: true };
    });
    setMoving(!still);
    setActive(null);
  }

  function toggle(id: string) {
    const next = new Set(fold.to);
    if (!next.delete(id)) next.add(id);
    setCollapsed(next);
  }

  const all = useMemo(() => flatten(tree), [tree]);
  const foldable = all.filter(({ node, depth }) => depth > 0 && node.children.length > 0);
  const levels = Math.max(...all.map((n) => n.depth));
  const ends = all.filter(({ node }) => node.kind === "holding" || node.kind === "rating").length;
  // Whether any company's sector is unknown (the legend then lists that too).
  const unclassified = all.some(({ node }) => node.kind === "holding" && node.details && !sectorOf(node));
  // The kinds of mark on the map (KindMark): each fund's, and each company's we have details on.
  const kindsShown = new Set(
    all.flatMap(({ node }) =>
      node.kind === "fund"
        ? ["ETF"]
        : node.kind === "holding" && node.details
          ? [
              kindOf({
                sector: node.details.sector ?? null,
                industry: node.details.industry ?? null,
                fundFamily: null,
                category: null,
              }),
            ]
          : [],
    ),
  );
  const marks = KINDS.filter((k) => kindsShown.has(k.kind));

  // What React draws: the finished map, or the first frame of a change.
  const shown = plan.moves.map((m) => ({ ...m, at: pose(m, moving ? 0 : 1, plan.span) }));
  const at = new Map(shown.map((s) => [s.p.node.id, s.at]));
  // The first time the map appears, its boxes slide in level by level instead.
  const intro = !fold.changed;

  // Nothing lights up while the map is moving. `box` is the product's box, for the card.
  const point = (id: string | null, box?: HTMLElement) => {
    if (moving) return;
    setActive(id);
    setCardBox(box ? box.getBoundingClientRect() : null);
  };
  const onPath = (id: string) => active !== null && (active === id || active.startsWith(`${id}.`));
  const current = shown.find((s) => s.p.node.id === active)?.p ?? null;
  // The hover card: for a stored company or fund, or a holding we have no data on.
  const cardFor = !moving && current && (current.node.missing || current.node.details) ? current.node : null;

  const allFolded = foldable.every(({ node }) => fold.to.has(node.id));
  const allOpen = fold.to.size === 0;
  const bulkButton = FOLD_BUTTON;
  const arrow = "transition-transform duration-300 ease-out";

  // The route from the chosen ETF to the active product, and what share it is.
  let caption: React.ReactNode = "Point at a product to see its share of the fund it is in, and of the whole ETF.";
  if (current) {
    const route: Placed[] = [];
    for (let p: Placed | null = current; p; p = p.parent) route.unshift(p);
    caption = (
      <>
        <span className="font-semibold text-slate-900">{route.map((p) => nameOf(p.node)).join(" › ")}</span>
        {current.parent && (
          <>
            {" · "}
            {pct(current.node.weight)} of {nameOf(current.parent.node)}
            {current.depth > 1 && ` · ${pct(current.share)} of ${nameOf(tree)}`}
          </>
        )}
      </>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-500">
        {nameOf(tree)} opens out over {levels} {levels === 1 ? "level" : "levels"} into {ends}{" "}
        {ends === 1 ? "end point" : "end points"}. Each fund lists its largest holdings; the rest of it is
        shown as &ldquo;Other holdings&rdquo;.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        {LEGEND.map(({ kind, text }) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className={`h-3 w-5 rounded-sm ${BOX[kind]}`} />
            {text}
          </span>
        ))}
        {all.some(({ node }) => node.missing) && (
          <span className="flex items-center gap-1.5">
            <span className={`h-3 w-5 rounded-sm ${MISSING_BOX}`} />
            No data (point at it to see why)
          </span>
        )}
        {foldable.length > 0 && (
          // Each is greyed out when the map is already that way. Their arrows close in
          // (or spread) when pointed at.
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={allFolded}
              className={bulkButton}
              onClick={() => setCollapsed(new Set(foldable.map(({ node }) => node.id)))}
            >
              <svg aria-hidden viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                <path d="M3 1.5 6 4.5l3-3" className={`${arrow} motion-safe:group-hover:translate-y-0.5`} />
                <path d="M3 10.5 6 7.5l3 3" className={`${arrow} motion-safe:group-hover:-translate-y-0.5`} />
              </svg>
              Fold all
            </button>
            <button type="button" disabled={allOpen} className={bulkButton} onClick={() => setCollapsed(new Set())}>
              <svg aria-hidden viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                <path d="M3 4.5 6 1.5l3 3" className={`${arrow} motion-safe:group-hover:-translate-y-0.5`} />
                <path d="M3 7.5 6 10.5l3-3" className={`${arrow} motion-safe:group-hover:translate-y-0.5`} />
              </svg>
              Open all
            </button>
          </span>
        )}
      </div>

      {/* Companies are coloured by NAICS sector group: every group, with its codes, in one
          column, open to begin with. Its Fold / Open button works like Fold all / Open all
          above. Folding, the rows slip away bottom first, then the panel closes up; opening,
          the panel opens out and the rows cascade in top first, each swatch growing into
          place (.legend-fold and .legend-row in globals.css; each row's delay is --d). */}
      {all.some(({ node }) => node.kind === "holding") && (
        <div className="mt-3 w-fit max-w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-4">
            <p className="text-xs font-semibold text-slate-700">Companies/holdings by NAICS sector and mark</p>
            <FoldButton
              open={legendOpen}
              controls={legendId}
              onClick={() => setLegendOpen((open) => !open)}
              className="ml-auto text-xs"
            />
          </div>
          <div id={legendId} className="legend-fold" data-closed={legendOpen ? undefined : ""}>
            {/* The folding element's only child (padding on it wouldn't fold away), so the
                gap above the list is the list's own and is clipped with it. */}
            <div>
              <ul className="grid gap-y-1 pt-2 text-xs text-slate-600">
                {[
                  ...NAICS_GROUPS.map((g) => ({ key: g.code, color: g.color, code: g.code, name: g.name })),
                  ...(unclassified ? [{ key: "unknown", color: UNKNOWN_SECTOR, code: "", name: "Sector unknown" }] : []),
                ].map((row, i, rows) => (
                  <li
                    key={row.key}
                    className="legend-row flex items-center gap-1.5"
                    style={{ "--d": `${legendOpen ? 90 + i * 28 : (rows.length - 1 - i) * 14}ms` } as React.CSSProperties}
                  >
                    <SectorSwatch color={row.color} />
                    <span className="w-9 shrink-0 font-semibold tabular-nums text-slate-700">{row.code}</span>
                    <span className="min-w-0">{row.name}</span>
                  </li>
                ))}
              </ul>
              {/* The marks on the boxes, by sector as Yahoo Finance gives it (KindMark): only
                  those on this map, cascading in after the colours. */}
              {marks.length > 0 && (
                <>
                  <p
                    className="legend-row mt-3 text-xs font-semibold text-slate-700"
                    style={{ "--d": `${legendOpen ? 90 + (NAICS_GROUPS.length + 1) * 28 : 0}ms` } as React.CSSProperties}
                  >
                    Marks: the sector
                  </p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1.5 text-xs text-slate-600 sm:grid-cols-3">
                    {marks.map((k, i) => (
                      <li
                        key={k.kind}
                        title={`${k.from}: ${k.about}`}
                        className="legend-row flex items-center gap-1.5"
                        style={
                          {
                            "--d": `${legendOpen ? 90 + (NAICS_GROUPS.length + 2 + i) * 28 : 0}ms`,
                          } as React.CSSProperties
                        }
                      >
                        <span className="legend-swatch grid h-4 w-5 shrink-0 place-items-center rounded-sm bg-white text-slate-800 ring-1 ring-slate-200">
                          <KindMark kind={k.kind} className="size-3" />
                        </span>
                        <span className="min-w-0 font-medium text-slate-700">{k.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 min-h-10 text-sm text-slate-500" aria-live="polite">
        {/* Keyed, so each new product's line fades up into place. */}
        <span key={active ?? "hint"} className="map-caption inline-block">
          {caption}
        </span>
      </p>

      {/* Wider than a phone: the map scrolls sideways inside its card. The padding leaves
          room for the shadow of a box at the edge. */}
      <div className="-mx-3 mt-1 overflow-x-auto overflow-y-hidden px-3 py-4">
        <div
          ref={box}
          className="relative"
          style={{ width: plan.width, height: moving ? plan.heightFrom : plan.heightTo }}
        >
          <svg
            width={plan.width}
            height={Math.max(plan.heightFrom, plan.heightTo)}
            className="pointer-events-none absolute left-0 top-0"
            aria-hidden
          >
            {shown.map(({ p, at: held }) => {
              const fund = p.parent && at.get(p.parent.node.id);
              if (!fund) return null;
              return (
                <path
                  key={p.node.id}
                  ref={(el) => {
                    if (el) linkEls.current.set(p.node.id, el);
                    else linkEls.current.delete(p.node.id);
                  }}
                  d={linkPath(fund, held)}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeLinecap="round"
                  strokeWidth={linkWidth(p)}
                  className={intro ? "map-link-in" : undefined}
                  style={{ opacity: held.opacity, animationDelay: `${p.depth * 90}ms` }}
                />
              );
            })}
          </svg>

          {/* Pointing at a box fades the rest of the map back. One white sheet does it:
              the lit boxes and lines sit above the sheet, everything else under it, so
              only the sheet has to fade rather than every box. */}
          <div
            aria-hidden
            className="map-veil pointer-events-none absolute -inset-4 bg-white"
            data-on={active !== null || undefined}
            style={{ zIndex: levels + 2 }}
          />
          {active !== null && (
            <svg
              width={plan.width}
              height={plan.heightTo}
              className="map-route pointer-events-none absolute left-0 top-0"
              style={{ zIndex: levels + 3 }}
              aria-hidden
            >
              {shown.map(({ p, at: held }) => {
                const fund = p.parent && at.get(p.parent.node.id);
                if (!fund || !onPath(p.node.id)) return null;
                return (
                  <path
                    key={p.node.id}
                    d={linkPath(fund, held)}
                    fill="none"
                    stroke={ROUTE}
                    strokeLinecap="round"
                    strokeWidth={linkWidth(p) + 1.5}
                  />
                );
              })}
            </svg>
          )}

          {shown.map(({ p, mode, at: here }) => {
            const { node } = p;
            const sector = sectorOf(node);
            // Companies we have details on are filled with their sector's colour.
            const filled = node.kind === "holding" && !node.missing && node.details !== null;
            const on = onPath(node.id);
            const open = !fold.to.has(node.id);
            return (
              <div
                key={node.id}
                ref={(el) => {
                  if (el) nodeEls.current.set(node.id, el);
                  else nodeEls.current.delete(node.id);
                }}
                onPointerEnter={(e) => point(node.id, e.currentTarget)}
                onPointerLeave={() => point(null)}
                onFocus={(e) => point(node.id, e.currentTarget)}
                onBlur={() => point(null)}
                // Holdings we have no data on explain why in their own notice instead, and
                // can be tabbed to so keyboard users can read it.
                // Companies, funds and holdings we have no data on explain themselves in a
                // hover card instead; holdings with no link can be tabbed to for it.
                title={
                  node.missing || node.details
                    ? undefined
                    : `${node.label}${p.parent ? `: ${pct(node.weight)} of ${nameOf(p.parent.node)}` : ""}`
                }
                tabIndex={node.missing ? 0 : undefined}
                aria-describedby={(node.missing || node.details) && active === node.id ? "map-hover-card" : undefined}
                // Boxes on their way out can't be pointed at or tabbed to.
                inert={mode === "leave"}
                // lit: the one pointed at. path: the funds it sits in. Their lift and
                // outline are in globals.css.
                data-state={active === node.id ? "lit" : on ? "path" : undefined}
                data-selected={node.stored && node.symbol === detail ? "" : undefined}
                className={`map-node absolute left-0 top-0 flex items-center gap-1.5 rounded-md px-2 text-xs ${
                  intro ? "map-node-in" : ""
                } ${node.missing ? MISSING_BOX : BOX[node.kind]}`}
                style={{
                  // Placed with `translate`, which moves a box without the browser having
                  // to lay the page out again (and leaves `transform` free for the lift).
                  translate: `${here.x}px ${here.y}px`,
                  width: NODE_W,
                  height: NODE_H,
                  // Funds stay above the boxes sliding out of (or back into) them; lit
                  // boxes sit above the white sheet.
                  zIndex: on ? levels + 4 : levels - p.depth + 1,
                  opacity: here.opacity,
                  animationDelay: `${p.depth * 90}ms`,
                  backgroundColor: filled ? (sector?.color ?? UNKNOWN_SECTOR) : undefined,
                  // White text on the deeper sector shades, dark on the light ones.
                  color: filled && sector ? sector.ink : undefined,
                }}
              >
                {/* Its kind's mark (KindMark, as on the Sandbox's cards and the Search page): a
                    company we have details on by its sector, a fund as an ETF. */}
                {(filled || node.kind === "fund") && (
                  <KindMark
                    kind={
                      node.kind === "fund"
                        ? "ETF"
                        : kindOf({
                            sector: node.details?.sector ?? null,
                            industry: node.details?.industry ?? null,
                            fundFamily: null,
                            category: null,
                          })
                    }
                    className="-ml-0.5 size-3.5"
                    color={filled && sector ? markOn(sector) : undefined}
                  />
                )}
                {node.symbol &&
                  (node.stored && links ? (
                    // Shows this product's chart and figures under the map (the page reads
                    // ?detail=), without leaving the map or moving it.
                    <Link
                      href={`/map?symbol=${encodeURIComponent(tree.symbol ?? "")}&detail=${encodeURIComponent(node.symbol)}`}
                      replace
                      scroll={false}
                      className="shrink-0 font-semibold hover:underline"
                    >
                      {node.symbol}
                    </Link>
                  ) : (
                    <span className="shrink-0 font-semibold">{node.symbol}</span>
                  ))}
                <span className={`min-w-0 flex-1 truncate ${node.symbol ? "opacity-75" : "font-medium"}`}>
                  {node.label}
                </span>
                {node.missing && (
                  <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 text-slate-400">
                    <circle cx="6" cy="6" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M6 5.3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx="6" cy="3.4" r="0.75" fill="currentColor" />
                  </svg>
                )}
                {p.parent && <span className="shrink-0 font-semibold tabular-nums">{pct(node.weight)}</span>}
                {p.parent && node.children.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={`${open ? "Hide" : "Show"} what ${nameOf(node)} holds`}
                    onClick={() => toggle(node.id)}
                    className="-mr-1 grid size-5 shrink-0 place-items-center rounded transition-colors hover:bg-black/15"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className={`size-3 transition-transform duration-500 ease-out ${open ? "" : "-rotate-90"}`}
                    >
                      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Pointing at (or tabbing to) a product shows a card under its box, or above it
          when there's no room below on screen: a company's or fund's full name and what
          and where it is, or why we have no data on a holding. It is drawn over the page
          (a portal, fixed to the screen) so the map's scrolling area can't clip it. */}
      {cardFor &&
        cardBox &&
        (() => {
          const left = Math.max(8, Math.min(cardBox.left, window.innerWidth - CARD_W - 8));
          const below = cardBox.bottom + CARD_GAP + CARD_H <= window.innerHeight;
          return createPortal(
            <div
              id="map-hover-card"
              role="tooltip"
              className="pointer-events-none fixed z-50"
              style={{
                left,
                top: below ? cardBox.bottom + CARD_GAP : cardBox.top - CARD_GAP,
                width: CARD_W,
                transform: below ? undefined : "translateY(-100%)",
              }}
            >
              {/* Keyed, so moving to another product fades the new card in. */}
              <div
                key={active}
                className="map-caption relative rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg shadow-slate-300/50"
              >
                {/* The pointer: a small square turned on its corner, half hidden behind the
                    card, on the side facing the box and near the box's left end. */}
                <span
                  aria-hidden
                  className={`absolute size-2.5 rotate-45 border-slate-200 bg-white ${
                    below ? "-top-[5.5px] border-l border-t" : "-bottom-[5.5px] border-b border-r"
                  }`}
                  style={{ left: cardBox.left - left + 18 }}
                />
                {cardFor.missing ? (
                  <>
                    <p className="font-semibold text-slate-900">{missingNotice(cardFor.missing).title}</p>
                    <p className="mt-1">{missingNotice(cardFor.missing).text}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold leading-snug text-slate-900">{cardFor.label}</p>
                    <p className="text-slate-400">
                      {cardFor.symbol}
                      {cardFor.kind === "fund" ? " · Fund" : ""}
                    </p>
                    {detailRows(cardFor).length > 0 && (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-slate-100 pt-2">
                        {detailRows(cardFor).map(([label, value]) => (
                          <div key={label} className="contents">
                            <dt className="text-slate-400">{label}</dt>
                            <dd className="text-slate-700">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </>
                )}
              </div>
            </div>,
            document.body,
          );
        })()}

    </div>
  );
}
