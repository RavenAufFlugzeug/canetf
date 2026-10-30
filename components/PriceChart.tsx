"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PriceHistory, PricePoint } from "@/lib/db";
import RangeTabs from "@/components/RangeTabs";
import { blend, easeOut, linePath, MORPH_MS, resample, SAMPLES, type Shape } from "@/lib/chartMorph";
import { listingOf, type Listing } from "@/lib/exchanges";
import { moneyFormatter, rateDecimals } from "@/lib/money";

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
const BASELINE_HIT_PX = 6; // how close the pointer must be to the previous-close line
const TIP_PAD = 26; // the tooltip's horizontal padding (px-3) and border, around its text

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
  // Enough decimals to tell the ticks apart: two for steps of a cent and up, more for an
  // exchange rate's tiny ones.
  return { min, max, ticks, decimals: step < 1 ? Math.max(2, Math.ceil(-Math.log10(step) - 1e-9)) : 0 };
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


// What morphs together on a range switch: the line and the change figures.
type View = { shape: Shape; change: number; pct: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const blendView = (a: View, b: View, t: number): View => ({
  shape: blend(a.shape, b.shape, t),
  change: lerp(a.change, b.change, t),
  pct: lerp(a.pct, b.pct, t),
});



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

// The current minute, as a number that changes once a minute; null on the server, so the
// clock below is only drawn in the browser (the two would disagree about the time).
function subscribeToClock(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}
const currentMinute = () => Math.floor(Date.now() / 60_000);

// How far `timeZone` is ahead of UTC at `date`, in minutes.
function utcOffset(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(date);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
  return Math.round((wall - date.getTime()) / 60_000);
}

// "3 hours ahead of you", "5½ hours behind you", "Same time as you".
function timeGap(minutes: number) {
  if (minutes === 0) return "Same time as you";
  const hours = Math.abs(minutes) / 60;
  const whole = Math.floor(hours);
  const text = hours === whole ? String(whole) : hours - whole === 0.5 ? `${whole || ""}½` : hours.toFixed(2);
  return `${text} ${hours === 1 ? "hour" : "hours"} ${minutes > 0 ? "ahead of" : "behind"} you`;
}

// One item of the strip under the chart: an icon and a value that lift into a white chip
// when pointed at (or tabbed to), with a card of details rising above it.
function ListingChip({
  label,
  icon,
  children,
  details,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  details: React.ReactNode;
}) {
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className="group relative flex items-center gap-1.5 rounded-md px-2 py-1 outline-none transition duration-200 ease-out hover:bg-white hover:shadow-sm hover:shadow-slate-300/60 focus-visible:bg-white focus-visible:shadow-sm focus-visible:ring-2 focus-visible:ring-slate-300 motion-safe:hover:-translate-y-px"
    >
      {icon}
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-max max-w-64 translate-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 opacity-0 shadow-lg shadow-slate-300/50 transition duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
      >
        {details}
      </span>
    </span>
  );
}

