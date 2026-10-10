import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { connection } from "next/server";

// Same file the Python pipeline writes (search/StockUtils.py DB_PATH).
export const DB_PATH =
  process.env.CANETF_DB_PATH ?? path.join(process.cwd(), "search", "stocks.db");

export type Company = {
  symbol: string;
  name: string | null;
  sector: string | null;
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
  SELECT c.symbol, c.name, c.sector, c.currency,
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

// What an ETF is made of, or null for companies (and ETFs Yahoo has no breakdown for).
export async function getEtfBreakdown(symbol: string): Promise<EtfBreakdown | null> {
  const breakdown = await withDb((db) => {
    if (!hasTable(db, "etf_breakdown")) return null;
    const rows = db
      .prepare("SELECT kind, label, symbol, weight FROM etf_breakdown WHERE etf = ? ORDER BY kind, rank")
      .all(symbol) as { kind: EtfBreakdown["kind"]; label: string; symbol: string | null; weight: number }[];
    if (!rows.length) return null;
    // One kind per ETF; holdings win if both were ever stored.
    const kind: EtfBreakdown["kind"] = rows.some((r) => r.kind === "holding") ? "holding" : "rating";
    return {
      kind,
      items: rows
        .filter((r) => r.kind === kind)
        .map((r) => ({ label: r.label, symbol: r.symbol, weight: r.weight })),
    };
  });
  return breakdown ?? null;
}
