"use server";

import {
  getCadRates,
  getCadRatesSince,
  getCompany,
  getCompanyProfile,
  getDividends,
  getEtfBreakdown,
  getIntradayBars,
  getIntradayDays,
  getPricesBefore,
  getPriceWindow,
  majorOf,
  resolveHolding,
  type PricePoint,
} from "@/lib/db";
import { listingOf } from "@/lib/exchanges";
import { markOn, naicsOf } from "@/lib/naics";
import { kindOf, TIMEFRAMES } from "@/lib/sandbox";

// The Sandbox's longest timeframe, in trading days (4 years); the most listings a test has;
// and how far back each one's history goes before Day 1 (five years of trading days, which
// the chart's longest ranges show).
const LONGEST = Math.max(...TIMEFRAMES.map((t) => t.days));
const MOST = 24;
const HISTORY = 1260;

// The indices into `points` of the days that begin a new year (each the first trading day
// of its year after a day of the year before), for the chart's YTD range. Only these places
// are passed on, not the dates, so the test's dates stay out of sight.
const yearStarts = (points: PricePoint[]) =>
  points.flatMap((p, i) => (i > 0 && p.t.slice(0, 4) !== points[i - 1].t.slice(0, 4) ? [i] : []));

const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

// A test's listings, each with the trading day its run starts on, as the client sends them.
// (`offset`: in a set chosen by hand, how many of the test's days pass before one listed late
// is first traded, on its `from`.)
type Entry = { symbol: string; from: string; offset?: number };
const entriesOf = (entries: unknown): Entry[] | null =>
  Array.isArray(entries) &&
  entries.length > 0 &&
  entries.length <= MOST &&
  entries.every(
    (e) =>
      e &&
      typeof e.symbol === "string" &&
      isDate(e.from) &&
      (e.offset === undefined || (Number.isInteger(e.offset) && e.offset >= 0 && e.offset <= LONGEST)),
  )
    ? (entries as Entry[])
    : null;
// How many of a listing's own trading days fall within the test's first `day` days (none, for
// one not listed yet by then).
const ownDays = (e: Entry, day: number) => Math.max(day - (e.offset ?? 0), 0);

// What a finished test was: the stretch of time it ran over (its first and last trading
// days) and each listing's real name and ticker. Kept from the page until the test is over
// (asked for only then), so the test stays blind while it runs.
export async function revealSandboxSet(
  entries: unknown,
  days: unknown,
): Promise<{ first: string; last: string; names: Record<string, string | null> } | null> {
  const list = entriesOf(entries);
  if (!list || typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > LONGEST) return null;
  let first: string | null = null;
  let last: string | null = null;
  const names: Record<string, string | null> = {};
  for (const entry of list) {
    const { symbol, from } = entry;
    names[symbol] = (await getCompany(symbol))?.name ?? null;
    // (One listed only after the test has no days in it.)
    if (!ownDays(entry, days)) continue;
    const run = await getPriceWindow(symbol, from, ownDays(entry, days));
    if (!run.length) return null;
    if (!first || run[0].t < first) first = run[0].t;
    const end = run[run.length - 1].t;
    if (!last || end > last) last = end;
  }
  return first && last ? { first, last, names } : null;
}

// A test's days for each of its listings, for a set chosen by hand (where nothing is hidden):
// the dates of the days before Day 1 its history covers (up to five years), and of Day 1 to
// Day `days`. Never asked for a random set, whose test stays blind.
export async function getSandboxDates(
  entries: unknown,
  days: unknown,
): Promise<Record<string, { before: string[]; during: string[] }> | null> {
  const list = entriesOf(entries);
  if (!list || typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > LONGEST) return null;
  const out: Record<string, { before: string[]; during: string[] }> = {};
  for (const entry of list) {
    const { symbol, from } = entry;
    // (One listed late: its own days, from its first.)
    out[symbol] = {
      before: (await getPricesBefore(symbol, from)).slice(-HISTORY).map((p) => p.t),
      during: ownDays(entry, days) ? (await getPriceWindow(symbol, from, ownDays(entry, days))).map((p) => p.t) : [],
    };
  }
  return out;
}

