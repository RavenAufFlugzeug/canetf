import { existsSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync as Database } from "node:sqlite";
import { connection } from "next/server";

// Loaded from Node itself rather than imported: when this file changes, the dev server's
// hot reload can't load an imported node:sqlite again ("require is not defined"), and
// every page that reads the database fails until it is restarted.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
type DatabaseSync = Database;

// Same file the Python pipeline writes (search/StockUtils.py DB_PATH).
export const DB_PATH =
  process.env.CANETF_DB_PATH ?? path.join(process.cwd(), "search", "stocks.db");

export type Company = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  fundFamily: string | null;
  category: string | null;
  currency: string | null;
  marketCap: number | null;
  peTrailing: number | null;
  price: number | null;
  changePct: number | null;
  quotedAt: string | null;
  updatedAt: string | null;
};

// The change is measured from the previous close: the last daily close before the
// latest trading day in `prices` (the same baseline as the 1D chart and Yahoo).
// Yahoo quotes a few markets in minor units: London in pence (GBp), Johannesburg in
// cents (ZAc) and Tel Aviv in agorot (ILA). Prices are read in the main unit instead.
const MINOR_UNITS: Record<string, string> = { GBp: "GBP", ZAc: "ZAR", ILA: "ILS" };

// How much to divide a company's stored prices by (100 for pence and cents, else 1).
function priceScale(db: DatabaseSync, symbol: string) {
  const row = db.prepare("SELECT currency FROM companies WHERE symbol = ?").get(symbol) as
    | { currency: string | null }
    | undefined;
  return row?.currency && MINOR_UNITS[row.currency] ? 100 : 1;
}

// A company row in main units: GBp prices become GBP, and so on.
function inMajorUnits(c: Company): Company {
  const major = c.currency ? MINOR_UNITS[c.currency] : undefined;
  return major ? { ...c, currency: major, price: c.price === null ? null : c.price / 100 } : { ...c };
}

const COMPANY_SELECT = `
  SELECT c.symbol, c.name, c.sector, c.industry,
         c.fund_family AS fundFamily, c.category, c.currency,
         c.market_cap  AS marketCap,
         c.pe_trailing AS peTrailing,
         q.price, (q.price - prev.close) / prev.close * 100 AS changePct,
         q.fetched_at  AS quotedAt,
         c.updated_at  AS updatedAt
  FROM companies c
  -- The latest quote. (Picked by rowid: databases not yet migrated by the
  -- pipeline still keep one quote per run.)
  LEFT JOIN quotes q ON q.rowid = (
    SELECT rowid FROM quotes WHERE symbol = c.symbol ORDER BY fetched_at DESC LIMIT 1
  )
  LEFT JOIN prices prev ON prev.symbol = c.symbol AND prev.date = (
    SELECT date FROM prices WHERE symbol = c.symbol ORDER BY date DESC LIMIT 1 OFFSET 1
  )`;

// Returns null when the pipeline hasn't created the database yet.
async function withDb<T>(query: (db: DatabaseSync) => T): Promise<T | null> {
  // node:sqlite is synchronous; without this the query would run once at build time.
  await connection();

  if (!existsSync(DB_PATH)) {
    return null;
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return query(db);
  } finally {
    db.close();
  }
}

// The given companies, in the order given; symbols not in the database are skipped.
export async function getCompanies(symbols: string[]): Promise<Company[] | null> {
  if (!symbols.length) return [];
  return withDb((db) => {
    const rows = db
      .prepare(`${COMPANY_SELECT} WHERE c.symbol IN (${symbols.map(() => "?").join(", ")})`)
      .all(...symbols) as Company[];
    // Copied into plain objects: node:sqlite rows can't be passed to Client Components.
    const bySymbol = new Map(rows.map((c) => [c.symbol, inMajorUnits(c)]));
    return symbols.flatMap((s) => bySymbol.get(s) ?? []);
  });
}

export async function getCompany(symbol: string): Promise<Company | null> {
  const company = await withDb(
    (db) =>
      db.prepare(`${COMPANY_SELECT} WHERE c.symbol = ?`).get(symbol.toUpperCase()) as
        | Company
        | undefined,
  );
  return company ? inMajorUnits(company) : null;
}

