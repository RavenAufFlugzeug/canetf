"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PriceHistory, PricePoint } from "@/lib/db";
import { moneyFormatter } from "@/lib/money";

// The standard ranges finance sites offer, up to all the daily history there is
// (HISTORY_PERIOD in search/StockUtils.py keeps everything Yahoo has).
const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "All"] as const;
type Range = (typeof RANGES)[number];

const CAPTIONS: Record<Exclude<Range, "1D">, string> = {
  "5D": "Past 5 days",
  "1M": "Past month",
  "6M": "Past 6 months",
  YTD: "Year to date",
  "1Y": "Past year",
  "5Y": "Past 5 years",
  All: "All time",
};

const HEIGHT = 280;
const MARGIN = { top: 40, right: 64, bottom: 28, left: 8 };
// Regular session length (NYSE, Nasdaq, TSX), so a 1D chart mid-day ends partway across.
const SESSION_MS = 6.5 * 60 * 60 * 1000;
const UP = "#15803d"; // green-700, matches the Companies table
const DOWN = "#dc2626"; // red-600
const MORPH_MS = 900; // matches .chart-fade in globals.css
const BASELINE_HIT_PX = 6; // how close the pointer must be to the previous-close line
const TIP_PAD = 26; // the tooltip's horizontal padding (px-3) and border, around its text
// Enough for about one per pixel across the widest chart. (All can hold decades of daily
// closes; the line drawn needs no more points than the chart has pixels.)
const SAMPLES = 1300;

type Point = PricePoint & { x: number }; // x: time (1D) or index (other ranges)

type Series = {
  points: Point[];
  intraday: boolean;
  baseline: number; // the change is measured from here
  showBaseline: boolean; // draw the previous-close line (1D only)
  baselineWhen: string | null; // when that close was, e.g. "Tue, Oct 6, 4:00 PM"
  domain: [number, number];
  caption: string;
};

// ---------------------------------------------------------------------------
// Dates. Daily points are "YYYY-MM-DD"; intraday points are exchange-local ISO
// strings, so wall-clock times are read straight from the text, never converted.
// ---------------------------------------------------------------------------
const dayOf = (t: string) => t.slice(0, 10);
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);

const fmtDay = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtDayYear = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const fmtWeekday = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fmtMonth = new Intl.DateTimeFormat("en-CA", { month: "short", timeZone: "UTC" });

function clock(t: string, withMinutes = true) {
  const h = Number(t.slice(11, 13));
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return withMinutes ? `${h12}:${t.slice(14, 16)} ${suffix}` : `${h12} ${suffix}`;
}

// Bars are 5 minutes long (INTRADAY_INTERVAL in search/StockUtils.py), so the
// session's last bar ends 5 minutes after it starts: 3:55 PM -> 4:00 PM.
function barEnd(t: string) {
  const minutes = Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)) + 5;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.slice(0, 11)}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function shiftDay(day: string, months: number) {
  const d = utcDate(day);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Building the series for a range
// ---------------------------------------------------------------------------
function closeBefore(daily: PricePoint[], day: string) {
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].t < day) return daily[i];
  }
  return null;
}

// "Tue, Oct 6, 4:00 PM": the day of a daily close, plus the time the session
// ended when that day's intraday bars are on hand.
function closeLabel(day: string, intraday: PricePoint[]) {
  const date = fmtWeekday.format(utcDate(day));
  const lastBar = intraday.findLast((p) => dayOf(p.t) === day);
  return lastBar ? `${date}, ${clock(barEnd(lastBar.t))}` : date;
}

// The daily close once the day is over (it includes the closing auction the last
// 5-minute bar misses), otherwise the latest intraday bar.
function latestPrice({ daily, intraday }: PriceHistory) {
  const lastDaily = daily[daily.length - 1];
  const lastBar = intraday[intraday.length - 1];
  if (!lastBar) return lastDaily.close;
  if (!lastDaily) return lastBar.close;
  return lastDaily.t >= dayOf(lastBar.t) ? lastDaily.close : lastBar.close;
}

const indexed = (points: PricePoint[]): Point[] => points.map((p, i) => ({ ...p, x: i }));

