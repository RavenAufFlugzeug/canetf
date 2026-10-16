"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { EtfBreakdown as Breakdown } from "@/lib/db";

// The breakdown is drawn as a treemap: one square split into tiles sized by weight.
// Tiles are ordered (largest share first), so they share one family of
// colours, from a deep shade for the first to a light one for the last. The steps are
// interpolated in OKLCH, which keeps them evenly spaced to the eye, and spread over
// however many tiles there are. Past 7 holdings fold into one pale grey "Other" tile.
// The viewer picks the family with the diamonds under the chart.
type Oklch = { l: number; c: number; h: number };
const PALETTES = {
  red: { label: "Red", deep: { l: 0.56, c: 0.21, h: 25 }, light: { l: 0.89, c: 0.09, h: 40 } },
  green: { label: "Green", deep: { l: 0.56, c: 0.16, h: 152 }, light: { l: 0.92, c: 0.13, h: 128 } },
  teal: { label: "Teal", deep: { l: 0.58, c: 0.12, h: 176 }, light: { l: 0.92, c: 0.09, h: 166 } },
  blue: { label: "Blue", deep: { l: 0.34, c: 0.18, h: 262 }, light: { l: 0.76, c: 0.11, h: 248 } },
} satisfies Record<string, { label: string; deep: Oklch; light: Oklch }>;
export type PaletteName = keyof typeof PALETTES;
const DEFAULT_PALETTE: PaletteName = "blue";

