"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RangeTabs from "@/components/RangeTabs";
import { blend, easeOut, linePath, MORPH_MS, resample, type Shape } from "@/lib/chartMorph";

// The Sandbox test's price chart: the pick's history before the test (`history`, in grey)
// and every day of the test so far (`prices`, Day 1 to today), drawn like the Search
// page's chart (a 2px line, green when the test is up so far and red when down, over a
// light wash of the same colour) but with day numbers instead of dates, so it doesn't give
// away when the test takes place: the days before it count back from Day 1 (Day −1 is the
// trading day before it), and a line marks where it starts. Its ranges work as the Search
// page's do: the same buttons, a range appearing once there are that many days to show,
// and on a switch the line morphs into the new range's while the gridlines and day labels
// fade in. Pointing at the chart shows the nearest day's price in the same white tooltip,
// which glides along with the crosshair and fades in and out.
const RANGES = [
  { key: "5D", days: 5 },
  { key: "1M", days: 21 },
  { key: "3M", days: 63 },
  { key: "6M", days: 126 },
  { key: "1Y", days: 252 },
  { key: "5Y", days: 1260 },
] as const;
type Range = (typeof RANGES)[number]["key"] | "All";

const UP = "#15803d"; // green-700, as on the Search page's chart
const DOWN = "#dc2626"; // red-600
const PAST = "#94a3b8"; // slate-400: the days before the test
const GRID = "#e2e8f0";
const INK = "#64748b";
const HEIGHT = 220;
const MARGIN = { top: 40, right: 64, bottom: 28, left: 8 }; // the tooltip sits in the top margin
const TIP_PAD = 26; // the tooltip's horizontal padding (px-3) and border, around its text

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

// About `count` round values covering lo..hi, for the price gridlines.
function ticks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

// A day's name: Day 1 onwards for the test, and Day −1, −2… counting back before it.
const dayName = (d: number) => `Day ${d >= 1 ? d : `−${1 - d}`}`;

// What morphs on a range switch: the line, and where the test starts along it.
type View = { shape: Shape; start: number };
const blendView = (a: View, b: View, t: number): View => ({
  shape: blend(a.shape, b.shape, t),
  start: a.start + (b.start - a.start) * t,
});