function buildSeries(range: Range, { daily, intraday }: PriceHistory): Series | null {
  if (range === "1D") {
    if (!intraday.length) return null;
    const day = dayOf(intraday[intraday.length - 1].t);
    const points = intraday
      .filter((p) => dayOf(p.t) === day)
      .map((p) => ({ ...p, x: Date.parse(p.t) }));
    const first = points[0].x;
    const prev = closeBefore(daily, day);
    return {
      points,
      intraday: true,
      baseline: prev?.close ?? points[0].close,
      showBaseline: prev !== null,
      baselineWhen: prev && closeLabel(prev.t, intraday),
      domain: [first, Math.max(points[points.length - 1].x, first + SESSION_MS - 5 * 60 * 1000)],
      caption: fmtWeekday.format(utcDate(day)),
    };
  }

  let source: PricePoint[];
  let isIntraday = false;
  if (range === "5D" && intraday.length) {
    source = intraday;
    isIntraday = true;
  } else if (range === "5D") {
    source = daily.slice(-5);
  } else if (range === "All") {
    source = daily;
  } else {
    if (!daily.length) return null;
    const last = daily[daily.length - 1].t;
    const start =
      range === "YTD"
        ? `${last.slice(0, 4)}-01-01`
        : shiftDay(last, { "1M": -1, "6M": -6, "1Y": -12, "5Y": -60 }[range]);
    source = daily.filter((p) => (range === "YTD" ? p.t >= start : p.t > start));
  }
  if (!source.length) return null;

  const points = indexed(source);
  return {
    points,
    intraday: isIntraday,
    baseline: closeBefore(daily, dayOf(points[0].t))?.close ?? points[0].close,
    showBaseline: false,
    baselineWhen: null,
    domain: [0, Math.max(points.length - 1, 1)],
    caption: CAPTIONS[range],
  };
}

// ---------------------------------------------------------------------------
// Axes
// ---------------------------------------------------------------------------
function niceStep(span: number, count: number) {
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
}

function yTicks(lo: number, hi: number) {
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.01 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, 4);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v);
  return { min, max, ticks, decimals: step < 1 ? 2 : 0 };
}

function thin<T>(items: T[], max: number) {
  if (items.length <= max) return items;
  const step = Math.ceil(items.length / max);
  return items.filter((_, i) => i % step === 0);
}

function xTicks(range: Range, series: Series, maxTicks: number) {
  const { points } = series;
  const at = (p: Point, label: string) => ({ x: p.x, label });

  if (range === "1D") {
    const hours = points.filter((p) => p.t.slice(14, 16) === "00");
    return thin(hours, maxTicks).map((p) => at(p, clock(p.t, false)));
  }

  if (range === "5D" && series.intraday) {
    // One label per trading day, centred under that day's stretch of the line.
    const days = new Map<string, Point[]>();
    for (const p of points) days.set(dayOf(p.t), [...(days.get(dayOf(p.t)) ?? []), p]);
    return [...days].map(([day, ps]) => ({
      x: (ps[0].x + ps[ps.length - 1].x) / 2,
      label: fmtDay.format(utcDate(day)),
    }));
  }

  // 5Y and All: the first trading day of each year.
  if (range === "5Y" || range === "All") {
    const years = points.filter((p, i) => i > 0 && p.t.slice(0, 4) !== points[i - 1].t.slice(0, 4));
    if (years.length >= 2) return thin(years, maxTicks).map((p) => at(p, p.t.slice(0, 4)));
  }

  // First trading day of each month.
  const month = (t: string) => t.slice(0, 7);
  const starts = points.filter((p, i) => i > 0 && month(p.t) !== month(points[i - 1].t));
  if (range !== "1M" && range !== "5D" && starts.length >= 2) {
    return thin(starts, maxTicks).map((p) => at(p, fmtMonth.format(utcDate(dayOf(p.t)))));
  }

  // 1M, or too few boundaries: evenly spaced dates.
  const count = Math.min(maxTicks, 5, points.length);
  return Array.from({ length: count }, (_, i) => {
    const p = points[Math.round(((i + 0.5) * (points.length - 1)) / count)];
    return at(p, fmtDay.format(utcDate(dayOf(p.t))));
  });
}

