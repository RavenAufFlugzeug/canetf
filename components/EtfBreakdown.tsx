"use client";

import { useState } from "react";
import type { EtfBreakdown as Breakdown } from "@/lib/db";

// Holdings are distinct things: categorical hues (the reference palette's first 7 slots).
// Past 7 they fold into one grey "Other" slice rather than inventing more colours.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
// Credit ratings are ordered (AAA is best): one hue, darkest for the highest rating.
// Steps are spread evenly across the ramp for however many ratings there are, so
// neighbouring ratings stay easy to tell apart.
const RATING_RAMP = ["#172554", "#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];
const rampStep = (i: number, n: number) =>
  RATING_RAMP[n <= 1 ? 0 : Math.round((i * (RATING_RAMP.length - 1)) / (n - 1))];
const OTHER = "#cbd5e1";
const MAX_SLICES = 7;

const SIZE = 220;
const R = 100;
const C = SIZE / 2;

type Row = { key: string; label: string; symbol: string | null; weight: number; color: string; slice: string };
type Slice = { key: string; label: string; weight: number; color: string };

const pct = (w: number) => `${(w * 100).toFixed(1)}%`;

function build({ kind, items }: Breakdown): { slices: Slice[]; rows: Row[] } {
  if (kind === "rating") {
    const rows = items.map((it, i) => ({
      key: it.label,
      label: it.label,
      symbol: null,
      weight: it.weight,
      color: rampStep(i, items.length),
      slice: it.label,
    }));
    return { slices: rows.map(({ key, label, weight, color }) => ({ key, label, weight, color })), rows };
  }

  // Holdings: the largest 7 get a slice each; the rest of the listed ones and the part of
  // the fund Yahoo doesn't list share the grey "Other" slice.
  const rows: Row[] = items.map((it, i) => ({
    key: `${it.symbol ?? it.label}-${i}`,
    label: it.label,
    symbol: it.symbol,
    weight: it.weight,
    color: i < MAX_SLICES ? CATEGORICAL[i] : OTHER,
    slice: i < MAX_SLICES ? `${it.symbol ?? it.label}-${i}` : "other",
  }));
  const listed = items.reduce((sum, it) => sum + it.weight, 0);
  const unlisted = Math.max(0, 1 - listed);
  if (unlisted > 0.001) {
    rows.push({ key: "unlisted", label: "Rest of the fund (not listed)", symbol: null, weight: unlisted, color: OTHER, slice: "other" });
  }
  const slices: Slice[] = rows
    .filter((r) => r.slice !== "other")
    .map(({ key, label, weight, color }) => ({ key, label, weight, color }));
  const other = rows.filter((r) => r.slice === "other").reduce((sum, r) => sum + r.weight, 0);
  if (other > 0.001) slices.push({ key: "other", label: "Other", weight: other, color: OTHER });
  return { slices, rows };
}

// Each slice's start and end angle, going round the pie in order.
function withAngles(slices: Slice[]) {
  const total = slices.reduce((sum, s) => sum + s.weight, 0) || 1;
  let start = 0;
  return slices.map((s) => {
    const a0 = (start / total) * 2 * Math.PI;
    start += s.weight;
    const a1 = (start / total) * 2 * Math.PI;
    return { ...s, a0, a1, mid: (a0 + a1) / 2 };
  });
}

// A pie slice from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise).
function arc(a0: number, a1: number) {
  const p = (a: number) => `${(C + R * Math.sin(a)).toFixed(2)},${(C - R * Math.cos(a)).toFixed(2)}`;
  return `M${C},${C} L${p(a0)} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
}

export default function EtfBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const [active, setActive] = useState<string | null>(null);
  // The list row under the pointer, which shows its tooltip.
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const { slices, rows } = build(breakdown);
  const listed = breakdown.items.reduce((sum, it) => sum + it.weight, 0);

  const heading = breakdown.kind === "holding" ? "Top holdings" : "Credit quality";
  const note =
    breakdown.kind === "rating"
      ? "The fund's bonds by credit rating, from highest (AAA) to lowest."
      : breakdown.items.length === 1
        ? "The whole fund is in this one holding."
        : `Its ${breakdown.items.length} largest holdings make up ${pct(Math.min(listed, 1))} of the fund.`;

  const paths = withAngles(slices);

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
      <p className="mt-1 text-sm text-slate-500">{note}</p>

      <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-start">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${heading}: ${slices.map((s) => `${s.label} ${pct(s.weight)}`).join(", ")}`}
          className="pie-in shrink-0 overflow-visible"
        >
          {paths.map((s) => {
            const lifted = active === s.key;
            // A hovered slice slides a little out of the pie, along its middle.
            const dx = lifted ? 6 * Math.sin(s.mid) : 0;
            const dy = lifted ? -6 * Math.cos(s.mid) : 0;
            const dimmed = active !== null && !lifted;
            const whole = s.a1 - s.a0 >= 2 * Math.PI - 1e-6;
            return (
              <g
                key={s.key}
                onPointerEnter={() => setActive(s.key)}
                onPointerLeave={() => setActive(null)}
                className="pie-slice"
                style={{ transform: `translate(${dx}px, ${dy}px)`, opacity: dimmed ? 0.4 : 1 }}
              >
                {whole ? (
                  <circle cx={C} cy={C} r={R} fill={s.color} />
                ) : (
                  // White edges keep neighbouring slices apart.
                  <path d={arc(s.a0, s.a1)} fill={s.color} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                )}
                <title>{`${s.label}: ${pct(s.weight)}`}</title>
              </g>
            );
          })}
        </svg>

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
                <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
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
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
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