// Yahoo's code for the exchange a company trades on (see lib/exchanges.ts), or null.
// Databases the pipeline hasn't migrated yet lack the column.
export async function getExchange(symbol: string): Promise<string | null> {
  const code = await withDb((db) => {
    const columns = db.prepare("PRAGMA table_info(companies)").all() as { name: string }[];
    if (!columns.some((c) => c.name === "exchange")) return null;
    const row = db.prepare("SELECT exchange FROM companies WHERE symbol = ?").get(symbol.toUpperCase()) as
      | { exchange: string | null }
      | undefined;
    return row?.exchange ?? null;
  });
  return code ?? null;
}

// What the Search page's About section shows of a company: its sector and industry (for
// its NAICS group), where it is based, its size, website and what it does, and its revenue
// (last 12 months) and total assets and liabilities (from its latest balance sheet, as of
// balanceDate), in the currency it reports in. Columns an older database lacks read as
// null. A fund has a fund family instead, and none of this.
export type CompanyProfile = {
  sector: string | null;
  industry: string | null;
  hqCity: string | null;
  hqState: string | null;
  hqCountry: string | null;
  website: string | null;
  employees: number | null;
  description: string | null;
  fundFamily: string | null;
  revenue: number | null;
  financialCurrency: string | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  balanceDate: string | null;
  marketCap: number | null; // its market value today, in what it trades in
};

export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  return withDb((db) => {
    const have = new Set(
      (db.prepare("PRAGMA table_info(companies)").all() as { name: string }[]).map((c) => c.name),
    );
    const col = (name: string, as: string) => (have.has(name) ? `${name} AS ${as}` : `NULL AS ${as}`);
    const row = db
      .prepare(
        `SELECT sector, industry, ${col("hq_city", "hqCity")}, ${col("hq_state", "hqState")},
                ${col("hq_country", "hqCountry")}, ${col("website", "website")},
                ${col("employees", "employees")}, ${col("description", "description")},
                ${col("fund_family", "fundFamily")}, ${col("revenue", "revenue")},
                ${col("financial_currency", "financialCurrency")}, ${col("total_assets", "totalAssets")},
                ${col("total_liabilities", "totalLiabilities")}, ${col("balance_date", "balanceDate")},
                ${col("market_cap", "marketCap")}
         FROM companies WHERE symbol = ?`,
      )
      .get(symbol.toUpperCase()) as CompanyProfile | undefined;
    // Copied into a plain object: node:sqlite rows can't be passed to Client Components.
    return row ? { ...row } : null;
  });
}

export type CompanyMatch = Pick<Company, "symbol" | "name">;

// Symbols starting with `prefix`, so "A" finds AAPL and AMZN.
export async function findCompanies(prefix: string, limit = 10): Promise<CompanyMatch[]> {
  const escaped = prefix.toUpperCase().replace(/[!%_]/g, (ch) => `!${ch}`);
  const matches = await withDb(
    (db) =>
      db
        .prepare(
          `SELECT symbol, name FROM companies
           WHERE symbol LIKE ? ESCAPE '!'
           ORDER BY symbol LIMIT ?`,
        )
        .all(`${escaped}%`, limit) as CompanyMatch[],
  );
  // node:sqlite rows have a null prototype, which server actions can't send to the client.
  return (matches ?? []).map(({ symbol, name }) => ({ symbol, name }));
}

// Companies and ETFs whose name contains `text` (any case), best matches first: names that
// start with it, then names with a word that starts with it, then the rest; shorter names
// first within each, so "apple" finds Apple Inc. before Pineapple Energy. With etfsOnly,
// only ETFs that have a composition (the Holdings Map's search, like findEtfs).
export async function findCompaniesByName(
  text: string,
  limit = 10,
  etfsOnly = false,
): Promise<CompanyMatch[]> {
  const escaped = text.replace(/[!%_]/g, (ch) => `!${ch}`);
  const matches = await withDb((db) => {
    if (etfsOnly && !hasTable(db, "etf_breakdown")) return [];
    return db
      .prepare(
        `SELECT symbol, name FROM companies
           WHERE name LIKE :contains ESCAPE '!'
             ${etfsOnly ? "AND symbol IN (SELECT etf FROM etf_breakdown)" : ""}
           ORDER BY CASE
                      WHEN name LIKE :starts ESCAPE '!' THEN 0
                      WHEN name LIKE :word ESCAPE '!' THEN 1
                      ELSE 2
                    END,
                    length(name), name
           LIMIT :limit`,
      )
      .all({
        contains: `%${escaped}%`,
        starts: `${escaped}%`,
        word: `% ${escaped}%`,
        limit,
      }) as CompanyMatch[];
  });
  return (matches ?? []).map(({ symbol, name }) => ({ symbol, name }));
}

