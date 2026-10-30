"use client";

import { useState } from "react";
import { useSwapChanged } from "@/components/SandboxSwap";
import { squarify, textWidth, type Box } from "@/components/EtfBreakdown";
import type { PickCard } from "@/components/PickCards";

const W = 560; // the chart's width and height, in its own units (it scales to fit)
const H = 280;
const GROUP_GAP = 4; // white space between sectors
const GAP = 2; // and between the picks in one
const PAD = 6; // kept clear round a tile's label
const NAME_PX = 11.5;
const SIZE_PX = 10.5;

type Mode = "value" | "count";
const MODES: { value: Mode; label: string }[] = [
  { value: "value", label: "Market value" },
  { value: "count", label: "Count" },
];

const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 });
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
// A pick on its tile: its kind and number ("Tech 1", "ETF 2").
const short = (name: string) => name.replace(/Company \((\d+)\)$/, " $1").replace(/ \((\d+)\)$/, " $1");

type Group = { key: string; label: string; color: string; ink: string; cards: PickCard[]; weight: number };

// The set's make-up, under the Sandbox's picking: a boxy chart (a treemap, as the Search
// page's ETF holdings have) of its picks in their NAICS sector groups. Each sector is a block
// in its colour, its size its picks' share of the set; inside it, a tile per pick, sized by its
// market value today (or all alike, with Count). A pick whose value isn't known counts as the
// set's middle one. Beside it, the sectors with how many picks and what share each has.
// Pointing at a tile or a sector lifts that sector's tiles and fades the rest, and the line
// under the chart says what is pointed at; switching between value and count, the tiles
// glide to their new places.
// The least share of the chart a sector's block is given, so it never shrinks out of sight.
const MIN_SHARE = 0.025;

