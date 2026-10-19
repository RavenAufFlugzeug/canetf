"use server";

import { findCompanies, findCompaniesByName, findEtfs, type CompanyMatch } from "@/lib/db";

// Longest search accepted: a symbol, or a (part of a) company's name.
const MAX_LENGTH = { symbol: 12, name: 60 };

// By symbol (those starting with the query), or by name (those containing it). With
// etfsOnly, only ETFs that have a composition are found.
export async function searchCompanies(
  query: unknown,
  etfsOnly: unknown = false,
  by: unknown = "symbol",
): Promise<CompanyMatch[]> {
  if (typeof query !== "string") return [];
  const text = query.trim();
  const byName = by === "name";
  if (!text || text.length > MAX_LENGTH[byName ? "name" : "symbol"]) return [];
  if (byName) return findCompaniesByName(text, 10, etfsOnly === true);
  return etfsOnly === true ? findEtfs(text) : findCompanies(text);
}
