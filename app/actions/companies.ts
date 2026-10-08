"use server";

import { findCompanies, type CompanyMatch } from "@/lib/db";

const MAX_QUERY_LENGTH = 12;

export async function searchCompanies(query: unknown): Promise<CompanyMatch[]> {
  if (typeof query !== "string") return [];
  const prefix = query.trim();
  if (!prefix || prefix.length > MAX_QUERY_LENGTH) return [];
  return findCompanies(prefix);
}
