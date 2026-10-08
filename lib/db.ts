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

const COMPANY_SELECT = `
  SELECT c.symbol, c.name, c.sector, c.currency,
         c.market_cap  AS marketCap,
         c.pe_trailing AS peTrailing,
         q.price, q.change_pct AS changePct, q.fetched_at AS quotedAt,
         c.updated_at  AS updatedAt
  FROM companies c
  LEFT JOIN quotes q ON q.id = (
    SELECT id FROM quotes WHERE symbol = c.symbol
    ORDER BY fetched_at DESC, id DESC LIMIT 1
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

export async function getCompanies(): Promise<Company[] | null> {
  return withDb(
    (db) => db.prepare(`${COMPANY_SELECT} ORDER BY c.symbol`).all() as Company[],
  );
}

export async function getCompany(symbol: string): Promise<Company | null> {
  const company = await withDb(
    (db) =>
      db.prepare(`${COMPANY_SELECT} WHERE c.symbol = ?`).get(symbol.toUpperCase()) as
        | Company
        | undefined,
  );
  return company ?? null;
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

    return {
      daily: daily.map((r) => ({ t: r.date, close: r.close })),
      intraday: intraday.map((r) => ({ t: r.ts, close: r.close })),
    };
  });
  return history ?? { daily: [], intraday: [] };
}

export type KeyStats = {
  prevClose: number | null;
  open: number | null;
  bid: number | null;
  bidSize: number | null;
  ask: number | null;
  askSize: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  week52Low: number | null;
  week52High: number | null;
  volume: number | null;
  avgVolume: number | null;
};

// The figures listed under the price chart, from the latest quote and price history.
export async function getKeyStats(symbol: string): Promise<KeyStats | null> {
  return withDb((db) => {
    // SELECT *: quotes from before bid/ask/avg_volume were added simply lack them.
    const quote = (db
      .prepare("SELECT * FROM quotes WHERE symbol = ? ORDER BY fetched_at DESC, id DESC LIMIT 1")
      .get(symbol) ?? {}) as Record<string, number | null | undefined>;
    const company = (db
      .prepare("SELECT week52_low, week52_high FROM companies WHERE symbol = ?")
      .get(symbol) ?? {}) as Record<string, number | null | undefined>;

    // The previous close is the last daily close before the latest trading day, the
    // same baseline the 1D chart uses. (quotes.prev_close can disagree with Yahoo's.)
    const lastDaily = db
      .prepare("SELECT MAX(date) AS day FROM prices WHERE symbol = ?")
      .get(symbol) as { day: string | null };
    const lastBar = hasTable(db, "intraday")
      ? (db.prepare("SELECT MAX(ts) AS ts FROM intraday WHERE symbol = ?").get(symbol) as {
          ts: string | null;
        })
      : null;
    const latestDay = [lastDaily.day, lastBar?.ts?.slice(0, 10)].filter(Boolean).sort().at(-1);
    const prev = db
      .prepare(
        `SELECT close FROM prices WHERE symbol = ? AND date < ? AND close IS NOT NULL
         ORDER BY date DESC LIMIT 1`,
      )
      .get(symbol, latestDay ?? "") as { close: number } | undefined;

    return {
      prevClose: prev?.close ?? quote.prev_close ?? null,
      open: quote.open ?? null,
      bid: quote.bid ?? null,
      bidSize: quote.bid_size ?? null,
      ask: quote.ask ?? null,
      askSize: quote.ask_size ?? null,
      dayLow: quote.day_low ?? null,
      dayHigh: quote.day_high ?? null,
      week52Low: company.week52_low ?? null,
      week52High: company.week52_high ?? null,
      volume: quote.volume ?? null,
      avgVolume: quote.avg_volume ?? null,
    };
  });
}
