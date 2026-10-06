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

// Returns null when the pipeline hasn't created the database yet.
export async function getCompanies(): Promise<Company[] | null> {
  // node:sqlite is synchronous; without this the query would run once at build time.
  await connection();

  if (!existsSync(DB_PATH)) {
    return null;
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return db
      .prepare(
        `SELECT c.symbol, c.name, c.sector, c.currency,
                c.market_cap  AS marketCap,
                c.pe_trailing AS peTrailing,
                q.price, q.change_pct AS changePct, q.fetched_at AS quotedAt,
                c.updated_at  AS updatedAt
         FROM companies c
         LEFT JOIN quotes q ON q.id = (
           SELECT id FROM quotes WHERE symbol = c.symbol
           ORDER BY fetched_at DESC, id DESC LIMIT 1
         )
         ORDER BY c.symbol`,
      )
      .all() as Company[];
  } finally {
    db.close();
  }
}