// Where it trades, as a strip under the chart: the exchange, its country and the time
// there now, each a chip with a small icon that responds when pointed at (the building
// darkens, the pin hops, the clock's hand sweeps round) and a card of details. Under the
// strip, a note that the chart's times are local too.
function ListingStrip({ listing, code, currency }: { listing: Listing; code: string; currency: string | null }) {
  const minute = useSyncExternalStore(subscribeToClock, currentMinute, () => null);
  const icon = "size-3.5 shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-slate-700 group-focus-visible:text-slate-700";
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const divider = <span aria-hidden className="hidden h-3.5 w-px bg-slate-200 sm:block" />;
  const city = listing.timeZone.split("/").pop()!.replace(/_/g, " ");

  // The time there, split so the figures can be darker than the day and zone.
  let there: { time: string; rest: string } | null = null;
  let gap = "";
  let yours = "";
  if (minute !== null) {
    const now = new Date(minute * 60_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: listing.timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    there = {
      time: `${part("hour")}:${part("minute")} ${part("dayPeriod")}`,
      rest: `${part("weekday")} · ${part("timeZoneName")}`,
    };
    gap = timeGap(utcOffset(listing.timeZone, now) + now.getTimezoneOffset());
    yours = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(now);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-xs text-slate-500">
        <ListingChip
          label={`Exchange: ${listing.exchange}`}
          icon={
            // A columned building: the exchange.
            <svg aria-hidden viewBox="0 0 16 16" className={icon} {...stroke}>
              <path d="M2 6.5 8 3l6 3.5M3 13.5h10M4 7v5M7 7v5M9 7v5M12 7v5" />
            </svg>
          }
          details={
            <>
              <span className="block font-semibold text-slate-900">{listing.exchange}</span>
              Exchange code {code}
              {currency && ` · prices in ${currency}`}
            </>
          }
        >
          <span className="font-medium text-slate-900">{listing.exchange}</span>
        </ListingChip>
        {divider}
        <ListingChip
          label={`Country: ${listing.country}`}
          icon={
            // A map pin: the country. It hops when pointed at.
            <svg aria-hidden viewBox="0 0 16 16" className={`${icon} motion-safe:group-hover:animate-[pin-hop_600ms_ease-out]`} {...stroke}>
              <path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14Z" />
              <circle cx="8" cy="6.5" r="1.6" />
            </svg>
          }
          details={
            <>
              <span className="block font-semibold text-slate-900">{listing.place ?? `Listed in ${listing.country}`}</span>
              {listing.about ?? "Where these shares trade. The company itself may be based elsewhere."}
            </>
          }
        >
          <span className="text-slate-700">{listing.country}</span>
        </ListingChip>
        {divider}
        <ListingChip
          label={there ? `Local time at the exchange: ${there.time}, ${there.rest}` : "Local time at the exchange"}
          icon={
            // A clock: the time there now. Its hand sweeps round when pointed at.
            <svg aria-hidden viewBox="0 0 16 16" className={icon} {...stroke}>
              <circle cx="8" cy="8" r="5.5" />
              <path
                d="M8 5v3l2 1.5"
                className="motion-safe:group-hover:animate-[clock-sweep_900ms_ease-in-out]"
                style={{ transformOrigin: "8px 8px" }}
              />
            </svg>
          }
          details={
            there ? (
              <>
                <span className="block font-semibold text-slate-900">
                  {there.time} in {city}
                </span>
                <span className="block">{gap}</span>
                <span className="block text-slate-400">Your time: {yours}</span>
              </>
            ) : (
              `Local time in ${city}`
            )
          }
        >
          {/* Until the browser takes over, an invisible stand-in holds the clock's place. */}
          {there ? (
            <span>
              <span className="font-medium tabular-nums text-slate-900">{there.time}</span> {there.rest}
            </span>
          ) : (
            <span className="invisible tabular-nums">00:00 PM Thu · EDT</span>
          )}
        </ListingChip>
      </div>
      <p className="mt-1.5 px-0.5 text-xs text-slate-500">Chart times are in the exchange&apos;s local time.</p>
    </div>
  );
}

// `exchange` is Yahoo's code for where it trades (companies.exchange), shown under the chart.
// With `rate`, it is an exchange rate's chart, its prices shown with a rate's decimals.
export default function PriceChart({
  history,
  currency,
  exchange = null,
  rate = false,
}: {
  history: PriceHistory;
  currency: string | null;
  exchange?: string | null;
  rate?: boolean;
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

  const money = useMemo(
    () => moneyFormatter(currency, rate ? rateDecimals(latestPrice(history)) : undefined),
    [currency, rate, history],
  );
  const listing = listingOf(exchange);
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
      ranges={RANGES}
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
      {/* The range options always sit on their own line under the figures: beside them,
          they dropped under whenever the change figure grew too long, moving the chart. */}
      <div className="flex flex-col items-start gap-4">
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

            {ticks.map((t) => {
              // Centred under its time, unless that would push it past the chart's edge
              // (a market opening on the hour puts "9 AM" right at the left edge): then it
              // lines up with that edge instead. About 0.62em a character at 12px.
              const x = sx(t.x);
              const half = (t.label.length * 12 * 0.62) / 2;
              const [anchor, at] =
                x - half < 0 ? (["start", 0] as const) : x + half > width ? (["end", width] as const) : (["middle", x] as const);
              return (
                <text
                  key={`${t.x}-${t.label}`}
                  x={at}
                  y={HEIGHT - 8}
                  textAnchor={anchor}
                  fontSize={12}
                  fill="#64748b"
                >
                  {t.label}
                </text>
              );
            })}

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
      {listing ? (
        <ListingStrip listing={listing} code={exchange!} currency={currency} />
      ) : (
        <p className="mt-2 text-xs text-slate-500">Times are in the exchange&apos;s local time.</p>
      )}
    </div>
  );
}
