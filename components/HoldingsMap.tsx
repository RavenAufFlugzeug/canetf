"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PalettePicker, savePalette, shade, useChartPalette, type PaletteName } from "@/components/EtfBreakdown";
import type { EtfTreeNode, MissingReason } from "@/lib/db";

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
const NOTICE_W = 248; // the notice beside a holding we have no data on
const NOTICE_H = 96; // about its height, to decide whether it fits below the box

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

const LEGEND: { kind: EtfTreeNode["kind"]; text: string }[] = [
  { kind: "fund", text: "Fund" },
  { kind: "holding", text: "Company or single holding" },
  { kind: "rating", text: "Credit rating" },
  { kind: "other", text: "Not itemised" },
];

const BOX: Record<Exclude<EtfTreeNode["kind"], "fund">, string> = {
  holding: "border border-slate-300 bg-white text-slate-900",
  rating: "border border-slate-900 bg-slate-800 text-white",
  other: "border border-slate-300 bg-slate-200 text-slate-600",
};
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
export default function HoldingsMap({ tree, detail = null }: { tree: EtfTreeNode; detail?: string | null }) {
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
  const stored = useChartPalette();
  // If the browser blocks storage, the choice still applies on this page.
  const [picked, setPicked] = useState<PaletteName | null>(null);
  const palette = picked ?? stored;

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
  // Funds get darker shades the nearer they are to the chosen ETF.
  const fundShade = (depth: number) => shade(palette, depth, levels + 2);
  const lit = fundShade(0).color;

  // What React draws: the finished map, or the first frame of a change.
  const shown = plan.moves.map((m) => ({ ...m, at: pose(m, moving ? 0 : 1, plan.span) }));
  const at = new Map(shown.map((s) => [s.p.node.id, s.at]));
  // The first time the map appears, its boxes slide in level by level instead.
  const intro = !fold.changed;

  // Nothing lights up while the map is moving.
  const point = (id: string | null) => {
    if (!moving) setActive(id);
  };
  const onPath = (id: string) => active !== null && (active === id || active.startsWith(`${id}.`));
  const current = shown.find((s) => s.p.node.id === active)?.p ?? null;
  const noticeFor = !moving ? (current?.node.missing ?? null) : null;
  const noticeAt = current ? at.get(current.node.id) : undefined;
  const allFolded = foldable.every(({ node }) => fold.to.has(node.id));
  const allOpen = fold.to.size === 0;
  const bulkButton =
    "group inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition duration-200 ease-out hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm active:scale-95 active:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";
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
            <span
              className={`h-3 w-5 rounded-sm ${kind === "fund" ? "" : BOX[kind]}`}
              style={kind === "fund" ? { backgroundColor: lit } : undefined}
            />
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
                    stroke={lit}
                    strokeLinecap="round"
                    strokeWidth={linkWidth(p) + 1.5}
                  />
                );
              })}
            </svg>
          )}

          {shown.map(({ p, mode, at: here }) => {
            const { node } = p;
            const fund = node.kind === "fund";
            const colours = fund ? fundShade(p.depth) : null;
            const on = onPath(node.id);
            const open = !fold.to.has(node.id);
            return (
              <div
                key={node.id}
                ref={(el) => {
                  if (el) nodeEls.current.set(node.id, el);
                  else nodeEls.current.delete(node.id);
                }}
                onPointerEnter={() => point(node.id)}
                onPointerLeave={() => point(null)}
                onFocus={() => point(node.id)}
                onBlur={() => point(null)}
                // Holdings we have no data on explain why in their own notice instead, and
                // can be tabbed to so keyboard users can read it.
                title={node.missing ? undefined : `${node.label}${p.parent ? `: ${pct(node.weight)} of ${nameOf(p.parent.node)}` : ""}`}
                tabIndex={node.missing ? 0 : undefined}
                aria-describedby={node.missing && active === node.id ? "map-missing-notice" : undefined}
                // Boxes on their way out can't be pointed at or tabbed to.
                inert={mode === "leave"}
                // lit: the one pointed at. path: the funds it sits in. Their lift and
                // outline are in globals.css.
                data-state={active === node.id ? "lit" : on ? "path" : undefined}
                data-selected={node.stored && node.symbol === detail ? "" : undefined}
                className={`map-node absolute left-0 top-0 flex items-center gap-1.5 rounded-md px-2 text-xs ${
                  intro ? "map-node-in" : ""
                } ${fund ? "" : node.missing ? MISSING_BOX : BOX[node.kind as keyof typeof BOX]}`}
                style={{
                  // Placed with `translate`, which moves a box without the browser having
                  // to lay the page out again (and leaves `transform` free for the lift).
                  translate: `${here.x}px ${here.y}px`,
                  width: NODE_W,
                  height: NODE_H,
                  // Funds stay above the boxes sliding out of (or back into) them; lit
                  // boxes sit above the white sheet.
                  zIndex: on ? levels + 4 : levels - p.depth + 1,
                  backgroundColor: colours?.color,
                  color: colours?.ink,
                  opacity: here.opacity,
                  animationDelay: `${p.depth * 90}ms`,
                }}
              >
                {node.symbol &&
                  (node.stored ? (
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

          {/* Pointing at (or tabbing to) a holding we have no data on explains why, in a
              notice under the box, or above it near the bottom of the map. */}
          {noticeFor && noticeAt && (
            <div
              id="map-missing-notice"
              role="tooltip"
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width: NOTICE_W,
                translate: `${Math.max(0, Math.min(noticeAt.x, plan.width - NOTICE_W))}px ${
                  noticeAt.y + NODE_H + 8 + NOTICE_H <= plan.heightTo ? noticeAt.y + NODE_H + 8 : noticeAt.y - 8
                }px`,
                transform: noticeAt.y + NODE_H + 8 + NOTICE_H <= plan.heightTo ? undefined : "translateY(-100%)",
                zIndex: levels + 5,
              }}
            >
              {/* Keyed, so moving to another such holding fades the new notice in. */}
              <div
                key={active}
                className="map-caption rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 shadow-lg shadow-slate-300/50"
              >
                <p className="font-semibold text-slate-900">{missingNotice(noticeFor).title}</p>
                <p className="mt-1">{missingNotice(noticeFor).text}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The same colour choice as the Search page's chart, and shared with it. */}
      <div className="mt-4 flex justify-center">
        <PalettePicker
          current={palette}
          onPick={(name) => {
            setPicked(name);
            savePalette(name);
          }}
        />
      </div>
    </div>
  );
}
