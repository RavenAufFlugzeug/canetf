"use server";

import { getCompany, getCompanyProfile, getExchange, getKeyStats, getPriceHistory } from "@/lib/db";
import { PROVIDER_SYMBOLS } from "@/lib/providers";

// Everything a fund provider's pop-up shows of the listed company behind it, as the Search
// page shows a company: its name and badge, its price chart and key figures, and its About.
// Only the providers' companies (lib/providers.ts) are served; null for any other symbol, or
// one not in the database.
export async function getProviderCompany(symbol: unknown) {
  if (typeof symbol !== "string" || !PROVIDER_SYMBOLS.includes(symbol)) return null;
  const company = await getCompany(symbol);
  if (!company) return null;
  const [history, stats, exchange, profile] = await Promise.all([
    getPriceHistory(symbol),
    getKeyStats(symbol),
    getExchange(symbol),
    getCompanyProfile(symbol),
  ]);
  return history ? { company, history, stats, exchange, profile } : null;
}
