"use server";

import { getIntradayBars, getIntradayDays, getPricesBefore, getPriceWindow, type PricePoint } from "@/lib/db";

// The Sandbox's longest timeframe, in trading days (12 months); the most listings a test has;
// and how far back each one's history goes before Day 1 (five years of trading days, which
// the chart's longest ranges show).
const LONGEST = 252;
const MOST = 24;
const HISTORY = 1260;

// The indices into `points` of the days that begin a new year (each the first trading day
// of its year after a day of the year before), for the chart's YTD range. Only these places
// are passed on, not the dates, so the test's dates stay out of sight.
const yearStarts = (points: PricePoint[]) =>
  points.flatMap((p, i) => (i > 0 && p.t.slice(0, 4) !== points[i - 1].t.slice(0, 4) ? [i] : []));

const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

// A test's listings, each with the trading day its run starts on, as the client sends them.
type Entry = { symbol: string; from: string };
const entriesOf = (entries: unknown): Entry[] | null =>
  Array.isArray(entries) &&
  entries.length > 0 &&
  entries.length <= MOST &&
  entries.every((e) => e && typeof e.symbol === "string" && isDate(e.from))
    ? (entries as Entry[])
    : null;

// For each of a test's listings, its closes from Day `firstDay` to Day `lastDay` of its run,
// and which of those days (by number) begin a new year; or null if any listing is missing
// any of them. Asked for as the test moves on (a day, a week or a month at a time), so the
// days to come stay out of the page.
export async function getSandboxSetPrices(
  entries: unknown,
  firstDay: unknown,
  lastDay: unknown,
): Promise<Record<string, { closes: number[]; yearStarts: number[] }> | null> {
  const list = entriesOf(entries);
  const isDay = (d: unknown): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= LONGEST;
  if (!list || !isDay(firstDay) || !isDay(lastDay) || firstDay > lastDay) return null;
  const out: Record<string, { closes: number[]; yearStarts: number[] }> = {};
  for (const { symbol, from } of list) {
    const run = await getPriceWindow(symbol, from, lastDay);
    if (run.length !== lastDay) return null;
    out[symbol] = {
      closes: run.slice(firstDay - 1).map((p) => p.close),
      yearStarts: yearStarts(run)
        .map((i) => i + 1)
        .filter((day) => day >= firstDay),
    };
  }
  return out;
}

// For each of a test's listings, its closes before Day 1 (up to five years of them: the
// history the player may look back on once the test starts), and which of them begin a new
// year (by index; the closes' length when Day 1 itself does).
export async function getSandboxSetHistory(
  entries: unknown,
): Promise<Record<string, { closes: number[]; yearStarts: number[] }> | null> {
  const list = entriesOf(entries);
  if (!list) return null;
  const out: Record<string, { closes: number[]; yearStarts: number[] }> = {};
  for (const { symbol, from } of list) {
    const points = (await getPricesBefore(symbol, from)).slice(-HISTORY);
    out[symbol] = { closes: points.map((p) => p.close), yearStarts: yearStarts([...points, { t: from, close: 0 }]) };
  }
  return out;
}

// An example of a day of `symbol`'s trading, for the Sandbox chart's 1D range: one of the
// recent days it has 5-minute bars for, at random (a whole session if it has one): its open,
// then each bar's close, by how far into the session it is (in minutes). The date isn't
// passed on.
export async function getSandboxExampleDay(
  symbol: unknown,
): Promise<{ minute: number; price: number }[] | null> {
  if (typeof symbol !== "string") return null;
  const days = await getIntradayDays(symbol);
  const whole = days.filter((d) => d.bars >= 60);
  const pool = whole.length ? whole : days;
  if (!pool.length) return null;
  const bars = await getIntradayBars(symbol, pool[Math.floor(Math.random() * pool.length)].date);
  if (bars.length < 2) return null;
  const minutes = (ts: string) => Number(ts.slice(11, 13)) * 60 + Number(ts.slice(14, 16));
  const start = minutes(bars[0].ts);
  return [
    { minute: 0, price: bars[0].open ?? bars[0].close },
    ...bars.map((b) => ({ minute: minutes(b.ts) - start + 5, price: b.close })),
  ];
}