export default function SandboxChart({ history, prices }: { history: number[]; prices: number[] }) {
  const [range, setRange] = useState<Range>("3M");
  // The day pointed at (an index into the days shown), and whether the pointer is on the
  // chart: the crosshair and tooltip stay at the last day pointed at while they fade out.
  const [hover, setHover] = useState<{ at: number; on: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  // The chart fills its container's width.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const series = useMemo(() => [...history, ...prices], [history, prices]);
  const total = series.length;
  const offered = RANGES.filter((r) => total >= r.days);
  // The range chosen (3M to begin with), or "All" while there aren't that many days.
  const chosen = offered.find((r) => r.key === range);
  const current: Range = chosen?.key ?? "All";
  const first = total - (chosen ? chosen.days : total); // index of the first day shown
  const slice = useMemo(() => series.slice(first), [series, first]);
  const last = slice.length - 1;
  // The day an index into `slice` is (Day 1 is the test's first), and where the test's
  // days begin in it (0 when the range shows none of the days before).
  const dayOf = (i: number) => first + i - history.length + 1;
  const testFrom = Math.max(history.length - first, 0);

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const bottom = MARGIN.top + plotH;
  const { yTicks, yMin, yMax } = useMemo(() => {
    const lo = Math.min(...slice);
    const hi = Math.max(...slice);
    const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.02 || 1;
    const t = ticks(lo - pad, hi + pad);
    return { yTicks: t, yMin: Math.min(lo - pad, t[0]), yMax: Math.max(hi + pad, t[t.length - 1]) };
  }, [slice]);
  const sx = (i: number) => MARGIN.left + (last === 0 ? plotW / 2 : (i / last) * plotW);
  const sy = (v: number) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const color = prices[prices.length - 1] >= prices[0] ? UP : DOWN;

  // This range's line in pixels, resampled so it can morph into the next range's, and
  // where the test starts along it.
  const view = useMemo((): View => {
    const px = slice.map((_, i) => MARGIN.left + (last === 0 ? plotW / 2 : (i / last) * plotW));
    const py = slice.map((v) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin)) * plotH);
    return { shape: resample(px, py), start: px[Math.min(testFrom, last)] };
  }, [slice, last, plotW, plotH, yMin, yMax, testFrom]);

  // While a morph runs, `frame` holds the in-between view for `range` (as on the Search
  // page's chart: components/PriceChart.tsx).
  const [frame, setFrame] = useState<{ range: Range; view: View } | null>(null);
  const shown = useRef<{ range: Range; view: View | null }>({ range: current, view });
  const frameRef = useRef<View | null>(null);

  useEffect(() => {
    const from = frameRef.current ?? shown.current.view;
    const rangeChanged = shown.current.range !== current;
    shown.current = { range: current, view };

    let raf = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || !rangeChanged || reduceMotion) {
      // Nothing to animate (first render, a new day, a resize): settle on the final shape.
      if (frameRef.current) {
        raf = requestAnimationFrame(() => {
          frameRef.current = null;
          setFrame(null);
        });
      }
      return () => cancelAnimationFrame(raf);
    }

    // Timed from the first frame.
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min((now - start) / MORPH_MS, 1);
      if (t < 1) {
        frameRef.current = blendView(from, view, easeOut(t));
        setFrame({ range: current, view: frameRef.current });
        raf = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setFrame(null);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [current, view]);

  // Mid-morph, the in-between line; otherwise the exact one (with more days than pixels,
  // only every so many are drawn, always both ends, which looks the same).
  const morph = frame?.range === current ? frame.view : null;
  const every = Math.max(1, Math.floor(slice.length / (plotW * 1.5)));
  const drawn = slice.map((_, i) => i).filter((i) => i % every === 0 || i === last);
  const line = morph
    ? linePath(morph.shape.xs, morph.shape.ys)
    : linePath(drawn.map(sx), drawn.map((i) => sy(slice[i])));
  const startX = morph ? morph.start : sx(Math.min(testFrom, last));
  const [left, right] = morph ? [morph.shape.xs[0], morph.shape.xs[morph.shape.xs.length - 1]] : [sx(0), sx(last)];
  const area = `${line}L${right.toFixed(1)},${bottom}L${left.toFixed(1)},${bottom}Z`;
  // The line is drawn twice, each kept to its side of where the test starts: grey before
  // it, coloured (with the wash under it) from Day 1 on. Ids unique to this chart.
  const [clip] = useState(() => `sandbox-${Math.random().toString(36).slice(2)}`);

  // Day labels along the bottom: the first and last day shown, and a few between.
  const labelCount = Math.min(slice.length, Math.max(2, Math.floor(plotW / 90)));
  const xLabels = [
    ...new Set(
      Array.from({ length: labelCount }, (_, k) => (labelCount === 1 ? 0 : Math.round((k / (labelCount - 1)) * last))),
    ),
  ];

  // The day nearest the pointer, as an index into `slice`.
  function point(clientX: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left - MARGIN.left;
    const i = last === 0 ? 0 : Math.round((x / plotW) * last);
    setHover({ at: Math.min(Math.max(i, 0), last), on: true });
  }
  const at = hover && hover.at <= last ? hover.at : null;
  const visible = Boolean(hover?.on) && at !== null && !morph;
  const tone = (i: number) => (i >= testFrom ? color : PAST);
  // The tooltip's text, and about how wide it is, to keep it within the chart's edges.
  const tipPrice = at !== null ? money.format(slice[at]) : "";
  const tipDay = at !== null ? dayName(dayOf(at)) : "";
  const tipWidth = (tipPrice.length + tipDay.length + 1) * 7.6 + TIP_PAD;
  const tipLeft = at !== null ? Math.min(Math.max(sx(at), tipWidth / 2), width - tipWidth / 2) : 0;
  const markerRight = startX > MARGIN.left + plotW - 70;

  return (
    <div className="mt-4">
      <RangeTabs
        ranges={[...offered.map((r) => r.key), "All"] as Range[]}
        range={current}
        onPick={(r) => {
          // Keep showing the current line until the morph starts, so the new range's
          // final line never flashes for a frame first.
          const now = frameRef.current ?? view;
          if (r !== current) {
            frameRef.current = now;
            setFrame({ range: r, view: now });
          }
          setRange(r);
          setHover(null);
        }}
      />

      <div
        ref={box}
        className="relative mt-2 touch-none select-none"
        onPointerMove={(e) => point(e.clientX)}
        onPointerDown={(e) => point(e.clientX)}
        onPointerLeave={() => setHover((h) => h && { ...h, on: false })}
      >
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Closing price from ${dayName(dayOf(0))} to ${dayName(dayOf(last))}: ${money.format(slice[0])} to ${money.format(slice[last])}`}
          className="block"
        >
          <defs>
            <clipPath id={`${clip}-past`}>
              <rect x={0} y={0} width={Math.max(startX, 0)} height={HEIGHT} />
            </clipPath>
            <clipPath id={`${clip}-test`}>
              <rect x={startX} y={0} width={Math.max(width - startX, 0)} height={HEIGHT} />
            </clipPath>
          </defs>

          {/* Gridlines and day labels fade in with each range, as on the Search page. */}
          <g key={current} className="chart-fade">
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(v)} y2={sy(v)} stroke={GRID} />
                <text x={MARGIN.left + plotW + 8} y={sy(v)} dy="0.32em" fontSize={12} fill={INK}>
                  {money.format(v)}
                </text>
              </g>
            ))}
            {xLabels.map((i) => (
              <text
                key={i}
                x={sx(i)}
                y={bottom + 18}
                fontSize={12}
                fill={INK}
                textAnchor={i === 0 && last > 0 ? "start" : i === last && last > 0 ? "end" : "middle"}
              >
                {dayName(dayOf(i))}
              </text>
            ))}
          </g>

          {/* Where the test starts, when the days before it are in view. */}
          {startX > MARGIN.left + 0.5 && (
            <g>
              <line x1={startX} x2={startX} y1={MARGIN.top} y2={bottom} stroke="#cbd5e1" />
              <text
                x={startX + (markerRight ? -4 : 4)}
                y={MARGIN.top + 12}
                fontSize={11}
                fill={INK}
                textAnchor={markerRight ? "end" : "start"}
              >
                Test starts
              </text>
            </g>
          )}

          {/* On first appearance the line draws itself and the wash fades in under it, as
              on the Search page. */}
          {last > 0 && (
            <>
              <path
                d={area}
                clipPath={`url(#${clip}-test)`}
                fillOpacity={0.1}
                className="chart-area-in"
                style={{ fill: color, transition: "fill 300ms" }}
              />
              <path
                d={line}
                pathLength={1}
                clipPath={`url(#${clip}-past)`}
                className="chart-draw"
                fill="none"
                stroke={PAST}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={line}
                pathLength={1}
                clipPath={`url(#${clip}-test)`}
                className="chart-draw"
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: color, transition: "stroke 300ms" }}
              />
            </>
          )}
          {/* Today, at the end of the line. */}
          {!morph && <circle cx={sx(last)} cy={sy(slice[last])} r={4} fill={color} stroke="#fff" strokeWidth={2} />}

          {/* Crosshair and dot, as on the Search page's chart: they fade in, glide from day
              to day and fade out. */}
          {at !== null && (
            <g pointerEvents="none" className="chart-hover" style={{ opacity: visible ? 1 : 0 }}>
              <line
                x1={0}
                x2={0}
                y1={MARGIN.top}
                y2={bottom}
                stroke="#94a3b8"
                className="chart-follow"
                style={{ transform: `translateX(${sx(at)}px)` }}
              />
              <circle
                r={5}
                stroke="#fff"
                strokeWidth={2}
                className="chart-follow"
                style={{ transform: `translate(${sx(at)}px, ${sy(slice[at])}px)`, fill: tone(at) }}
              />
            </g>
          )}
        </svg>

        {at !== null && (
          // The day's price in the top margin, over the crosshair, kept within the chart.
          <div
            aria-live="polite"
            aria-hidden={!visible}
            className="chart-tip pointer-events-none absolute top-0 overflow-hidden whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-sm shadow"
            style={{ left: tipLeft, opacity: visible ? 1 : 0, transform: "translateX(-50%)" }}
          >
            <span className="font-semibold tabular-nums text-slate-900">{tipPrice}</span>{" "}
            <span className="text-slate-500">{tipDay}</span>
          </div>
        )}
      </div>
    </div>
  );
}
