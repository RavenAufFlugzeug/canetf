"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSandboxExampleDay } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import RangeTabs from "@/components/RangeTabs";
import { blend, easeOut, linePath, MORPH_MS, resample, type Shape } from "@/lib/chartMorph";
import { testDayName } from "@/lib/tradingTime";

// The Sandbox test's price chart: the pick's history before the test (`history`, in grey)
// and every day of the test so far (`prices`, Day 1 to today), drawn like the Search
// page's chart (a 2px line, green when the test is up so far and red when down, over a
// light wash of the same colour) but with day numbers instead of dates, so it doesn't give
// away when the test takes place: the days before it count back from Day 1 (Day −1 is the
// trading day before it), and a line marks where it starts. Its ranges work as the Search
// page's do: the same ones (1D, 5D, 1M, 6M, YTD, 1Y, 5Y, All), a range appearing once there
// are that many days to show, and on a switch the line morphs into the new range's while the
// gridlines and day labels fade in. YTD runs from the first trading day of today's year
// (`yearStarts` says where each year begins, without giving the dates away). 1D can't show
// a day of the test (only recent days have prices through the day), so it shows an example
// instead: one recent day of the pick's, its date hidden (ExampleDay). When the test moves on, the new days slide in from the right as the chart
// scrolls along (or, showing every day, squeezes up to make room), the prices' scale easing
// to fit them, and the dot at the end rides along the line. Pointing at the chart shows the
// nearest day's price in the same white tooltip, which glides along with the crosshair and
// fades in and out.
const RANGES = [
  { key: "5D", days: 5 },
  { key: "1M", days: 21 },
  { key: "6M", days: 126 },
  { key: "YTD", days: 0 }, // from the year's first trading day (see ytdFrom)
  { key: "1Y", days: 252 },
  { key: "5Y", days: 1260 },
] as const;
// The ranges drawn as the pick's line, and with 1D (the example day) every range offered.
type Range = (typeof RANGES)[number]["key"] | "All";
type Tab = Range | "1D";
// An example day for 1D: each point's minutes into the session and its price (the open
// first); "loading" while it is fetched, null when the pick has none, undefined before it's
// asked for.
type Example = { minute: number; price: number }[] | null | "loading" | undefined;

const UP = "#15803d"; // green-700, as on the Search page's chart
const DOWN = "#dc2626"; // red-600
const PAST = "#94a3b8"; // slate-400: the days before the test
const GRID = "#e2e8f0";
const INK = "#64748b";
const HEIGHT = 220;
const MARGIN = { top: 40, right: 64, bottom: 28, left: 8 }; // the tooltip sits in the top margin
const TIP_PAD = 26; // the tooltip's horizontal padding (px-3) and border, around its text
const SLIDE_MS = 600; // how long new days take to slide in

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

// A day's name: Day 1 onwards for the test, and the days before it by how long before Day 1
// they are, in days, weeks, months or years ("−3 days", "−1 week", "≈ −3 months").
const dayName = testDayName;

// How far apart the day labels along the bottom may be, in trading days: a day or two, one,
// two or three weeks, a month or two, a quarter, half a year, a year or more. Labels sit on whole steps
// from Day 1, so those before it read as whole weeks, months or years.
const LABEL_STEPS = [1, 2, 5, 10, 15, 21, 42, 63, 126, 252, 504, 1260];

// What morphs on a range switch: the line, and where the test starts along it.
type View = { shape: Shape; start: number };
const blendView = (a: View, b: View, t: number): View => ({
  shape: blend(a.shape, b.shape, t),
  start: a.start + (b.start - a.start) * t,
});

// What the chart spans: from day `lo` to day `hi` (indices into every day, the days before
// the test first; fractional while sliding) and from price `yMin` to `yMax`.
type Span = { lo: number; hi: number; yMin: number; yMax: number };
const blendSpan = (a: Span, b: Span, t: number): Span => ({
  lo: a.lo + (b.lo - a.lo) * t,
  hi: a.hi + (b.hi - a.hi) * t,
  yMin: a.yMin + (b.yMin - a.yMin) * t,
  yMax: a.yMax + (b.yMax - a.yMax) * t,
});