function layout(series: Series, width: number) {
  const closes = series.points.map((p) => p.close);
  const extra = series.showBaseline ? [series.baseline] : [];
  const y = yTicks(Math.min(...closes, ...extra), Math.max(...closes, ...extra));
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const [d0, d1] = series.domain;
  const sx = (x: number) => MARGIN.left + ((x - d0) / (d1 - d0 || 1)) * plotW;
  const sy = (v: number) => MARGIN.top + (1 - (v - y.min) / (y.max - y.min)) * plotH;
  return { y, plotW, sx, sy };
}

// ---------------------------------------------------------------------------
// Morphing between ranges. Every range's line is resampled to the same number
// of evenly spaced pixel positions, so any two can be blended point by point.
// ---------------------------------------------------------------------------
type Shape = { xs: number[]; ys: number[] };

function resample(px: number[], py: number[]): Shape {
  const xs: number[] = [];
  const ys: number[] = [];
  let seg = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const x = px[0] + ((px[px.length - 1] - px[0]) * i) / (SAMPLES - 1);
    while (seg < px.length - 2 && px[seg + 1] < x) seg++;
    const span = px[seg + 1] - px[seg];
    const f = px.length < 2 || span <= 0 ? 0 : Math.min(Math.max((x - px[seg]) / span, 0), 1);
    xs.push(x);
    ys.push(px.length < 2 ? py[0] : py[seg] + (py[seg + 1] - py[seg]) * f);
  }
  return { xs, ys };
}

function blend(a: Shape, b: Shape, t: number): Shape {
  return {
    xs: a.xs.map((x, i) => x + (b.xs[i] - x) * t),
    ys: a.ys.map((y, i) => y + (b.ys[i] - y) * t),
  };
}

// What morphs together on a range switch: the line and the change figures.
type View = { shape: Shape; change: number; pct: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const blendView = (a: View, b: View, t: number): View => ({
  shape: blend(a.shape, b.shape, t),
  change: lerp(a.change, b.change, t),
  pct: lerp(a.pct, b.pct, t),
});

function linePath(xs: number[], ys: number[]) {
  return xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("");
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

function watchWidth(onWidth: (width: number) => void) {
  return (el: HTMLElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(() => onWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  };
}

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------
// The range options. A dark pill sits behind the chosen one and slides to the next when
// another is picked, whose label gives a small pop; the others darken and rise a touch
// when pointed at, and every option dips when pressed.
function RangeTabs({ range, onPick }: { range: Range; onPick: (r: Range) => void }) {
  const group = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const place = () => {
      const chosen = group.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      const el = pill.current;
      if (!chosen || !el) return;
      // The first time, it is simply put in place rather than sliding in from the corner.
      if (!placed.current) {
        el.style.transition = "none";
        requestAnimationFrame(() => (el.style.transition = ""));
        placed.current = true;
      }
      el.style.transform = `translate(${chosen.offsetLeft}px, ${chosen.offsetTop}px)`;
      el.style.width = `${chosen.offsetWidth}px`;
      el.style.height = `${chosen.offsetHeight}px`;
      el.style.opacity = "1";
    };
    place();
    // The options can wrap onto another line when the page narrows.
    const watch = new ResizeObserver(place);
    if (group.current) watch.observe(group.current);
    return () => watch.disconnect();
  }, [range]);

  return (
    <div ref={group} role="group" aria-label="Chart range" className="relative flex flex-wrap gap-1">
      <span
        ref={pill}
        aria-hidden
        className="range-pill pointer-events-none absolute left-0 top-0 rounded-md bg-slate-900 opacity-0 shadow-md shadow-slate-900/25"
      />
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={r === range}
          onClick={() => onPick(r)}
          className={`relative rounded-md px-3 py-1.5 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:scale-90 ${
            r === range
              ? "text-white"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 motion-safe:hover:-translate-y-0.5"
          }`}
        >
          <span className={r === range ? "range-pop inline-block" : "inline-block"}>{r}</span>
        </button>
      ))}
    </div>
  );
}