// A company or ETF found while choosing a set by hand, before it is added: its name, kind and
// sector's colours, what it does and where (its industry, or a fund's category; its base, or
// where a fund is listed), where it trades and in what, and its market value. Null for none on record, or an exchange rate (which can't be a pick).
export type ChooserPreview = {
  symbol: string;
  name: string;
  kind: string;
  color: string;
  mark: string;
  line: string;
  trades: string;
  currency: string | null;
  marketCap: number | null;
};
export async function getChooserPreview(symbol: unknown): Promise<ChooserPreview | null> {
  if (typeof symbol !== "string" || symbol.endsWith("=X")) return null;
  const company = await getCompany(symbol);
  if (!company || !company.currency) return null;
  const profile = await getCompanyProfile(symbol);
  const kind = kindOf(company);
  if (kind === "Currency") return null;
  const fund = kind === "ETF";
  const naics = naicsOf(company.sector, company.industry);
  const listing = listingOf(company.exchange);
  const place = [profile?.hqCity, company.hqCountry].filter(Boolean).join(", ");
  return {
    symbol: company.symbol,
    name: company.name ?? company.symbol,
    kind,
    color: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
    mark: (naics && markOn(naics)) ?? (fund ? "#ffffff" : "#0f172a"),
    line: [company.industry ?? (fund ? (company.category ?? "ETF") : null), place || (fund ? listing?.country : null)]
      .filter(Boolean)
      .join(" · "),
    trades: listing ? listing.exchange : "",
    currency: majorOf(company.currency),
    marketCap: company.marketCap ?? profile?.marketCap ?? null,
  };
}

// One holding of an ETF in a test, as its map shows it (see holdingsOf).
export type EtfHolding = {
  id: string; // its path: "h3" for the fourth holding, "h3-1" for the second of what that holds
  name: string;
  kind: string;
  color: string;
  mark: string;
  weight: number; // its share of the fund holding it
  currency: string | null;
  closes: number[] | null;
  sector: string | null; // what it is (not who), for the map's hover card
  industry: string | null;
  country: string | null; // where a company is based, for its flag (not who it is)
  exchange: string | null; // where it trades (a fund's flag is where it is listed)
  // For a fund held: what it holds in turn (as listed today), and how much of it that list
  // covers; `ratings` when it is a bond fund's split by credit rating.
  children?: EtfHolding[];
  listed?: number;
  ratings?: boolean;
};

// Whether a run of closes from `from` on is the test's own days: it starts within a week of
// `from` (its first trading day then), not years later for a listing that only began trading
// since (an ETF held today that didn't exist during the test).
const inTest = (run: PricePoint[], from: string) => {
  if (!run.length) return false;
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 7);
  return run[0].t <= start.toISOString().slice(0, 10);
};

// How many levels of funds within funds the test's map opens (as the full Holdings Map).
const ETF_DEPTH = 3;

// What a fund holds (as listed today), for the test's map, with nothing that names any of it
// (unless `open`: a set chosen by hand, where each is named as it is):
// each holding by its kind and number among those of its kind in this fund, its sector's
// colour and mark, its share of the fund, where it is from (for its flag), and its closes from
// Day 1 to Day `day`; a fund held, what it holds in turn (to ETF_DEPTH levels, never a fund
// inside itself). A bond fund's split by credit rating comes back as such, with no prices.
async function holdingsOf(
  symbol: string,
  from: string,
  day: number,
  prefix: string,
  path: string[],
  open = false,
): Promise<{ kind: "holding" | "rating"; items: EtfHolding[]; listed: number } | null> {
  const breakdown = await getEtfBreakdown(symbol);
  if (!breakdown || !breakdown.items.length) return null;
  const listed = breakdown.items.reduce((sum, it) => sum + it.weight, 0);
  if (breakdown.kind === "rating") {
    return {
      kind: "rating",
      listed,
      items: breakdown.items.map((it, i) => ({
        id: `${prefix}r${i}`,
        name: it.label,
        kind: "Company",
        color: "#e2e8f0",
        mark: "#0f172a",
        weight: it.weight,
        currency: null,
        closes: null,
        sector: null,
        industry: null,
        country: null,
        exchange: null,
      })),
    };
  }
  const counts: Record<string, number> = {};
  const items: EtfHolding[] = [];
  for (const [i, it] of breakdown.items.entries()) {
    // Under the symbol it is stored as (the list may spell it otherwise: RY for RY.TO).
    const stored = it.symbol ? await resolveHolding(it.symbol) : null;
    const company = stored ? await getCompany(stored) : null;
    const kind = company ? kindOf(company) : "Company";
    const naics = company ? naicsOf(company.sector, company.industry) : null;
    const fund = kind === "ETF";
    // One not stored here (no data to say what it is) is named so, not as a company of no sector.
    const group = company ? kind : "Not on record";
    counts[group] = (counts[group] ?? 0) + 1;
    const run = stored && company ? await getPriceWindow(stored, from, day) : [];
    const id = `${prefix}h${i}`;
    const inner =
      fund && stored && !path.includes(stored) && path.length < ETF_DEPTH
        ? await holdingsOf(stored, from, day, `${id}-`, [...path, stored], open)
        : null;
    items.push({
      id,
      name: open ? (company?.name ?? it.label) : `${group} (${counts[group]})`,
      kind,
      color: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
      mark: (naics && markOn(naics)) ?? (fund ? "#ffffff" : "#0f172a"),
      weight: it.weight,
      currency: company?.currency ?? null,
      closes: run.length === day && inTest(run, from) ? run.map((p) => p.close) : null,
      sector: company?.sector ?? null,
      industry: company?.industry ?? null,
      country: company?.hqCountry ?? null,
      exchange: company?.exchange ?? null,
      ...(inner ? { children: inner.items, listed: inner.listed, ratings: inner.kind === "rating" } : {}),
    });
  }
  return { kind: "holding", items, listed };
}