export default function SetComposition({ cards }: { cards: PickCard[] }) {
  const [mode, setMode] = useState<Mode>("value");
  // After a change of choices (a new set), the tiles fade in together, quickly: the set comes
  // in whole, not box by box as it does when the page opens.
  const changed = useSwapChanged();
  const [group, setGroup] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  const known = cards
    .map((c) => c.size)
    .filter((s): s is number => s !== null && s > 0)
    .sort((a, b) => a - b);
  const middle = known.length ? known[Math.floor(known.length / 2)] : 1;
  const weightOf = (c: PickCard) => (mode === "count" ? 1 : c.size && c.size > 0 ? c.size : middle);

  // The sector groups, largest first; funds and picks with no sector each make one too.
  const byKey = new Map<string, Group>();
  for (const c of cards) {
    const key = c.sector ?? (c.kind === "ETF" ? "Funds (ETFs)" : "Sector unknown");
    const g = byKey.get(key) ?? { key, label: key, color: c.color, ink: c.ink, cards: [], weight: 0 };
    g.cards.push(c);
    g.weight += weightOf(c);
    byKey.set(key, g);
  }
  const groups = [...byKey.values()].sort((a, b) => b.weight - a.weight);
  const total = groups.reduce((sum, g) => sum + g.weight, 0) || 1;
  // Each sector's block's share of the chart: its share of the set, but never under MIN_SHARE,
  // so a small one (a 1B company beside trillion-dollar ones) is still a box that can be seen
  // and pointed at. The figures said keep its true share.
  const shown = groups.map((g) => Math.max(g.weight / total, MIN_SHARE));
  const shownTotal = shown.reduce((a, b) => a + b, 0);

  // Each sector's block, then each pick's tile inside it, largest first.
  const blocks = squarify(
    shown.map((s) => (s / shownTotal) * W * H),
    { x: 0, y: 0, w: W, h: H },
  );
  const tiles = groups.flatMap((g, gi) => {
    const b = blocks[gi];
    const inner: Box = {
      x: b.x + GROUP_GAP / 2,
      y: b.y + GROUP_GAP / 2,
      w: Math.max(b.w - GROUP_GAP, 0),
      h: Math.max(b.h - GROUP_GAP, 0),
    };
    const sorted = [...g.cards].sort((a, b) => weightOf(b) - weightOf(a));
    const sum = sorted.reduce((s, c) => s + weightOf(c), 0) || 1;
    const boxes = squarify(
      sorted.map((c) => (weightOf(c) / sum) * inner.w * inner.h),
      inner,
    );
    return sorted.map((c, i) => ({ card: c, group: g, box: boxes[i], order: gi * 10 + i }));
  });

  const lit = pick ? (cards.find((c) => c.symbol === pick) ?? null) : null;
  const litGroup = group ? (byKey.get(group) ?? null) : null;
  const caption = lit
    ? `${lit.name} · ${lit.sector ?? (lit.kind === "ETF" ? "A fund" : "Sector unknown")} · ${
        lit.size
          ? `market value ${compact.format(lit.size)} CAD${lit.currency && lit.currency !== "CAD" ? ` (trades in ${lit.currency})` : ""}`
          : "market value not known"
      }`
    : litGroup
      ? `${litGroup.label}: ${litGroup.cards.length} of ${cards.length} picks, ${pct(litGroup.weight / total)} of the set by ${
          mode === "value" ? "market value" : "count"
        }`
      : "Point at a box or a sector to see it.";

  return (
    <div className="rise-in mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">What the set is made of</p>
          <p className="text-xs text-slate-500">
            By NAICS sector; each box a pick, sized by{" "}
            {mode === "value" ? "its market value today" : "count, all alike"}.
          </p>
        </div>
        <div role="group" aria-label="Size boxes by" className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                mode === m.value
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-white hover:text-slate-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-start">
        <div className="min-w-0 flex-[3]">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`The set by sector: ${groups.map((g) => `${g.label} ${g.cards.length}`).join(", ")}`}
            className="block h-auto w-full overflow-visible"
            onPointerLeave={() => {
              setGroup(null);
              setPick(null);
            }}
          >
            {tiles.map((t) => {
              const x = t.box.x + GAP / 2;
              const y = t.box.y + GAP / 2;
              const w = Math.max(t.box.w - GAP, 0);
              const h = Math.max(t.box.h - GAP, 0);
              const on = group === t.group.key;
              const name = short(t.card.name);
              const size = mode === "value" && t.card.size ? compact.format(t.card.size) : "";
              const room = w - 2 * PAD;
              const fitsName = textWidth(name, NAME_PX) <= room && h >= NAME_PX * 1.15 + 2 * 4;
              const fitsBoth = fitsName && size !== "" && textWidth(size, SIZE_PX) <= room && h >= 32 + PAD;
              return (
                <g
                  key={t.card.symbol}
                  onPointerEnter={() => {
                    setGroup(t.group.key);
                    setPick(t.card.symbol);
                  }}
                  data-state={on ? "lit" : group !== null ? "dimmed" : undefined}
                  className={`${changed ? "tile-quick" : "tile-in"} breakdown-tile set-tile`}
                  style={changed ? undefined : { animationDelay: `${150 + Math.min(t.order, 40) * 30}ms` }}
                >
                  <rect
                    rx={4}
                    className="set-rect"
                    style={{ x, y, width: w, height: h, fill: t.group.color }}
                  />
                  {pick === t.card.symbol && (
                    <rect
                      rx={4}
                      className="set-rect pointer-events-none"
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth={2}
                      style={{ x: x + 1, y: y + 1, width: Math.max(w - 2, 0), height: Math.max(h - 2, 0) }}
                    />
                  )}
                  {fitsName && (
                    <text
                      className="set-label"
                      fill={t.group.ink}
                      pointerEvents="none"
                      style={{ transform: `translate(${x + PAD}px, ${y + (fitsBoth ? 17 : h / 2)}px)` }}
                      dy={fitsBoth ? 0 : "0.35em"}
                    >
                      <tspan fontWeight={600} fontSize={NAME_PX}>
                        {name}
                      </tspan>
                      {fitsBoth && (
                        <tspan x={0} dy={14} fontSize={SIZE_PX} opacity={0.85}>
                          {size}
                        </tspan>
                      )}
                    </text>
                  )}
                  <title>{`${t.card.name}: ${t.group.label}${size ? `, ${size}` : ""}`}</title>
                </g>
              );
            })}
          </svg>
          <p key={caption} className="text-fade-in mt-2 min-h-5 text-xs text-slate-600">
            {caption}
          </p>
        </div>

        {/* The sectors: how many picks, and their share. */}
        <ul className="min-w-0 flex-[2] text-sm">
          {groups.map((g) => (
            <li
              key={g.key}
              onPointerEnter={() => setGroup(g.key)}
              onPointerLeave={() => setGroup(null)}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 transition duration-200 ${
                group === g.key ? "translate-x-1 bg-slate-100" : ""
              }`}
            >
              <span
                className={`size-3 shrink-0 rounded-sm transition-transform duration-300 ${group === g.key ? "scale-125" : ""}`}
                style={{ background: g.color }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-700">{g.label}</span>
              <span className="text-xs tabular-nums text-slate-500">
                {g.cards.length} {g.cards.length === 1 ? "pick" : "picks"}
              </span>
              <span className="w-11 text-right font-semibold tabular-nums text-slate-900">
                {pct(g.weight / total)}
              </span>
            </li>
          ))}
          {mode === "value" && known.length < cards.length && (
            <li className="px-2 pt-2 text-[11px] text-slate-500">
              {`${cards.length - known.length} with no market value on record count as the set’s middle size.`}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