export type PricePoint = { t: string; close: number };

export type PriceHistory = {
  daily: PricePoint[]; // t is the trading day, "YYYY-MM-DD"
  intraday: PricePoint[]; // t is the bar start in exchange time, e.g. "2026-10-07T09:30:00-04:00"
};

// Databases built before a table was added to the pipeline don't have it yet.
const hasTable = (db: DatabaseSync, name: string) =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

// Everything the price chart needs, oldest first. Rows are copied into plain
// objects so they can be passed to a Client Component.
export async function getPriceHistory(symbol: string): Promise<PriceHistory> {
  const history = await withDb((db) => {
    const daily = db
      .prepare(
        `SELECT date, close FROM prices
         WHERE symbol = ? AND close IS NOT NULL ORDER BY date`,
      )
      .all(symbol) as { date: string; close: number }[];

    const intraday = hasTable(db, "intraday")
      ? (db
          .prepare(
            `SELECT ts, close FROM intraday
             WHERE symbol = ? AND close IS NOT NULL ORDER BY ts`,
          )
          .all(symbol) as { ts: string; close: number }[])
      : [];

    const scale = priceScale(db, symbol);
    return {
      daily: daily.map((r) => ({ t: r.date, close: r.close / scale })),
      intraday: intraday.map((r) => ({ t: r.ts, close: r.close / scale })),
    };
  });
  return history ?? { daily: [], intraday: [] };
}

// A random company or ETF with at least `days` daily closes -> its symbol, or null if none
// has that many. Only listings in Canadian or US dollars, which the Sandbox's dollar
// amounts can buy.
export async function pickRandomListing(days: number): Promise<string | null> {
  const pick = await withDb(
    (db) =>
      db
        .prepare(
          // Whether a listing has a `days`-th close, looked up rather than counting every
          // close (millions of rows; this reads a few per listing).
          `SELECT c.symbol FROM companies c
           WHERE c.currency IN ('CAD', 'USD')
             AND (SELECT date FROM prices p WHERE p.symbol = c.symbol AND p.close IS NOT NULL
                  ORDER BY date LIMIT 1 OFFSET ?) IS NOT NULL
           ORDER BY RANDOM() LIMIT 1`,
        )
        .get(days - 1) as { symbol: string } | undefined,
  );
  return pick?.symbol ?? null;
}

// A listing that can be picked for the Sandbox: what it is (to name it without its name), and
// the trading day its test starts on.
export type SandboxPick = {
  symbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  fundFamily: string | null;
  category: string | null;
  currency: string | null; // what it trades in (CAD or USD)
  from: string;
};

// Every Sandbox listing's first and last day of prices, read once in a while: looking up
// each listing's ends through the index is quick, but not something to do on every pick.
type Span = Omit<SandboxPick, "from"> & { first: string; last: string };
let spans: { at: number; list: Span[] } | null = null;
const SPANS_TTL = 60 * 60 * 1000;

