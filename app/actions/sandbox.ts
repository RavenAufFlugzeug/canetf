"use server";

import { getPricesBefore, getPriceWindow } from "@/lib/db";

// The Sandbox's longest timeframe, in trading days (12 months).
const LONGEST = 252;

// The closes from Day `firstDay` to Day `lastDay` of the run that starts on the trading day
// `from`, or null if any of those days is missing. Asked for as the test moves on (a day,
// a week or a month at a time), so the days to come stay out of the page.
export async function getSandboxPrices(
  symbol: unknown,
  from: unknown,
  firstDay: unknown,
  lastDay: unknown,
): Promise<number[] | null> {
  if (typeof symbol !== "string" || typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  const isDay = (d: unknown): d is number => typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= LONGEST;
  if (!isDay(firstDay) || !isDay(lastDay) || firstDay > lastDay) return null;
  const run = await getPriceWindow(symbol, from, lastDay);
  return run.length === lastDay ? run.slice(firstDay - 1).map((p) => p.close) : null;
}

// Every close before Day 1 of the run that starts on the trading day `from`: the history the
// player may look back on once the test starts.
export async function getSandboxHistory(symbol: unknown, from: unknown): Promise<number[] | null> {
  if (typeof symbol !== "string" || typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  return getPricesBefore(symbol, from);
}