// What an ETF in a test holds (its largest holdings as listed today, and what any fund among
// them holds in turn), for its general info, with nothing that names them (see holdingsOf).
// No ticker, name or date leaves the server, so the test stays blind.
export async function getSandboxEtfHoldings(
  entry: unknown,
  day: unknown,
  open: unknown = false,
): Promise<{ kind: "holding" | "rating"; items: EtfHolding[]; listed: number } | null> {
  const list = entriesOf([entry]);
  if (!list || typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > LONGEST) return null;
  const { symbol, from } = list[0];
  // (A fund listed late: its own days, its first until it is listed.)
  return holdingsOf(symbol, from, Math.max(ownDays(list[0], day), 1), "", [symbol], open === true);
}

// One of an ETF's holdings (by its id from getSandboxEtfHoldings) for the Sandbox's chart, as
// a pick's: its closes before the test (up to five years), its closes from Day 1 to Day
// `day`, and which of all those days begin a year. Still with no ticker, name or date (unless
// `open`, for a set chosen by hand: then with the dates of those days too).
export async function getSandboxEtfHoldingChart(
  entry: unknown,
  day: unknown,
  id: unknown,
  open: unknown = false,
): Promise<{
  history: number[];
  prices: number[];
  yearStarts: number[];
  dates?: { before: string[]; during: string[] };
} | null> {
  const list = entriesOf([entry]);
  if (!list || typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > LONGEST) return null;
  // Its path ("h3-1"): the second holding of the fourth holding's fund.
  const steps =
    typeof id === "string" && /^h\d+(-h\d+)*$/.test(id) ? id.split("-").map((step) => Number(step.slice(1))) : null;
  if (!steps || steps.length > ETF_DEPTH + 1) return null;
  const { symbol, from } = list[0];
  // (A fund listed late: its own days, its first until it is listed.)
  const own = Math.max(ownDays(list[0], day), 1);
  let holding: string | null = symbol;
  for (const at of steps) {
    const breakdown: Awaited<ReturnType<typeof getEtfBreakdown>> = holding ? await getEtfBreakdown(holding) : null;
    const ticker: string | null | undefined = breakdown?.kind === "holding" ? breakdown.items[at]?.symbol : null;
    holding = ticker ? await resolveHolding(ticker) : null;
  }
  if (!holding) return null;
  const before = (await getPricesBefore(holding, from)).slice(-HISTORY);
  const run = await getPriceWindow(holding, from, own);
  if (run.length !== own || !inTest(run, from)) return null;
  return {
    history: before.map((p) => p.close),
    prices: run.map((p) => p.close),
    yearStarts: yearStarts([...before, ...run]),
    ...(open === true ? { dates: { before: before.map((p) => p.t), during: run.map((p) => p.t) } } : {}),
  };
}

// For each of a test's listings, its closes from Day `firstDay` to Day `lastDay` of its run
// (in the currency it trades in), how many Canadian dollars one unit of that currency was
// worth on each of those days (`rates`: all 1 for CAD; the cash is in CAD, so a trade's cost
// and a holding's worth follow the exchange rate too), and which of those days (by number)
// begin a new year; or null if any listing is missing any of them. Asked for as the test moves on (a day, a week or a month at a time), so the
// days to come stay out of the page. With them, `dividends`: the cash dividend per share (in
// the listing's currency) whose ex-dividend date falls on each day, else 0. A share held at
// the close of the day before gets it. (Amounts only, never dates, so the test stays blind.)
export async function getSandboxSetPrices(
  entries: unknown,
  firstDay: unknown,
  lastDay: unknown,
): Promise<Record<
  string,
  { closes: number[]; rates: number[]; yearStarts: number[]; dividends: number[] }
