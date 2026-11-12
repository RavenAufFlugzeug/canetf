"use server";

import { getDividends, getYearEndCloses, type Dividend } from "@/lib/db";

// A listing's whole dividend history, for the Search page's dividend history pop-up: every cash
// dividend (ex-dividend date and amount per share, oldest first), and each calendar year's last
// close (for the year's yield). Null for anything but a ticker.
export async function getDividendHistory(
  symbol: unknown,
): Promise<{ payments: Dividend[]; yearEnds: { year: string; close: number }[] } | null> {
  if (typeof symbol !== "string" || !symbol || symbol.length > 32) return null;
  const [payments, yearEnds] = await Promise.all([
    getDividends(symbol, "0000-00-00", "9999-12-31"),
    getYearEndCloses(symbol),
  ]);
  return { payments: payments.map((d) => ({ ...d })), yearEnds: yearEnds.map((y) => ({ ...y })) };
}