// A random number generator that always gives the same numbers for the same seed
// (mulberry32), so a Sandbox address picks the same set every time it is opened.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// `count` listings for the Sandbox, picked at random (by `seed`) from those trading through
// the same stretch of time: a start date is picked first, from the months when at least
// `count` listings have prices from two months before it until well after it, then listings that have
// a close on each of `days` trading days from that date. Each one's test starts on its own
// first trading day on or after that date (exchanges keep different holidays). Null if there
// aren't `count` listings for any stretch of `days` days.
export async function pickSandboxSet(
  count: number,
  days: number,
  seed: number,
): Promise<{ start: string; picks: SandboxPick[] } | null> {
  const picked = await withDb((db) => {
    if (!spans || Date.now() - spans.at > SPANS_TTL) {
      const list = db
        .prepare(
          `SELECT c.symbol, c.name, c.sector, c.industry,
                  ${hasColumn(db, "fund_family") ? "c.fund_family" : "NULL"} AS fundFamily,
                  ${hasColumn(db, "category") ? "c.category" : "NULL"} AS category, c.currency,
                  (SELECT MIN(date) FROM prices p WHERE p.symbol = c.symbol) AS first,
                  (SELECT MAX(date) FROM prices p WHERE p.symbol = c.symbol) AS last
           FROM companies c WHERE c.currency IN ('CAD', 'USD')`,
        )
        .all() as (Span & { first: string | null; last: string | null })[];
      spans = { at: Date.now(), list: list.filter((s): s is Span => Boolean(s.first && s.last)) };
    }
    const list = spans.list;
    const random = seeded(seed);
    // About how many calendar days `days` trading days take, with room for holidays; and how
    // long before the start each listing must have prices, so its chart has a past to show.
    const reach = Math.ceil(days * 1.5) + 10;
    const HISTORY = 60;
    // The months a test could start in: those with enough listings trading through it.
    const earliest = list.reduce((a, s) => (s.first < a ? s.first : a), "9999-12-31");
    const months: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (let d = `${earliest.slice(0, 7)}-01`; addDays(d, reach) < today; ) {
      const next = addDays(d, 31).slice(0, 7) + "-01";
      if (list.filter((s) => s.first <= addDays(d, -HISTORY) && s.last >= addDays(d, reach)).length >= count)
        months.push(d);
      d = next;
    }
    const startOf = db.prepare(
      "SELECT date FROM prices WHERE symbol = ? AND date >= ? AND close IS NOT NULL ORDER BY date LIMIT 1",
    );
    const lastOf = db.prepare(
      "SELECT date FROM prices WHERE symbol = ? AND date >= ? AND close IS NOT NULL ORDER BY date LIMIT 1 OFFSET ?",
    );
    // A few tries, in case a month's listings turn out to have gaps.
    for (let tries = 0; tries < 8 && months.length; tries++) {
      const month = months[Math.floor(random() * months.length)];
      const start = `${month.slice(0, 8)}${String(1 + Math.floor(random() * 28)).padStart(2, "0")}`;
      const pool = list.filter((s) => s.first <= addDays(start, -HISTORY) && s.last >= addDays(start, reach));
      // Shuffled (Fisher-Yates, by the seed), then taken in turn while they have every day.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const picks: SandboxPick[] = [];
      for (const s of pool) {
        if (picks.length === count) break;
        if (!lastOf.get(s.symbol, start, days - 1)) continue;
        const first = startOf.get(s.symbol, start) as { date: string } | undefined;
        if (!first) continue;
        const { first: _f, last: _l, ...about } = s;
        void _f;
        void _l;
        picks.push({ ...about, from: first.date });
      }
      if (picks.length === count) return { start, picks };
    }
    return null;
  });
  return picked ?? null;
}

// Whether the companies table has a column (databases the pipeline hasn't migrated lack some).
function hasColumn(db: DatabaseSync, name: string) {
  return (db.prepare("PRAGMA table_info(companies)").all() as { name: string }[]).some((c) => c.name === name);
}

// How many daily closes `symbol` has.
export async function countPriceDays(symbol: string): Promise<number> {
  const row = await withDb(
    (db) =>
      db.prepare("SELECT COUNT(*) AS n FROM prices WHERE symbol = ? AND close IS NOT NULL").get(symbol) as {
        n: number;
      },
  );
  return row?.n ?? 0;
}

// The first day of a run of `days` of `symbol`'s daily closes -> "YYYY-MM-DD", or null if
// it has fewer than that. `share` (0 to 1) says where in its history the run starts: 0 at
// its first day, 1 as late as it can, so the same share always gives the same day.
export async function getStartDay(symbol: string, days: number, share: number): Promise<string | null> {
  const first = await withDb((db) => {
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM prices WHERE symbol = ? AND close IS NOT NULL")
      .get(symbol) as { n: number };
    if (n < days) return undefined;
    const offset = Math.min(Math.floor(share * (n - days + 1)), n - days);
    return db
      .prepare(
        `SELECT date FROM prices WHERE symbol = ? AND close IS NOT NULL
         ORDER BY date LIMIT 1 OFFSET ?`,
      )
      .get(symbol, Math.max(offset, 0)) as { date: string };
  });
  return first?.date ?? null;
}