export default function PriceChart({
  history,
  currency,
}: {
  history: PriceHistory;
  currency: string | null;
}) {
  const [range, setRange] = useState<Range>("1D");
  const [active, setActive] = useState<number | null>(null);
  // Pointer x while it rests on the previous-close line, which then shows its own tooltip.
  const [onBaseline, setOnBaseline] = useState<number | null>(null);
  // One tooltip serves both the price line and the previous-close line, travelling
  // between them. These remember where it last was, so it fades out in place, and
  // count hover visits: each visit remounts it so it fades in where the pointer is
  // rather than gliding over from where the last visit ended.
  const [lastActive, setLastActive] = useState(0);
  const [lastBaselineX, setLastBaselineX] = useState(0);
  const [lastMode, setLastMode] = useState<"price" | "baseline">("price");
  const [visits, setVisits] = useState(0);
  // Natural widths of the tooltip's two texts, so its box can resize smoothly between them.
  const [tipWidths, setTipWidths] = useState({ price: 0, baseline: 0 });
  const priceTipRef = useMemo(
    () => watchWidth((w) => setTipWidths((t) => (t.price === w ? t : { ...t, price: w }))),
    [],
  );
  const baselineTipRef = useMemo(
    () => watchWidth((w) => setTipWidths((t) => (t.baseline === w ? t : { ...t, baseline: w }))),
    [],
  );
  const [width, setWidth] = useState(640);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const money = useMemo(() => moneyFormatter(currency), [currency]);
  const series = useMemo(() => buildSeries(range, history), [range, history]);

  // The line's shape in pixels, resampled so it can morph into the next range's.
  const shape = useMemo(() => {
    if (!series) return null;
    const { sx, sy } = layout(series, width);
    return resample(
      series.points.map((p) => sx(p.x)),
      series.points.map((p) => sy(p.close)),
    );
  }, [series, width]);

  // Where this range ends up: its line, and the change since its baseline.
  const view = useMemo((): View | null => {
    if (!series || !shape) return null;
    const change = latestPrice(history) - series.baseline;
    return { shape, change, pct: (change / series.baseline) * 100 };
  }, [series, shape, history]);

  // While a morph runs, `frame` holds the in-between view for `range`.
  const [frame, setFrame] = useState<{ range: Range; view: View } | null>(null);
  const shown = useRef<{ range: Range; view: View | null }>({ range, view });
  const frameRef = useRef<View | null>(null);

  useEffect(() => {
    const from = frameRef.current ?? shown.current.view;
    const rangeChanged = shown.current.range !== range;
    shown.current = { range, view };

    let raf = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || !view || !rangeChanged || reduceMotion) {
      // Nothing to animate (first render, resize, missing data): settle on the final shape.
      if (frameRef.current) {
        raf = requestAnimationFrame(() => {
          frameRef.current = null;
          setFrame(null);
        });
      }
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / MORPH_MS, 1);
      if (t < 1) {
        frameRef.current = blendView(from, view, easeOut(t));
        setFrame({ range, view: frameRef.current });
        raf = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setFrame(null);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [range, view]);

  const rangeButtons = (
    <RangeTabs
      range={range}
      onPick={(r) => {
        // Keep showing the current line and figures until the morph starts,
        // so the new range's final values never flash for a frame first.
        const current = frameRef.current ?? view;
        if (current && r !== range) {
          frameRef.current = current;
          setFrame({ range: r, view: current });
        }
        setRange(r);
        setActive(null);
        setOnBaseline(null);
      }}
    />
  );

  if (!series) {
    return (
      <div className="mt-6">
        {rangeButtons}
        <p className="mt-4 text-slate-600">
          {range === "1D" || range === "5D"
            ? "No intraday prices yet. Run update_database in search/ to download them."
            : "No price history yet. Run update_database in search/ to download it."}
        </p>
      </div>
    );
  }

  const { points, baseline } = series;
  const last = points[points.length - 1];
  const { y, plotW, sx, sy } = layout(series, width);

  // Mid-morph, draw the in-between shape and figures; otherwise the exact ones.
  const morph = frame?.range === range ? frame.view : null;
  const morphing = morph?.shape ?? null;
  const { change, pct } = morph ?? view ?? { change: 0, pct: 0 };
  // Follows the counting figure, so the line turns red the moment the text does.
  const color = change < 0 ? DOWN : UP;
  const line = morphing
    ? linePath(morphing.xs, morphing.ys)
    : linePath(points.map((p) => sx(p.x)), points.map((p) => sy(p.close)));
  const bottom = HEIGHT - MARGIN.bottom;
  const [left, right] = morphing
    ? [morphing.xs[0], morphing.xs[SAMPLES - 1]]
    : [sx(points[0].x), sx(last.x)];
  const area = `${line}L${right.toFixed(1)},${bottom}L${left.toFixed(1)},${bottom}Z`;
  const ticks = xTicks(range, series, Math.max(2, Math.floor(plotW / 80)));

  const signed = (n: number, text: string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${text}`;
  const pointLabel = (p: Point) =>
    series.intraday
      ? `${fmtDay.format(utcDate(dayOf(p.t)))}, ${clock(p.t)}`
      : fmtDayYear.format(utcDate(p.t));

  const shownPoint = points[Math.min(active ?? lastActive, points.length - 1)];
  const onLine = onBaseline !== null && series.showBaseline;
  const mode = active !== null ? "price" : onLine ? "baseline" : lastMode;
  const hoverVisible = (active !== null || onLine) && !morphing;
  const baselineVisible = hoverVisible && mode === "baseline";

  // Where the dot sits: on the price line, or on the previous-close line under the pointer.
  const dot =
    mode === "price" || !series.showBaseline
      ? { x: sx(shownPoint.x), y: sy(shownPoint.close) }
      : { x: Math.min(Math.max(lastBaselineX, MARGIN.left), MARGIN.left + plotW), y: sy(baseline) };

  // The tooltip: at the top over a price, or just above the previous-close line
  // (below it when the line is near the top), kept inside the chart.
  const tipWidth = (mode === "price" ? tipWidths.price : tipWidths.baseline) + TIP_PAD;
  const tipLeft = Math.min(Math.max(dot.x, tipWidth / 2), width - tipWidth / 2);
  const tipTop = mode === "price" ? 0 : sy(baseline) > 60 ? sy(baseline) - 44 : sy(baseline) + 10;
  // The text not being shown leaves the layout and fades out quickly, so the box fits
  // the other; the new text fades in just after, so the two never overlap legibly.
  const tipText = (on: boolean): React.CSSProperties =>
    on
      ? { opacity: 1, transition: "opacity 140ms ease-out 80ms" }
      : { opacity: 0, position: "absolute", left: 12, top: 6, transition: "opacity 80ms ease-in" };

  function startVisit() {
    if (active === null && onBaseline === null) setVisits((n) => n + 1);
  }

  function hoverPoint(i: number) {
    startVisit();
    setActive(i);
    setLastActive(i);
    setLastMode("price");
    setOnBaseline(null);
  }

  function hoverBaseline(px: number) {
    startVisit();
    setOnBaseline(px);
    setLastBaselineX(px);
    setLastMode("baseline");
    setActive(null);
  }

  function clearHover() {
    setActive(null);
    setOnBaseline(null);
  }

  // Nearest point to a pixel position; points are sorted by x.
  function nearest(px: number) {
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (sx(points[mid].x) < px) lo = mid;
      else hi = mid;
    }
    return Math.abs(sx(points[lo].x) - px) <= Math.abs(sx(points[hi].x) - px) ? lo : hi;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const moves: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => Math.max(i - 1, 0),
      ArrowRight: (i) => Math.min(i + 1, points.length - 1),
      Home: () => 0,
      End: () => points.length - 1,
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      hoverPoint(move(active ?? points.length - 1));
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold text-slate-900">{money.format(latestPrice(history))}</p>
          <p className="mt-1 text-sm">
            {/* Mid-switch the figures count from the old range's values to the new ones. */}
            <span
              className={`font-semibold tabular-nums transition-colors duration-300 ${
                change < 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              {signed(change, money.format(Math.abs(change)))} (
              {signed(pct, `${Math.abs(pct).toFixed(2)}%`)})
            </span>{" "}
            <span key={range} className="chart-fade inline-block text-slate-500">
              {series.caption}
            </span>
          </p>
        </div>
        {rangeButtons}
      </div>

      <div ref={box} className="relative mt-4">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          tabIndex={0}
          aria-label={`${range} price chart: from ${money.format(points[0].close)} to ${money.format(last.close)}. Use the arrow keys to read prices.`}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;
            // Within a few pixels of the dotted line, describe the line instead of a price.
            if (series.showBaseline && !morphing && Math.abs(py - sy(baseline)) <= BASELINE_HIT_PX) {
              hoverBaseline(px);
            } else {
              hoverPoint(nearest(px));
            }
          }}
          onPointerLeave={clearHover}
          onBlur={clearHover}
          onKeyDown={onKeyDown}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <g key={range} className="chart-fade">
            {y.ticks.map((v) => (
              <g key={v}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(v)} y2={sy(v)} stroke="#e2e8f0" />
                <text x={MARGIN.left + plotW + 8} y={sy(v)} dy="0.32em" fontSize={12} fill="#64748b">
                  {v.toLocaleString("en-CA", {
                    minimumFractionDigits: y.decimals,
                    maximumFractionDigits: y.decimals,
                  })}
                </text>
              </g>
            ))}

            {ticks.map((t) => (
              <text
                key={`${t.x}-${t.label}`}
                x={sx(t.x)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={12}
                fill="#64748b"
              >
                {t.label}
              </text>
            ))}

            {/* Previous close; hovering it shows its value and date. */}
            {series.showBaseline && (
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotW}
                y1={sy(baseline)}
                y2={sy(baseline)}
                strokeDasharray="2 3"
                className="chart-baseline"
                style={{
                  stroke: baselineVisible ? "#475569" : "#94a3b8",
                  strokeWidth: baselineVisible ? 1.5 : 1,
                }}
              />
            )}
          </g>

          {/* On first appearance the line draws itself and the shading fades in under it.
              pathLength={1} lets the draw animation use 0..1 whatever the line's real length. */}
          <path
            d={area}
            fillOpacity={0.1}
            className="chart-area-in"
            style={{ fill: color, transition: "fill 300ms" }}
          />
          <path
            d={line}
            pathLength={1}
            className="chart-draw"
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ stroke: color, transition: "stroke 300ms" }}
          />

          {/* Crosshair and dot: fade in, glide along the line, slide onto the
              previous-close line (where the crosshair fades away), fade out. */}
          {visits > 0 && (
            <g
              key={`hover-${visits}`}
              pointerEvents="none"
              className="chart-hover"
              style={{ opacity: hoverVisible ? 1 : 0 }}
            >
              <line
                x1={0}
                x2={0}
                y1={MARGIN.top}
                y2={bottom}
                stroke="#94a3b8"
                className="chart-follow"
                style={{ transform: `translateX(${dot.x}px)`, opacity: mode === "price" ? 1 : 0 }}
              />
              <circle
                r={5}
                stroke="#fff"
                strokeWidth={2}
                className="chart-follow"
                style={{
                  transform: `translate(${dot.x}px, ${dot.y}px)`,
                  fill: mode === "price" ? color : "#475569",
                }}
              />
            </g>
          )}
        </svg>

        {visits > 0 && (
          <div
            key={`tip-${visits}`}
            aria-live="polite"
            aria-hidden={!hoverVisible}
            className="chart-tip pointer-events-none absolute overflow-hidden whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-sm shadow"
            style={{
              left: tipLeft,
              top: tipTop,
              width: tipWidth > TIP_PAD ? tipWidth : undefined,
              opacity: hoverVisible ? 1 : 0,
              transform: "translateX(-50%)",
            }}
          >
            <span ref={priceTipRef} className="chart-tip-text inline-block" style={tipText(mode === "price")}>
              <span className="font-semibold text-slate-900">{money.format(shownPoint.close)}</span>{" "}
              <span className="text-slate-500">{pointLabel(shownPoint)}</span>
            </span>
            {series.showBaseline && (
              <span
                ref={baselineTipRef}
                className="chart-tip-text inline-block"
                style={tipText(mode === "baseline")}
              >
                <span className="font-semibold text-slate-900">Previous close {money.format(baseline)}</span>
                {series.baselineWhen && <span className="text-slate-500"> · {series.baselineWhen}</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Always shown, even for daily ranges, so switching ranges never shifts the layout. */}
      <p className="mt-2 text-xs text-slate-500">Times are in the exchange&apos;s local time.</p>
    </div>
  );
}
