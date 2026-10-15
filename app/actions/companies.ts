"use server";

import { findCompanies, findEtfs, type CompanyMatch } from "@/lib/db";

const MAX_QUERY_LENGTH = 12;

// With etfsOnly, only ETFs that have a composition are found.
export async function searchCompanies(query: unknown, etfsOnly: unknown = false): Promise<CompanyMatch[]> {
  if (typeof query !== "string") return [];
  const prefix = query.trim();
  if (!prefix || prefix.length > MAX_QUERY_LENGTH) return [];
  return etfsOnly === true ? findEtfs(prefix) : findCompanies(prefix);
}
