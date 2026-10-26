"use server";

import {
  countPriceDays,
  getIntradayBars,
  getIntradayDays,
  getPricesBefore,
  getPriceWindow,
  pickRandomListing,
  type PricePoint,
} from "@/lib/db";
import { AMOUNTS, newSeed, sandboxHref, SHORTEST, TIMEFRAMES } from "@/lib/sandbox";

// The Sandbox's longest timeframe, in trading days (12 months).
const LONGEST = 252;

// The indices into `points` of the days that begin a new year (each the first trading day
// of its year after a day of the year before), for the chart's YTD range. Only these places
// are passed on, not the dates, so the test's dates stay out of sight.
const yearStarts = (points: PricePoint[]) =>
  points.flatMap((p, i) => (i > 0 && p.t.slice(0, 4) !== points[i - 1].t.slice(0, 4) ? [i] : []));

const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

// The closes from Day `firstDay` to Day `lastDay` of the run that starts on the trading day
// `from`, and which of those days (by number) begin a new year; or null if any of them is
// missing. Asked for as the test moves on (a day, a week or a month at a time), so the days
// to come stay out of the page.
export async function getSandboxPrices(
  symbol: unknown,
  from: unknown,
  firstDay: unknown,
  lastDay: unknown,
): Promise<{ closes: number[]; yearStarts: number[] } | null> {
  if (typeof symbol !== "string" || !isDate(from)) return null;
  const isDay = (d: unknown): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= LONGEST;
  if (!isDay(firstDay) || !isDay(lastDay) || firstDay > lastDay) return null;
  const run = await getPriceWindow(symbol, from, lastDay);
  if (run.length !== lastDay) return null;
  return {
    closes: run.slice(firstDay - 1).map((p) => p.close),
    yearStarts: yearStarts(run)
      .map((i) => i + 1)
      .filter((day) => day >= firstDay),
  };
}

// Every close before Day 1 of the run that starts on the trading day `from` (the history the
// player may look back on once the test starts), and which of them begin a new year (by
// index; the closes' length when Day 1 itself does).
export async function getSandboxHistory(
  symbol: unknown,
  from: unknown,
): Promise<{ closes: number[]; yearStarts: number[] } | null> {
  if (typeof symbol !== "string" || !isDate(from)) return null;
  const points = await getPricesBefore(symbol, from);
  return { closes: points.map((p) => p.close), yearStarts: yearStarts([...points, { t: from, close: 0 }]) };
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

// A new random pick for the Sandbox, with a seed of its own: the address to go to, keeping
// the timeframe (if the new pick has the days for it) and the starting amount, or null if
// there is nothing to pick. The page goes there itself, so it stays in place meanwhile.
export async function pickForSandbox(
  range: unknown,
  amount: unknown,
  current?: unknown,
): Promise<string | null> {
  // A different pick from the one shown now (`current`), unless it keeps coming up.
  let symbol = await pickRandomListing(SHORTEST);
  for (let tries = 0; symbol && symbol === current && tries < 5; tries++) symbol = await pickRandomListing(SHORTEST);
  if (!symbol) return null;
  const timeframe = TIMEFRAMES.find((t) => t.key === range);
  const fits = timeframe && timeframe.days <= (await countPriceDays(symbol));
  const start = AMOUNTS.find((a) => a === amount);
  return sandboxHref({ symbol, seed: newSeed(), range: fits ? timeframe.key : undefined, amount: start });
}