const oklch = ({ l, c, h }: Oklch, alpha = 1) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)} / ${alpha})`;
// The colour for tile i of n, and the text colour that reads on it.
export const shade = (palette: PaletteName, i: number, n: number) => {
  const { deep, light } = PALETTES[palette];
  const t = n <= 1 ? 0 : i / (n - 1);
  const mix = (a: number, b: number) => a + (b - a) * t;
  const l = mix(deep.l, light.l);
  return {
    color: oklch({ l, c: mix(deep.c, light.c), h: mix(deep.h, light.h) }),
    ink: l < 0.72 ? "#ffffff" : "#0f172a",
  };
};
const OTHER = "#e2e8f0";
const OTHER_INK = "#334155";

// The chosen family is remembered in this browser (localStorage) and shared by every chart.
const STORAGE_KEY = "canetf:pie-palette";
const CHANGE_EVENT = "canetf:pie-palette";
const isPalette = (v: string | null): v is PaletteName => v !== null && v in PALETTES;

function subscribePalette(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(CHANGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readPalette(): PaletteName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPalette(stored) ? stored : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE; // storage blocked: just use the default
  }
}

function savePalette(palette: PaletteName) {
  try {
    localStorage.setItem(STORAGE_KEY, palette);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// The family chosen in this browser, for any other chart that should follow it.
// The server always renders the default; the stored choice applies once in the browser.
export const useChartPalette = () =>
  useSyncExternalStore(subscribePalette, readPalette, () => DEFAULT_PALETTE);

// The colour family picker for the treemap: flat diamonds in each family's
// main shade. The chosen one is full size with a soft glow of its own colour; the rest
// sit back, faded.
export function PalettePicker({ current, onPick }: { current: PaletteName; onPick: (name: PaletteName) => void }) {
  return (
    <div role="radiogroup" aria-label="Chart colours" className="flex items-center gap-3.5 py-1">
      {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
        const { label, deep } = PALETTES[name];
        const selected = name === current;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} colours`}
            title={label}
            onClick={() => onPick(name)}
            // A small square turned 45 degrees.
            className={`size-3 rotate-45 rounded-[3px] transition duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-400 ${
              selected ? "scale-125 opacity-100" : "scale-90 opacity-40 hover:scale-110 hover:opacity-80"
            }`}
            style={{
              backgroundColor: oklch(deep),
              boxShadow: selected ? `0 0 0 4px ${oklch(deep, 0.18)}, 0 2px 8px ${oklch(deep, 0.35)}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

// Picks a colour family for every chart in this browser.
export { savePalette };

const MAX_SLICES = 7;

const SIZE = 240; // the treemap's width and height
const GAP = 2; // white space between tiles

type Row = { key: string; label: string; symbol: string | null; weight: number; color: string; slice: string };
// `short` is what goes on a tile: the ticker (shortened to fit, see fitName), the rating,
// or "Other".
type Slice = { key: string; label: string; short: string; weight: number; color: string; ink: string };

const pct = (w: number) => `${(w * 100).toFixed(1)}%`;

// Tile labels: their sizes, and the space kept clear between a label and its tile's edges.
const NAME_PX = 11.5;
const PCT_PX = 11;
const LABEL_PAD = 6;

// Arial Bold's capital letter widths, in em (the regular weight's are the same or a
// little narrower, so these serve for both).
const CAPS: Record<string, number> = {
  A: 0.722, B: 0.722, C: 0.722, D: 0.722, E: 0.667, F: 0.611, G: 0.778, H: 0.722, I: 0.278,
  J: 0.556, K: 0.722, L: 0.611, M: 0.833, N: 0.722, O: 0.778, P: 0.667, Q: 0.778, R: 0.722,
  S: 0.667, T: 0.611, U: 0.722, V: 0.667, W: 0.944, X: 0.667, Y: 0.667, Z: 0.611,
};

// About how wide `text` is in Arial (the page font) at `px`, rounded up a little so a
// label never ends up touching its tile's edge.
function textWidth(text: string, px: number) {
  let em = 0;
  for (const ch of text) {
    if (ch in CAPS) em += CAPS[ch];
    else if (/[0-9]/.test(ch)) em += 0.556;
    else if (/[ijlf.,' ]/.test(ch)) em += 0.278;
    else if (/[rt-]/.test(ch)) em += 0.389;
    else if (ch === "%") em += 0.889;
    else if (/[mw]/.test(ch)) em += 0.889;
    else em += 0.611; // other lowercase letters (bold), and anything else
  }
  return em * px * 1.05;
}

// What of `name` fits in `room` px, or null: the whole of it, or else it shortened a
// dot-separated part at a time from the end (ASML.AS -> ASML, ABCD.EF.HI -> ABCD.EF), never
// cut mid-word.
function fitName(name: string, room: number) {
  const parts = name.split(".");
  for (let n = parts.length; n >= 1; n--) {
    const shown = parts.slice(0, n).join(".");
    if (textWidth(shown, NAME_PX) <= room) return shown;
  }
  return null;
}

function build({ kind, items }: Breakdown, palette: PaletteName): { slices: Slice[]; rows: Row[] } {
  if (kind === "rating") {
    const shades = items.map((_, i) => shade(palette, i, items.length));
    const rows = items.map((it, i) => ({
      key: it.label,
      label: it.label,
      symbol: null,
      weight: it.weight,
      color: shades[i].color,
      slice: it.label,
    }));
    const slices = rows.map(({ key, label, weight, color }, i) => ({
      key, label, short: label, weight, color, ink: shades[i].ink,
    }));
    return { slices, rows };
  }

  // Holdings: the largest 7 get a tile each; the rest of the listed ones and the part of
  // the fund Yahoo doesn't list share the grey "Other" tile.
  const shades = items.map((_, i) => shade(palette, i, Math.min(items.length, MAX_SLICES)));
  const rows: Row[] = items.map((it, i) => ({
    key: `${it.symbol ?? it.label}-${i}`,
    label: it.label,
    symbol: it.symbol,
    weight: it.weight,
    color: i < MAX_SLICES ? shades[i].color : OTHER,
    slice: i < MAX_SLICES ? `${it.symbol ?? it.label}-${i}` : "other",
  }));
  const listed = items.reduce((sum, it) => sum + it.weight, 0);
  const unlisted = Math.max(0, 1 - listed);
  if (unlisted > 0.001) {
    rows.push({ key: "unlisted", label: "Rest of the fund (not listed)", symbol: null, weight: unlisted, color: OTHER, slice: "other" });
  }
  const slices: Slice[] = rows
    .filter((r) => r.slice !== "other")
    .map(({ key, label, symbol, weight, color }, i) => ({
      // On a tile the exchange suffix is dropped (BMO.TO -> BMO); the list shows it in full.
      key, label, short: symbol ?? label, weight, color, ink: shades[i].ink,
    }));
  const other = rows.filter((r) => r.slice === "other").reduce((sum, r) => sum + r.weight, 0);
  if (other > 0.001) {
    slices.push({ key: "other", label: "Other", short: "Other", weight: other, color: OTHER, ink: OTHER_INK });
  }
  return { slices, rows };
}

// ---------------------------------------------------------------------------
// Squarified treemap (Bruls, Huizing & van Wijk): fills the square with rectangles
// whose areas match the weights, keeping each as close to square as possible.
// ---------------------------------------------------------------------------
type Box = { x: number; y: number; w: number; h: number };

// How far from square the worst tile in a row would be, laid along a side of this length.
function worstRatio(row: number[], side: number) {
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

function squarify(areas: number[], box: Box): Box[] {
  const out: Box[] = [];
  let free = { ...box };
  let i = 0;
  while (i < areas.length) {
    // Grow a row along the free area's shorter side while that keeps the tiles squarer.
    const side = Math.min(free.w, free.h);
    const row = [areas[i]];
    let next = i + 1;
    while (next < areas.length && worstRatio([...row, areas[next]], side) <= worstRatio(row, side)) {
      row.push(areas[next]);
      next++;
    }
    const sum = row.reduce((a, b) => a + b, 0);
    if (free.w >= free.h) {
      // A column down the left of the free area.
      const width = sum / free.h;
      let y = free.y;
      for (const a of row) {
        out.push({ x: free.x, y, w: width, h: a / width });
        y += a / width;
      }
      free = { x: free.x + width, y: free.y, w: free.w - width, h: free.h };
    } else {
      // A row along the top of the free area.
      const height = sum / free.w;
      let x = free.x;
      for (const a of row) {
        out.push({ x, y: free.y, w: a / height, h: height });
        x += a / height;
      }
      free = { x: free.x, y: free.y + height, w: free.w, h: free.h - height };
    }
    i = next;
  }
  return out;
}

// Each tile's box, laid out largest first (which squarify needs to work well).
function withBoxes(slices: Slice[]) {
  const total = slices.reduce((sum, s) => sum + s.weight, 0) || 1;
  const order = slices.map((s, i) => ({ s, i })).sort((a, b) => b.s.weight - a.s.weight);
  const boxes = squarify(
    order.map(({ s }) => (s.weight / total) * SIZE * SIZE),
    { x: 0, y: 0, w: SIZE, h: SIZE },
  );
  return order.map(({ s, i }, k) => ({ ...s, box: boxes[k], order: i }));
}

export default function EtfBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const [active, setActive] = useState<string | null>(null);
  // The list row under the pointer, which shows its tooltip.
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const palette = useChartPalette();
  // If storage is blocked, the choice still applies on this page.
  const [picked, setPicked] = useState<PaletteName | null>(null);
  const current = picked ?? palette;
  const { slices, rows } = build(breakdown, current);
  const listed = breakdown.items.reduce((sum, it) => sum + it.weight, 0);

  const heading = breakdown.kind === "holding" ? "Top holdings" : "Credit quality";
  const note =
    breakdown.kind === "rating"
      ? "The fund's bonds by credit rating, largest share first."
      : breakdown.items.length === 1
        ? "The whole fund is in this one holding."
        : `Its ${breakdown.items.length} largest holdings make up ${pct(Math.min(listed, 1))} of the fund.`;

  const tiles = withBoxes(slices);
  const clipId = useId(); // unique per chart, for clipping each tile's label
  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
      <p className="mt-1 text-sm text-slate-500">{note}</p>

      <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-start">
        <div className="flex shrink-0 flex-col items-center gap-4">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`${heading}: ${slices.map((s) => `${s.label} ${pct(s.weight)}`).join(", ")}`}
            className="shrink-0 overflow-visible"
          >
            {tiles.map((t) => {
              const lit = active === t.key;
              const dimmed = active !== null && !lit;
              // Inset by half the gap on each side, so neighbouring tiles sit apart.
              const x = t.box.x + GAP / 2;
              const y = t.box.y + GAP / 2;
              const w = Math.max(t.box.w - GAP, 0);
              const h = Math.max(t.box.h - GAP, 0);
              // Name and percentage when the tile has room for both, just the name (maybe
              // shortened, see fitName) when it's small, nothing when not even that fits (the
              // list and tooltip still have it all). LABEL_PAD stays clear on every side.
              const room = w - 2 * LABEL_PAD;
              const share = pct(t.weight);
              const name = fitName(t.short, room);
              // Two lines: baselines 18 and 33px down, then the descent and the padding.
              const both =
                name !== null && textWidth(share, PCT_PX) <= room && h >= 33 + 3 + LABEL_PAD;
              // One line, centred: the text's box is about 1.15em tall, with 4px clear above
              // and below it.
              const nameOnly = !both && name !== null && h >= NAME_PX * 1.15 + 2 * 4;
              return (
                <g
                  key={t.key}
                  onPointerEnter={() => setActive(t.key)}
                  onPointerLeave={() => setActive(null)}
                  // Hover state drives the lift / fade-back styles in globals.css.
                  data-state={lit ? "lit" : dimmed ? "dimmed" : undefined}
                  className="tile-in breakdown-tile"
                  style={{ animationDelay: `${450 + t.order * 60}ms` }}
                >
                  {/* fill as a style, so switching colour families eases from one to the other */}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={4}
                    className="breakdown-fill"
                    style={{ fill: t.color }}
                  />
                  {/* Labels never spill out of their tile. */}
                  <clipPath id={`${clipId}-${t.order}`}>
                    <rect x={x} y={y} width={Math.max(w - 2, 0)} height={h} />
                  </clipPath>
                  {(both || nameOnly) && (
                    <text
                      x={x + LABEL_PAD}
                      y={y + (both ? 18 : h / 2)}
                      dy={both ? 0 : "0.35em"}
                      fill={t.ink}
                      fontSize={PCT_PX}
                      pointerEvents="none"
                      clipPath={`url(#${clipId}-${t.order})`}
                    >
                      <tspan fontWeight={600} fontSize={NAME_PX}>
                        {name}
                      </tspan>
                      {both && (
                        <tspan x={x + LABEL_PAD} dy={15} opacity={0.85}>
                          {share}
                        </tspan>
                      )}
                    </text>
                  )}
                  <title>{`${t.label}: ${pct(t.weight)}`}</title>
                </g>
              );
            })}
          </svg>

          <PalettePicker
            current={current}
            onPick={(name) => {
              setPicked(name);
              savePalette(name);
            }}
          />
        </div>

        <ul className="w-full min-w-0 flex-1 text-sm">
          {rows.map((r, i) => {
            const lit = active !== null && active === r.slice;
            const shown = hoveredRow === r.key;
            // A line of context under the full name.
            const context =
              breakdown.kind === "rating"
                ? `Share of the fund's bonds rated ${r.label}`
                : r.key === "unlisted"
                  ? `Everything outside the ${breakdown.items.length} largest holdings`
                  : r.slice === "other"
                    ? `#${i + 1} holding · in the grey "Other" slice`
                    : `#${i + 1} holding`;
            return (
              <li
                key={r.key}
                onPointerEnter={() => {
                  setActive(r.slice);
                  setHoveredRow(r.key);
                }}
                onPointerLeave={() => {
                  setActive(null);
                  setHoveredRow(null);
                }}
                className={`relative flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-200 ${
                  lit ? "bg-slate-100" : ""
                }`}
              >
                <span className="size-3 shrink-0 rounded-sm transition-colors duration-500" style={{ backgroundColor: r.color }} />
                <span className="min-w-0 flex-1 truncate">
                  {r.symbol && <span className="font-semibold text-slate-900">{r.symbol} </span>}
                  <span className={r.symbol ? "text-slate-500" : "text-slate-700"}>{r.label}</span>
                </span>
                <span className="font-semibold tabular-nums text-slate-900">{pct(r.weight)}</span>

                {/* Tooltip: the full name (the row may cut it off) and where it sits in the fund. */}
                <div
                  role="tooltip"
                  aria-hidden={!shown}
                  className={`pointer-events-none absolute bottom-full left-5 z-20 mb-1.5 w-max max-w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg transition duration-150 ease-out ${
                    shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm transition-colors duration-500" style={{ backgroundColor: r.color }} />
                    <span className="font-semibold text-slate-900">{r.symbol ?? r.label}</span>
                    <span className="ml-auto pl-4 font-semibold tabular-nums text-slate-900">{pct(r.weight)}</span>
                  </div>
                  {r.symbol && <p className="mt-1 text-slate-700">{r.label}</p>}
                  <p className="mt-1 text-xs text-slate-500">{context}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