> | null> {
  const list = entriesOf(entries);
  const isDay = (d: unknown): d is number =>
    typeof d === "number" && Number.isInteger(d) && d >= 1 && d <= LONGEST;
  if (!list || !isDay(firstDay) || !isDay(lastDay) || firstDay > lastDay) return null;
  const out: Record<string, { closes: number[]; rates: number[]; yearStarts: number[]; dividends: number[] }> =
    {};
  for (const entry of list) {
    const { symbol, from } = entry;
    const offset = entry.offset ?? 0;
    // Its own days up to Day `lastDay` (at least its first, for one not listed yet).
    const own = Math.max(ownDays(entry, lastDay), 1);
    const run = await getPriceWindow(symbol, from, own);
    if (run.length !== own) return null;
    // Each test day's close: before one listed late is listed, its first (it can't be traded
    // until then, so nothing is held at that price).
    const days = Array.from({ length: lastDay - firstDay + 1 }, (_, k) => run[Math.max(firstDay + k - offset - 1, 0)]);
    // Each dividend goes to the first of these days on or after its ex-dividend date (one
    // falling on a day the exchange was shut is paid on the next it opened), and only those
    // after the day before these days; none before one listed late is listed.
    const listed = (k: number) => firstDay + k > offset;
    const ownBefore = firstDay - offset - 2;
    const before = ownBefore >= 0 ? run[ownBefore].t : null;
    const dividends = days.map(() => 0);
    const firstListed = days.findIndex((_, k) => listed(k));
    if (firstListed >= 0) {
      for (const d of await getDividends(symbol, before ?? days[firstListed].t, days[days.length - 1].t)) {
        if (before && d.date <= before) continue;
        const at = days.findIndex((p, k) => listed(k) && p.t >= d.date);
        if (at >= 0) dividends[at] += d.amount;
      }
    }
    const rates = await getCadRates(
      symbol,
      days.map((p) => p.t),
    );
    if (!rates) return null;
    out[symbol] = {
      closes: days.map((p) => p.close),
      dividends,
      rates,
      yearStarts: yearStarts(run)
        .map((i) => i + 1 + offset)
        .filter((day) => day >= firstDay && day <= lastDay),
    };
  }
  return out;
}

// For each of a test's listings, its closes before Day 1 (up to five years of them: the
// history the player may look back on once the test starts), and which of them begin a new
// year (by index; the closes' length when Day 1 itself does). For one in another currency than
// CAD, its CAD rate on those same days too (`rates`, for a chart of the rate lined up with its
// price's), from the first of them the rate has, with where years begin among those
// (`rateYearStarts`). And each of those days' cash dividend per share (`dividends`, else 0).
export async function getSandboxSetHistory(
  entries: unknown,
): Promise<Record<
  string,
  { closes: number[]; yearStarts: number[]; dividends: number[]; rates?: number[]; rateYearStarts?: number[] }
> | null> {
  const list = entriesOf(entries);
  if (!list) return null;
  const out: Record<
    string,
    { closes: number[]; yearStarts: number[]; dividends: number[]; rates?: number[]; rateYearStarts?: number[] }
  > = {};
  for (const { symbol, from } of list) {
    const points = (await getPricesBefore(symbol, from)).slice(-HISTORY);
    const starts = yearStarts([...points, { t: from, close: 0 }]);
    const fx = await getCadRatesSince(
      symbol,
      points.map((p) => p.t),
    );
    // Where the rate's days begin among the history's (all of them, if it has none before Day 1).
    const found = fx ? fx.findIndex((r) => r !== null) : -1;
    const cut = found < 0 ? points.length : found;
    // Each day's cash dividend per share (on the first trading day on or after its ex-dividend
    // date), else 0: amounts only, for a strategy's yield (never their dates).
    const dividends = points.map(() => 0);
    if (points.length)
      for (const d of await getDividends(symbol, points[0].t, points[points.length - 1].t)) {
        const at = points.findIndex((p) => p.t >= d.date);
        if (at >= 0) dividends[at] += d.amount;
      }
    out[symbol] = {
      closes: points.map((p) => p.close),
      yearStarts: starts,
      dividends,
      ...(fx
        ? {
            rates: fx.slice(cut) as number[],
            rateYearStarts: starts.filter((i) => i >= cut).map((i) => i - cut),
          }
        : {}),
    };
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