// Every daily close of `symbol` before the trading day `from`, oldest first.
export async function getPricesBefore(symbol: string, from: string): Promise<PricePoint[]> {
  const points = await withDb((db) => {
    const rows = db
      .prepare("SELECT date, close FROM prices WHERE symbol = ? AND date < ? AND close IS NOT NULL ORDER BY date")
      .all(symbol, from) as { date: string; close: number }[];
    const scale = priceScale(db, symbol);
    return rows.map((r) => ({ t: r.date, close: r.close / scale }));
  });
  return points ?? [];
}

// The trading days `symbol` has intraday (5-minute) bars for, oldest first, with how many
// bars each has (a whole regular session has 78).
export async function getIntradayDays(symbol: string): Promise<{ date: string; bars: number }[]> {
  const days = await withDb((db) =>
    hasTable(db, "intraday")
      ? (db
          .prepare(
            `SELECT date, COUNT(*) AS bars FROM intraday
             WHERE symbol = ? AND close IS NOT NULL GROUP BY date ORDER BY date`,
          )
          .all(symbol) as { date: string; bars: number }[])
      : [],
  );
  return days ?? [];
}

// `symbol`'s intraday bars on the trading day `date`, in order: each bar's start (in
// exchange time, e.g. "2026-10-07T09:30:00-04:00") and its open and close.
export async function getIntradayBars(
  symbol: string,
  date: string,
): Promise<{ ts: string; open: number | null; close: number }[]> {
  const bars = await withDb((db) => {
    if (!hasTable(db, "intraday")) return [];
    const rows = db
      .prepare(
        `SELECT ts, open, close FROM intraday
         WHERE symbol = ? AND date = ? AND close IS NOT NULL ORDER BY ts`,
      )
      .all(symbol, date) as { ts: string; open: number | null; close: number }[];
    const scale = priceScale(db, symbol);
    return rows.map((r) => ({ ts: r.ts, open: r.open === null ? null : r.open / scale, close: r.close / scale }));
  });
  return bars ?? [];
}

// Up to `days` daily closes of `symbol` from the trading day `from` on, oldest first.
export async function getPriceWindow(symbol: string, from: string, days: number): Promise<PricePoint[]> {
  const points = await withDb((db) => {
    const rows = db
      .prepare(
        `SELECT date, close FROM prices
         WHERE symbol = ? AND date >= ? AND close IS NOT NULL ORDER BY date LIMIT ?`,
      )
      .all(symbol, from, days) as { date: string; close: number }[];
    const scale = priceScale(db, symbol);
    return rows.map((r) => ({ t: r.date, close: r.close / scale }));
  });
  return points ?? [];
}

export type KeyStats = {
  prevClose: number | null;
  open: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  week52Low: number | null;
  week52High: number | null;
  volume: number | null;
  avgVolume: number | null;
};

type DailyBar = {
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

// The figures listed under the price chart. The day's figures and the previous close
// come from the daily bars in `prices`; the average volume from the quote.
export async function getKeyStats(symbol: string): Promise<KeyStats | null> {
  return withDb((db) => {
    // The latest trading day's bar, then the one before it (whose close is the previous close).
    const [today, previous] = db
      .prepare(
        "SELECT open, high, low, close, volume FROM prices WHERE symbol = ? ORDER BY date DESC LIMIT 2",
      )
      .all(symbol) as DailyBar[];
    // SELECT *: a database the pipeline hasn't migrated yet may lack avg_volume.
    const quote = (db
      .prepare("SELECT * FROM quotes WHERE symbol = ? ORDER BY fetched_at DESC LIMIT 1")
      .get(symbol) ?? {}) as Record<string, number | null | undefined>;
    const company = (db
      .prepare("SELECT week52_low, week52_high FROM companies WHERE symbol = ?")
      .get(symbol) ?? {}) as Record<string, number | null | undefined>;

    const scale = priceScale(db, symbol);
    const unit = (v: number | null | undefined) => (v === null || v === undefined ? null : v / scale);
    return {
      prevClose: unit(previous?.close),
      open: unit(today?.open),
      dayLow: unit(today?.low),
      dayHigh: unit(today?.high),
      week52Low: unit(company.week52_low),
      week52High: unit(company.week52_high),
      volume: today?.volume ?? null,
      avgVolume: quote.avg_volume ?? null,
    };
  });
}

export type EtfBreakdown = {
  kind: "holding" | "rating"; // top holdings, or a bond fund's split by credit rating
  items: { label: string; symbol: string | null; weight: number }[]; // weight: share of the fund, 0..1
};

function readBreakdown(db: DatabaseSync, symbol: string): EtfBreakdown | null {
  const rows = db
    .prepare("SELECT kind, label, symbol, weight FROM etf_breakdown WHERE etf = ? ORDER BY kind, rank")
    .all(symbol) as { kind: EtfBreakdown["kind"]; label: string; symbol: string | null; weight: number }[];
  if (!rows.length) return null;
  // One kind per ETF; holdings win if both were ever stored.
  const kind: EtfBreakdown["kind"] = rows.some((r) => r.kind === "holding") ? "holding" : "rating";
  return {
    kind,
    // Largest share first, for credit ratings too (which are stored from AAA down).
    items: rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ label: r.label, symbol: r.symbol, weight: r.weight }))
      .sort((a, b) => b.weight - a.weight),
  };
}