export default function SandboxChart({
  symbol,
  history,
  prices,
  yearStarts,
  trades = [],
}: {
  symbol: string;
  history: number[];
  prices: number[];
  yearStarts: number[];
  // The player's trades, marked on the line where they were made: a green triangle pointing
  // up for a buy, a red one pointing down for a sale, each popping up as it is made.
  trades?: { day: number; side: "Bought" | "Sold"; price: number }[];
}) {
  const [range, setRange] = useState<Range>("1M");
  // Whether 1D (the example day) is showing instead of the line, and that day once fetched
  // (once per chart, so going back to 1D shows the same day).
  const [showDay, setShowDay] = useState(false);
  const [example, setExample] = useState<Example>(undefined);
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
  // Where today's year begins, for YTD: offered once that year has two days or more.
  const ytdFrom = yearStarts.findLast((i) => i < total) ?? null;
  const offered = RANGES.filter((r) =>
    r.key === "YTD" ? ytdFrom !== null && total - ytdFrom >= 2 : total >= r.days,
  );
  // The range chosen (1M to begin with), or "All" while there aren't that many days.
  const chosen = offered.find((r) => r.key === range);
  const current: Range = chosen?.key ?? "All";
  // The index of the first day shown.
  const first = !chosen ? 0 : chosen.key === "YTD" ? (ytdFrom ?? 0) : total - chosen.days;
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

  // New days: while the range stays the same, `slide` holds the in-between span as the
  // chart eases from what it spanned before to what it spans now.
  const [slide, setSlide] = useState<Span | null>(null);
  const slideRef = useRef<Span | null>(null);
  const settled = useRef({ span: { lo: first, hi: total - 1, yMin, yMax } as Span, range: current, total });

  useEffect(() => {
    const before = settled.current;
    const to: Span = { lo: first, hi: total - 1, yMin, yMax };
    const from = slideRef.current ?? before.span;
    settled.current = { span: to, range: current, total };

    let raf = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (before.range !== current || total <= before.total || reduceMotion) {
      // Not new days (a range switch morphs instead): settle on the final span.
      if (slideRef.current) {
        raf = requestAnimationFrame(() => {
          slideRef.current = null;
          setSlide(null);
        });
      }
      return () => cancelAnimationFrame(raf);
    }

    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min((now - start) / SLIDE_MS, 1);
      if (t < 1) {
        slideRef.current = blendSpan(from, to, easeOut(t));
        setSlide(slideRef.current);
        raf = requestAnimationFrame(step);
      } else {
        slideRef.current = null;
        setSlide(null);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [first, total, yMin, yMax, current]);

  // Where a day (an index into every day) and a price fall, on the span shown.
  const span = slide ?? { lo: first, hi: total - 1, yMin, yMax };
  const gx = (g: number) =>
    MARGIN.left + (span.hi - span.lo < 1e-9 ? plotW / 2 : ((g - span.lo) / (span.hi - span.lo)) * plotW);
  const sy = (v: number) => MARGIN.top + (1 - (v - span.yMin) / (span.yMax - span.yMin)) * plotH;
  const sx = (i: number) => gx(first + i); // a day by its index into the days shown
  // The price at a (fractional) day, along the line between days.
  const priceAt = (g: number) => {
    const a = Math.min(Math.max(Math.floor(g), 0), total - 1);
    const b = Math.min(a + 1, total - 1);
    return series[a] + (series[b] - series[a]) * (g - a);
  };

  // Mid-morph, the in-between line; otherwise the exact one, from the first day in view
  // (while sliding, the days sliding out too, cut off at the edge) to the last (while
  // sliding, the days still to slide in too). With more days than pixels, only every so
  // many are drawn, always both ends, which looks the same.
  const morph = frame?.range === current ? frame.view : null;
  const from0 = Math.max(Math.floor(span.lo), 0);
  const every = Math.max(1, Math.floor((total - from0) / (plotW * 1.5)));
  const drawn = Array.from({ length: total - from0 }, (_, k) => from0 + k).filter(
    (g) => (g - from0) % every === 0 || g === total - 1,
  );
  const line = morph
    ? linePath(morph.shape.xs, morph.shape.ys)
    : linePath(
        drawn.map(gx),
        drawn.map((g) => sy(series[g])),
      );
  const startX = morph ? morph.start : gx(Math.min(Math.max(history.length, span.lo), total - 1));
  const [left, right] = morph
    ? [morph.shape.xs[0], morph.shape.xs[morph.shape.xs.length - 1]]
    : [gx(from0), gx(total - 1)];
  const area = `${line}L${right.toFixed(1)},${bottom}L${left.toFixed(1)},${bottom}Z`;
  // The plot's edges, past which the line is cut off (a little beyond, for its stroke).
  const plotLeft = MARGIN.left - 2;
  const plotRight = MARGIN.left + plotW + 2;
  // The line is drawn twice, each kept to its side of where the test starts: grey before
  // it, coloured (with the wash under it) from Day 1 on. Ids unique to this chart.
  const [clip] = useState(() => `sandbox-${Math.random().toString(36).slice(2)}`);

  // Day labels along the bottom, as many as fit: on whole steps from Day 1 (so a week, a
  // month, a year apart), and today's at the end when it isn't close to one of them. Each
  // is the day's number into the days shown.
  const fit = Math.max(2, Math.floor(plotW / 80));
  const labelStep = LABEL_STEPS.find((step) => last / step <= fit - 1) ?? LABEL_STEPS[LABEL_STEPS.length - 1];
  const firstDay = dayOf(0);
  const xLabels: number[] = [];
  for (let d = 1 + Math.ceil((firstDay - 1) / labelStep) * labelStep; d <= dayOf(last); d += labelStep) {
    xLabels.push(d - firstDay);
  }
  if (!xLabels.length || last - xLabels[xLabels.length - 1] >= labelStep * 0.6) xLabels.push(last);
  // A label near an edge of the chart is set inside it rather than centred on its day.
  const labelAnchor = (x: number) =>
    x - MARGIN.left < 28 ? "start" : MARGIN.left + plotW - x < 28 ? "end" : "middle";

  // The day nearest the pointer, as an index into `slice`.
  function point(clientX: number) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left - MARGIN.left;
    const i = last === 0 ? 0 : Math.round((x / plotW) * last);
    setHover({ at: Math.min(Math.max(i, 0), last), on: true });
  }
  const at = hover && hover.at <= last ? hover.at : null;
  const visible = Boolean(hover?.on) && at !== null && !morph && !slide && !showDay;
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
        ranges={["1D", ...offered.map((r) => r.key), "All"] as Tab[]}
        range={showDay ? "1D" : current}
        onPick={(r) => {
          setHover(null);
          if (r === "1D") {
            setShowDay(true);
            if (example === undefined) {
              setExample("loading");
              getSandboxExampleDay(symbol).then(setExample, () => setExample(null));
            }
            return;
          }
          setShowDay(false);
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
        onPointerMove={(e) => !showDay && point(e.clientX)}
        onPointerDown={(e) => !showDay && point(e.clientX)}
        onPointerLeave={() => setHover((h) => h && { ...h, on: false })}
      >
        {showDay ? (
          <ExampleDay day={example} width={width} />
        ) : (
          <>
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`Closing price from ${dayName(dayOf(0))} to ${dayName(dayOf(last))}: ${money.format(slice[0])} to ${money.format(slice[last])}`}
              className="block"
            >
              <defs>
                <clipPath id={`${clip}-past`}>
                  <rect
                    x={plotLeft}
                    y={0}
                    width={Math.max(Math.min(startX, plotRight) - plotLeft, 0)}
                    height={HEIGHT}
                  />
                </clipPath>
                <clipPath id={`${clip}-test`}>
                  <rect x={startX} y={0} width={Math.max(plotRight - startX, 0)} height={HEIGHT} />
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
                    textAnchor={labelAnchor(sx(i))}
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
              {/* The player's trades, where they were made (those in view). */}
              {!morph &&
                trades.map((t, i) => {
                  const g = history.length + t.day - 1;
                  if (g < span.lo - 0.5) return null;
                  const cx = gx(g);
                  const cy = sy(t.price);
                  const buy = t.side === "Bought";
                  return (
                    <path
                      key={i}
                      className="trade-mark"
                      d={buy ? `M${cx} ${cy + 6}l5 8h-10Z` : `M${cx} ${cy - 6}l5 -8h-10Z`}
                      fill={buy ? UP : DOWN}
                      stroke="#fff"
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                    >
                      <title>{`Day ${t.day}: ${buy ? "bought" : "sold"} at ${money.format(t.price)}`}</title>
                    </path>
                  );
                })}

              {/* Today, at the end of the line (while sliding, riding along it to the new today). */}
              {!morph && (
                <circle
                  cx={gx(span.hi)}
                  cy={sy(priceAt(span.hi))}
                  r={4}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}

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
          </>
        )}
      </div>
    </div>
  );
}

// The session an example day spans, in minutes (9:30 to 16:00, as on the TSX and the US
// exchanges), and how the time of day of a point that many minutes in reads.
const SESSION = 390;
const clock = (minute: number) => {
  const m = 9 * 60 + 30 + Math.round(minute);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
// A change, as a signed percentage ("+0.42%", "−1.30%").
const changeText = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(2)}%`;

// The Sandbox chart's 1D range: an example of a day of the pick's trading, since the test's
// own days have only their closing prices. It is one of the recent days the pick has prices
// for every 5 minutes, chosen at random, its date hidden. Above it, the day's opening and
// closing prices and the change between; drawn like the main line (green when the day ended
// up, red when down, over a light wash), with the open marked, times of day along the
// bottom, and the price and time of the point nearest the pointer in the same white tooltip.
function ExampleDay({ day, width }: { day: Example; width: number }) {
  const [at, setAt] = useState<{ i: number; on: boolean } | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const ready = Array.isArray(day) ? day : null;
  const opened = ready?.[0].price;
  const closed = ready?.[ready.length - 1].price;
  const caption = (
    <div className="chart-fade mb-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <p className="text-sm font-semibold text-slate-900">Example: 1-day fluctuation of ??? on ???</p>
        <p className="text-xs text-slate-500">
          A real trading day from its recent history, its date hidden, every 5 minutes. It isn&apos;t one of
          your test&apos;s days.
        </p>
      </div>
      {opened !== undefined && closed !== undefined && (
        <p className="text-sm tabular-nums text-slate-600">
          Opened <span className="font-semibold text-slate-900">{money.format(opened)}</span>
          <span className="text-slate-400"> → </span>
          closed <span className="font-semibold text-slate-900">{money.format(closed)}</span>{" "}
          <span className={`font-semibold ${closed >= opened ? "text-green-700" : "text-red-600"}`}>
            {changeText(closed / opened - 1)}
          </span>
        </p>
      )}
    </div>
  );

  if (day === undefined || day === "loading" || day === null) {
    return (
      <div>
        {caption}
        <div className="grid place-items-center text-sm text-slate-500" style={{ height: HEIGHT }}>
          {day === null ? (
            "There's no example day on record for ???."
          ) : (
            <span className="flex items-center gap-2">
              <DiamondLoader className="size-4" />
              Finding an example day…
            </span>
          )}
        </div>
      </div>
    );
  }

  const points = day;
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const bottom = MARGIN.top + plotH;
  const span = Math.max(SESSION, day[day.length - 1].minute);
  const prices = day.map((p) => p.price);
  const open = day[0].price;
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.002 || 0.01;
  const yTicks = ticks(lo - pad, hi + pad);
  const yMin = Math.min(lo - pad, yTicks[0]);
  const yMax = Math.max(hi + pad, yTicks[yTicks.length - 1]);
  const x = (minute: number) => MARGIN.left + (minute / span) * plotW;
  const y = (price: number) => MARGIN.top + (1 - (price - yMin) / (yMax - yMin)) * plotH;
  const line = linePath(
    day.map((p) => x(p.minute)),
    day.map((p) => y(p.price)),
  );
  const end = day[day.length - 1];
  const area = `${line}L${x(end.minute).toFixed(1)},${bottom}L${x(0).toFixed(1)},${bottom}Z`;
  const color = end.price >= open ? UP : DOWN;
  // The point pointed at, kept while the crosshair and tooltip fade out after the pointer leaves.
  const point = at !== null ? day[at.i] : null;
  const shown = Boolean(at?.on);
  const tip = point ? `${money.format(point.price)} ${clock(point.minute)}` : "";
  const tipWidth = tip.length * 7.6 + TIP_PAD;
  const tipLeft = point ? Math.min(Math.max(x(point.minute), tipWidth / 2), width - tipWidth / 2) : 0;

  // The point nearest the pointer.
  function near(clientX: number) {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect) return;
    const minute = ((clientX - rect.left - MARGIN.left) / plotW) * span;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.minute - minute) < Math.abs(points[best].minute - minute)) best = i;
    });
    setAt({ i: best, on: true });
  }

  return (
    <div>
      {caption}
      <div
        ref={plot}
        className="relative"
        onPointerMove={(e) => near(e.clientX)}
        onPointerDown={(e) => near(e.clientX)}
        onPointerLeave={() => setAt((a) => a && { ...a, on: false })}
      >
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`An example day: opened at ${money.format(open)}, closed at ${money.format(end.price)}`}
          className="block"
        >
          <g className="chart-fade">
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(v)} y2={y(v)} stroke={GRID} />
                <text x={MARGIN.left + plotW + 8} y={y(v)} dy="0.32em" fontSize={12} fill={INK}>
                  {money.format(v)}
                </text>
              </g>
            ))}
            {[0, 90, 180, 270, SESSION].map((m) => (
              <text
                key={m}
                x={x(m)}
                y={bottom + 18}
                fontSize={12}
                fill={INK}
                textAnchor={m === 0 ? "start" : m === SESSION ? "end" : "middle"}
              >
                {clock(m)}
              </text>
            ))}
          </g>
          {/* The day's opening price. */}
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + plotW}
            y1={y(open)}
            y2={y(open)}
            stroke="#94a3b8"
            strokeDasharray="3 3"
          />
          <text x={MARGIN.left + 4} y={y(open) - 5} fontSize={11} fill={INK}>
            Open
          </text>
          <path d={area} fillOpacity={0.1} className="chart-area-in" style={{ fill: color }} />
          <path
            d={line}
            pathLength={1}
            className="chart-draw"
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* The crosshair and dot, as on the main line: they fade in, glide from point to
              point as the pointer moves, and fade out. */}
          {point && (
            <g pointerEvents="none" className="chart-hover" style={{ opacity: shown ? 1 : 0 }}>
              <line
                x1={0}
                x2={0}
                y1={MARGIN.top}
                y2={bottom}
                stroke="#94a3b8"
                className="chart-follow"
                style={{ transform: `translateX(${x(point.minute)}px)` }}
              />
              <circle
                r={5}
                fill={color}
                stroke="#fff"
                strokeWidth={2}
                className="chart-follow"
                style={{ transform: `translate(${x(point.minute)}px, ${y(point.price)}px)` }}
              />
            </g>
          )}
        </svg>
        {point && (
          // The price and time, gliding along above the crosshair.
          <div
            aria-hidden={!shown}
            className="chart-tip pointer-events-none absolute top-0 whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-sm shadow"
            style={{ left: tipLeft, opacity: shown ? 1 : 0, transform: "translateX(-50%)" }}
          >
            <span className="font-semibold tabular-nums text-slate-900">{money.format(point.price)}</span>{" "}
            <span className="text-slate-500">{clock(point.minute)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
