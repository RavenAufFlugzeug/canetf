"use server";

import { refresh } from "next/cache";
import { getAppDb } from "@/lib/appDb";
import { getCompany } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// Symbols already on the list are left as they are.
export async function addToWatchlist(symbol: unknown) {
  const user = await getCurrentUser();
  if (!user || typeof symbol !== "string") return;

  // Only symbols that exist in the stocks database.
  const company = await getCompany(symbol);
  if (!company) return;

  getAppDb()
    .prepare("INSERT OR IGNORE INTO watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)")
    .run(user.id, company.symbol, new Date().toISOString());
  refresh();
}

export async function removeFromWatchlist(symbol: unknown) {
  const user = await getCurrentUser();
  if (!user || typeof symbol !== "string") return;

  getAppDb().prepare("DELETE FROM watchlist WHERE user_id = ? AND symbol = ?").run(user.id, symbol);
  refresh();
}