// What an ETF is made of, or null for companies (and ETFs Yahoo has no breakdown for).
export async function getEtfBreakdown(symbol: string): Promise<EtfBreakdown | null> {
  const breakdown = await withDb((db) =>
    hasTable(db, "etf_breakdown") ? readBreakdown(db, symbol) : null,
  );
  return breakdown ?? null;
}

// Symbols of ETFs with a composition, starting with `prefix` (the Holdings Map's search).
export async function findEtfs(prefix: string, limit = 10): Promise<CompanyMatch[]> {
  const escaped = prefix.toUpperCase().replace(/[!%_]/g, (ch) => `!${ch}`);
  const matches = await withDb((db) =>
    hasTable(db, "etf_breakdown")
      ? (db
          .prepare(
            `SELECT symbol, name FROM companies
             WHERE symbol LIKE ? ESCAPE '!' AND symbol IN (SELECT etf FROM etf_breakdown)
             ORDER BY symbol LIMIT ?`,
          )
          .all(`${escaped}%`, limit) as CompanyMatch[])
      : [],
  );
  return (matches ?? []).map(({ symbol, name }) => ({ symbol, name }));
}

// One product on the Holdings Map: the chosen ETF, something it holds, something that
// holds, and so on.
export type EtfTreeNode = {
  id: string; // its place in the tree: "0" is the chosen ETF, "0.2" its third part
  // fund: has a composition of its own. holding: a company or other single holding, where
  // a branch ends. rating: a slice of a bond fund by credit rating. other: the part of a
  // fund its holdings list doesn't itemise.
  kind: "fund" | "holding" | "rating" | "other";
  label: string;
  symbol: string | null;
  stored: boolean; // in the database, so it has a Search page
  // For a holding that isn't stored: why we have no data on it (null otherwise).
  missing: MissingReason | null;
  // For a stored company or fund: what it is and where, for the map's hover card.
  details: NodeDetails | null;
  weight: number; // share of the fund it is in, 0..1 (1 for the chosen ETF)
  children: EtfTreeNode[];
};

// What the Holdings Map's hover card says about a stored company or fund (null fields are
// unknown). exchange is Yahoo's code (see lib/exchanges.ts).
export type NodeDetails = {
  sector: string | null;
  industry: string | null;
  hqCity: string | null;
  hqCountry: string | null;
  fundFamily: string | null;
  category: string | null;
  exchange: string | null;
};

// Why an ETF holding isn't in the database (holding_symbols.reason in search/StockUtils.py).
// cash: a cash or money-market fund, not a company. stopped: no longer trades, usually
// after a merger, takeover or delisting (lastTrade is its last trading day). unlisted:
// Yahoo Finance has no listing for it. pending: not looked up yet (the hourly update adds
// new holdings a few at a time).
export type MissingReason = {
  reason: "cash" | "stopped" | "unlisted" | "pending";
  lastTrade: string | null;
};

const MAX_TREE_DEPTH = 8; // funds of funds go 3 deep today; this only stops a runaway

