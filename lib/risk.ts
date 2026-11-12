// A fund's risk rating, from its own price history, following the Canadian Securities
// Administrators' risk classification methodology (National Instrument 81-102, Appendix F),
// which fund companies use for the risk level in their ETF Facts: the standard deviation of
// up to ten years of monthly returns, annualized, placed in one of five bands.
//
// Differences from the official method (stated on the page, in RiskRating's Methodology):
// - A fund with under ten years of history is rated on the history it has (at least
//   MIN_MONTHS); the official method fills the gap with a reference index.
// - Returns are price returns, without distributions reinvested (the database keeps no
//   dividends); the official method uses total returns.
//
// No server-only imports: client components (the Holdings Map, the illustration) use it too.

// The five levels, lowest first, and the annualized standard deviation (%) each runs up to
// (but not including); the last has no upper bound.
export const RISK_LEVELS = [
  { name: "Low", upTo: 6 },
  { name: "Low to medium", upTo: 11 },
  { name: "Medium", upTo: 16 },
  { name: "Medium to high", upTo: 20 },
  { name: "High", upTo: null },
] as const;

export const RISK_YEARS = 10; // the period measured, in years of monthly returns
export const MIN_MONTHS = 36; // the fewest monthly returns a fund is rated on

// A month-end closing price ("YYYY-MM"), and one month's return (e.g. -0.032).
export type MonthClose = { month: string; date: string; close: number };
export type MonthReturn = { month: string; change: number };

export type Risk = {
  // An index into RISK_LEVELS, or null with fewer than MIN_MONTHS returns.
  level: number | null;
  months: number; // monthly returns used (at most RISK_YEARS * 12)
  closes: MonthClose[]; // the month-end closes used: one more than the returns (the first is the base)
  returns: MonthReturn[];
  // Every daily close from the first month-end used to the latest (the month in progress, which
  // is left out, included), for showing which prices are used.
  days: { date: string; close: number }[];
  monthlyStdDev: number | null; // as a fraction
  stdDev: number | null; // annualized, in % (e.g. 12.87)
  average: number | null; // the mean monthly return, as a fraction
  best: MonthReturn | null;
  worst: MonthReturn | null;
};

// "YYYY-MM" -> months since year 0, so consecutive months differ by exactly 1.
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

// The level for an annualized standard deviation (%).
export const levelOf = (stdDev: number) => {
  const i = RISK_LEVELS.findIndex((l) => l.upTo !== null && stdDev < l.upTo);
  return i === -1 ? RISK_LEVELS.length - 1 : i;
};

// From daily closes (oldest first, "YYYY-MM-DD"), the fund's risk. The month of the latest
// close is excluded, as it may be incomplete.
export function computeRisk(daily: { date: string; close: number }[]): Risk {
  // Each month's last close (days are in order, so the last one seen wins).
  const monthEnd = new Map<string, { date: string; close: number }>();
  for (const d of daily) if (d.close > 0) monthEnd.set(d.date.slice(0, 7), d);
  const months = [...monthEnd.keys()].slice(0, -1);

  // The latest unbroken run of consecutive months, at most RISK_YEARS * 12 returns long.
  let start = months.length - 1;
  while (start > 0 && monthIndex(months[start]) - monthIndex(months[start - 1]) === 1) start--;
  const run = months.slice(Math.max(start, months.length - 1 - RISK_YEARS * 12));
  const closes = run.map((month) => ({ month, date: monthEnd.get(month)!.date, close: monthEnd.get(month)!.close }));
  const days = closes.length
    ? daily.filter((d) => d.close > 0 && d.date >= closes[0].date).map((d) => ({ date: d.date, close: d.close }))
    : [];
  const returns = closes.slice(1).map((c, i) => ({ month: c.month, change: c.close / closes[i].close - 1 }));

  const best = returns.length ? returns.reduce((a, b) => (b.change > a.change ? b : a)) : null;
  const worst = returns.length ? returns.reduce((a, b) => (b.change < a.change ? b : a)) : null;
  const base = { months: returns.length, closes, returns, days, best, worst };
  if (returns.length < MIN_MONTHS) {
    return { ...base, level: null, monthlyStdDev: null, stdDev: null, average: null };
  }

  // The sample standard deviation (dividing by n − 1).
  const average = returns.reduce((sum, r) => sum + r.change, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r.change - average) ** 2, 0) / (returns.length - 1);
  const monthlyStdDev = Math.sqrt(variance);
  const stdDev = monthlyStdDev * Math.sqrt(12) * 100;
  return { ...base, level: levelOf(stdDev), monthlyStdDev, stdDev, average };
}

// "2026-10" -> "Oct 2026".
const monthName = new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
export const formatMonth = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));

// The period measured, "Oct 2016 – Oct 2026" (null without returns).
export const periodOf = (risk: Risk) =>
  risk.closes.length > 1
    ? `${formatMonth(risk.closes[0].month)} – ${formatMonth(risk.closes[risk.closes.length - 1].month)}`
    : null;

// "7 years, 2 months", "10 years", "29 months".
export function spanOf(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${months} month${months === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}${rest ? `, ${rest} month${rest === 1 ? "" : "s"}` : ""}`;
}

// One line for a hover card: "Medium · 12.9% annualized" or "Not rated · 29 months of data".
export function riskSummary(risk: Risk): string {
  if (risk.level === null || risk.stdDev === null) return `Not rated · ${spanOf(risk.months)} of data`;
  return `${RISK_LEVELS[risk.level].name} · ${risk.stdDev.toFixed(1)}% annualized`;
}
