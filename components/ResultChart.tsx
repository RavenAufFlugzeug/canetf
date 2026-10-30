"use client";

import { useState } from "react";
import Tween from "@/components/Tween";

const W = 600;
const H = 204;
const TOP = 14;
const BOTTOM = 42; // the trades' lane and the day labels, under the chart
const LEFT = 4;
const RIGHT = 62;
const LANE = H - BOTTOM + 13; // where the trade marks sit, between the chart and the labels
const GLIDE = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease-out";

type Marker = { i: number; side: "Bought" | "Sold" };

// A line chart for the Sandbox's result: `values` one a day, with the stretch from `band[0]`
// to `band[1]` (indices) shaded and drawn in its own colour, green when it ended above where it
// began, red below, and what lies outside it in grey. The line draws itself in; the stretch's
// start and end are marked, with their values. The days anything was bought (▲) or sold (▼)
// are marked in a lane of their own under the chart, clear of the line and the day labels,
// each with a faint stem up to the line. Pointing along it, a marker glides from day to day
// and the line under it counts to that day's value and where it stands against the start.
export default function ResultChart({
  values,
  band = [0, values.length - 1],
  markers = [],
  format,
  dayLabel,
  bandLabel,
}: {
  values: number[];
  band?: [number, number];
  markers?: Marker[];
  format: (x: number) => string;
  dayLabel: (i: number) => string;
  bandLabel?: string;
}) {
  // The day pointed at (kept as the pointer leaves, so the marker fades out where it was).
  const [spot, setSpot] = useState<number | null>(null);
  const [pointing, setPointing] = useState(false);
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (i: number) => LEFT + (i / (values.length - 1)) * (W - LEFT - RIGHT);
  const y = (v: number) => TOP + (1 - (v - low) / span) * (H - TOP - BOTTOM);
  const line = (from: number, to: number) =>
    values
      .slice(from, to + 1)
      .map((v, k) => `${k ? "L" : "M"}${x(from + k).toFixed(1)} ${y(v).toFixed(1)}`)
      .join("");
  const [a, b] = band;
  const start = values[a];
  const end = values[b];
  const up = end >= start;
  const color = up ? "#15803d" : "#dc2626";
  const area = `${line(a, b)}L${x(b).toFixed(1)} ${H - BOTTOM}L${x(a).toFixed(1)} ${H - BOTTOM}Z`;
  const shown = pointing && spot !== null ? spot : b;
  const change = values[shown] - start;
  const changePct = start ? (change / start) * 100 : 0;
  // One mark per day and side, however many trades that day made.
  const marks = [...new Map(markers.map((m) => [`${m.i}-${m.side}`, m])).values()];

  function point(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const at = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((at - LEFT) / (W - LEFT - RIGHT)) * (values.length - 1));
    setSpot(Math.max(0, Math.min(values.length - 1, i)));
    setPointing(true);
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full cursor-crosshair touch-none select-none overflow-visible"
        onPointerMove={point}
        onPointerDown={point}
        onPointerLeave={() => setPointing(false)}
        role="img"
        aria-label={`${bandLabel ?? "Over the stretch"}: from ${format(start)} to ${format(end)}`}
      >
        {/* The stretch, shaded and named, when there is more than it. */}
        {(a > 0 || b < values.length - 1) && (
          <>
            <rect
              x={x(a)}
              y={TOP - 6}
              width={x(b) - x(a)}
              height={H - BOTTOM - TOP + 6}
              fill="#0f172a"
              opacity={0.05}
              rx={4}
            />
            {bandLabel && (
              <text x={x(a) + 6} y={TOP + 4} fontSize={10.5} fontWeight={600} fill="#475569">
                {bandLabel}
              </text>
            )}
          </>
        )}
        {/* The level it started at, and where it ended. */}
        <line x1={LEFT} x2={W - RIGHT} y1={y(start)} y2={y(start)} stroke="#cbd5e1" strokeDasharray="3 4" />
        <text x={W - RIGHT + 6} y={y(start)} dy="0.35em" fontSize={10.5} fill="#64748b">
          {format(start)}
        </text>
        {Math.abs(y(end) - y(start)) > 12 && (
          <text x={W - RIGHT + 6} y={y(end)} dy="0.35em" fontSize={10.5} fontWeight={700} fill={color}>
            {format(end)}
          </text>
        )}
        {/* Before and after the stretch, in grey; the stretch in its colour, over a soft fill. */}
        {a > 0 && (
          <path d={line(0, a)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinejoin="round" />
        )}
        {b < values.length - 1 && (
          <path d={line(b, values.length - 1)} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
        )}
        <path d={area} fill={color} opacity={0.08} className="result-area" />
        <path
          d={line(a, b)}
          pathLength={1}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="result-line"
        />
        {/* Its two ends. */}
        {[a, b].map((i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(values[i])}
            r={3.5}
            fill="#fff"
            stroke={i === a ? "#475569" : color}
            strokeWidth={2}
          />
        ))}
        {/* The trades, in their lane under the chart: a buy ▲ dark, a sale ▼ green, each with a
            faint stem up to the line (side by side when a day had both). */}
        <line x1={LEFT} x2={W - RIGHT} y1={H - BOTTOM} y2={H - BOTTOM} stroke="#e2e8f0" />
        {marks.map((m, k) => {
          const both = marks.some((o) => o.i === m.i && o.side !== m.side);
          const mx = x(m.i) + (both ? (m.side === "Bought" ? -5 : 5) : 0);
          const buy = m.side === "Bought";
          return (
            <g
              key={`${m.i}-${m.side}`}
              className="result-marker"
              style={{ animationDelay: `${600 + k * 40}ms` }}
            >
              <line
                x1={mx}
                x2={mx}
                y1={y(values[m.i]) + 4}
                y2={LANE - 6}
                stroke={buy ? "#0f172a" : "#16a34a"}
                strokeOpacity={0.18}
                strokeDasharray="2 3"
              />
              <path
                d={buy ? `M${mx} ${LANE - 4}l-4.5 7h9Z` : `M${mx} ${LANE + 3}l-4.5 -7h9Z`}
                fill={buy ? "#0f172a" : "#16a34a"}
              />
            </g>
          );
        })}
        {/* The day pointed at: a stem and a dot, gliding from day to day. */}
        <g
          pointerEvents="none"
          style={{
            transform: `translateX(${x(spot ?? b)}px)`,
            opacity: pointing ? 1 : 0,
            transition: GLIDE,
          }}
        >
          <line x1={0} x2={0} y1={TOP - 6} y2={H - BOTTOM} stroke="#0f172a" strokeOpacity={0.25} />
          <circle
            cx={0}
            cy={0}
            r={4.5}
            fill="#0f172a"
            stroke="#fff"
            strokeWidth={2}
            style={{ transform: `translateY(${y(values[spot ?? b])}px)`, transition: GLIDE }}
          />
        </g>
        <text x={LEFT} y={H - 4} fontSize={10.5} fill="#64748b">
          {dayLabel(0)}
        </text>
        <text x={W - RIGHT} y={H - 4} fontSize={10.5} fill="#64748b" textAnchor="end">
          {dayLabel(values.length - 1)}
        </text>
      </svg>
      <p className="mt-1 flex flex-wrap justify-between gap-x-4 text-xs tabular-nums text-slate-600">
        <span>
          <span key={shown} className="text-fade-in font-semibold text-slate-900">
            {dayLabel(shown)}
          </span>
          {" · "}
          <Tween value={values[shown]} format={format} />
        </span>
        <span
          className={`transition-colors duration-300 ${
            change > 0 ? "text-green-700" : change < 0 ? "text-red-600" : "text-slate-500"
          }`}
        >
          <Tween value={change} format={(c) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${format(Math.abs(c))}`} />
          {" ("}
          <Tween
            value={changePct}
            format={(p) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(2)}%`}
          />
          {") against the start"}
        </span>
      </p>
    </div>
  );
}