// The chosen ETF's composition, then each part's own composition, down to the companies
// (or credit ratings) where nothing more is known. Null when the symbol has no composition.
export async function getEtfTree(symbol: string): Promise<EtfTreeNode | null> {
  const tree = await withDb((db) => {
    if (!hasTable(db, "etf_breakdown")) return null;
    const company = db.prepare("SELECT symbol, name FROM companies WHERE symbol = ?");
    // Holdings lists don't always spell a ticker the way it is stored (see holding_symbols).
    const alias = hasTable(db, "holding_symbols")
      ? db.prepare("SELECT symbol FROM holding_symbols WHERE holding = ?")
      : null;
    // Why a holding has no company here; older databases lack the reason columns.
    const columns = hasTable(db, "holding_symbols")
      ? (db.prepare("PRAGMA table_info(holding_symbols)").all() as { name: string }[]).map((c) => c.name)
      : [];
    const why = columns.includes("reason")
      ? db.prepare("SELECT reason, last_trade AS lastTrade FROM holding_symbols WHERE holding = ? AND symbol IS NULL")
      : null;
    const missingReason = (ticker: string | null): MissingReason => {
      if (!ticker) return { reason: "unlisted", lastTrade: null };
      const row = why?.get(ticker) as { reason: string | null; lastTrade: string | null } | undefined;
      if (!row) return { reason: "pending", lastTrade: null };
      const reason = (["cash", "stopped"] as const).find((r) => r === row.reason) ?? "unlisted";
      return { reason, lastTrade: row.lastTrade };
    };
    // Details for the hover card; columns an older database lacks read as null.
    const have = new Set(
      (db.prepare("PRAGMA table_info(companies)").all() as { name: string }[]).map((c) => c.name),
    );
    const col = (name: string, as: string) => (have.has(name) ? `${name} AS ${as}` : `NULL AS ${as}`);
    const detailsOf = db.prepare(
      `SELECT sector, industry, ${col("hq_city", "hqCity")}, ${col("hq_country", "hqCountry")},
              ${col("fund_family", "fundFamily")}, ${col("category", "category")}, ${col("exchange", "exchange")}
       FROM companies WHERE symbol = ?`,
    );
    const find = (ticker: string) => {
      const direct = company.get(ticker) as { symbol: string; name: string | null } | undefined;
      if (direct) return direct;
      const mapped = alias?.get(ticker) as { symbol: string | null } | undefined;
      return mapped?.symbol
        ? (company.get(mapped.symbol) as { symbol: string; name: string | null } | undefined)
        : undefined;
    };

    // `path` holds the funds above this one, so a fund that (indirectly) holds itself
    // isn't opened a second time.
    function build(
      id: string,
      ticker: string | null,
      label: string,
      weight: number,
      path: string[],
    ): EtfTreeNode {
      const found = ticker ? find(ticker) : undefined;
      const node: EtfTreeNode = {
        id,
        kind: "holding",
        label: found?.name ?? label,
        symbol: found?.symbol ?? ticker,
        stored: Boolean(found),
        missing: found ? null : missingReason(ticker),
        // Copied into a plain object: node:sqlite rows can't be passed to a client component.
        details: found ? { ...(detailsOf.get(found.symbol) as NodeDetails) } : null,
        weight,
        children: [],
      };
      if (!found || path.includes(found.symbol) || path.length >= MAX_TREE_DEPTH) return node;
      const breakdown = readBreakdown(db, found.symbol);
      if (!breakdown) return node;

      node.kind = "fund";
      const below = [...path, found.symbol];
      node.children = breakdown.items.map((it, i) =>
        breakdown.kind === "rating"
          ? { id: `${id}.${i}`, kind: "rating", label: it.label, symbol: null, stored: false, missing: null, details: null, weight: it.weight, children: [] }
          : build(`${id}.${i}`, it.symbol, it.label, it.weight, below),
      );
      // Holdings lists give the largest few; the rest of the fund is one unnamed part.
      const rest = 1 - breakdown.items.reduce((sum, it) => sum + it.weight, 0);
      if (breakdown.kind === "holding" && rest > 0.001) {
        node.children.push({
          id: `${id}.${node.children.length}`,
          kind: "other",
          label: "Other holdings",
          symbol: null,
          stored: false,
          missing: null,
          details: null,
          weight: rest,
          children: [],
        });
      }
      return node;
    }

    const root = build("0", symbol.toUpperCase(), symbol.toUpperCase(), 1, []);
    return root.kind === "fund" ? root : null;
  });
  return tree ?? null;
}
