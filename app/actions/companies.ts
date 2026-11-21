"use server";

import { findCompanies, findCompaniesByName, findEtfs, findRates, type CompanyMatch } from "@/lib/db";

// Longest search accepted: a symbol, or a (part of a) company's name.
const MAX_LENGTH = { symbol: 12, name: 60 };

// By symbol (those starting with the query), or by name (those containing it), or exchange
// rates only (by their codes or currencies' names). With etfsOnly, only ETFs that have a
// composition are found.
export async function searchCompanies(
  query: unknown,
  etfsOnly: unknown = false,
  by: unknown = "symbol",
): Promise<CompanyMatch[]> {
  if (typeof query !== "string") return [];
  const text = query.trim();
  const byName = by === "name" || by === "rate";
  if (!text || text.length > MAX_LENGTH[byName ? "name" : "symbol"]) return [];
  if (by === "rate") return etfsOnly === true ? [] : findRates(text);
  if (byName) return findCompaniesByName(text, 10, etfsOnly === true);
  return etfsOnly === true ? findEtfs(text) : findCompanies(text);
}
