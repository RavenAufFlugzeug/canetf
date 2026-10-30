// The Sandbox's choices, its addresses and how its picks are named, shared by its page
// (app/sandbox/page.tsx) and its parts.

// How long a run of price data each timeframe loads, in trading days (one close per day).
export const TIMEFRAMES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "1m", label: "1 month", days: 21 },
  { key: "3m", label: "3 months", days: 63 },
  { key: "6m", label: "6 months", days: 126 },
  { key: "12m", label: "12 months", days: 252 },
];

// What the test can start with, in Canadian dollars.
export const AMOUNTS = [500, 1_000, 2_000, 5_000, 10_000];

// How many companies and ETFs a test can have.
export const COUNTS = [4, 12, 24];

// The choices the page starts with: 7 days, $500 and 4 picks.
export const DEFAULT_RANGE = "7d";
export const DEFAULT_AMOUNT = 500;
export const DEFAULT_COUNT = 4;

// A set's seed: a whole number below this, from which the page picks the set's stretch of time
// and its listings (pickSandboxSet in lib/db.ts), the same every time for the same seed.
export const SEEDS = 1_000_000;
export const newSeed = () => Math.floor(Math.random() * SEEDS);

export type Choices = { range?: string; amount?: number; count?: number; seed?: number };

// The Sandbox's address for these choices; those left out aren't made yet (no seed: nothing
// picked yet).
export function sandboxHref({ range, amount, count, seed }: Choices) {
  const params = new URLSearchParams();
  if (amount) params.set("amount", String(amount));
  if (range) params.set("range", range);
  if (count) params.set("count", String(count));
  if (seed !== undefined) params.set("seed", String(seed));
  const query = params.toString();
  return query ? `/sandbox?${query}` : "/sandbox";
}

// What kind of listing a pick is, for its name and its mark: its line of business (from its
// sector, and for basic materials its industry: "TechCompany", "MiningCompany"), or an ETF.
type Kindable = {
  sector: string | null;
  industry: string | null;
  fundFamily: string | null;
  category: string | null;
};
const SECTOR_KINDS: Record<string, string> = {
  Technology: "Tech",
  "Communication Services": "Media",
  "Consumer Cyclical": "Consumer",
  "Consumer Defensive": "Staples",
  Energy: "Energy",
  "Financial Services": "Finance",
  Healthcare: "Health",
  Industrials: "Industrial",
  "Real Estate": "RealEstate",
  Utilities: "Utility",
};

export function kindOf({ sector, industry, fundFamily, category }: Kindable) {
  if (category === "Currency") return "Currency"; // an exchange rate (search/fx.py)
  if (!sector) return fundFamily || category ? "ETF" : "Company";
  if (sector === "Basic Materials") {
    if (/mining|gold|silver|copper|uranium|metal|coal/i.test(industry ?? "")) return "MiningCompany";
    if (/chemical/i.test(industry ?? "")) return "ChemicalCompany";
    if (/agricultur/i.test(industry ?? "")) return "AgriCompany";
    return "MaterialsCompany";
  }
  return `${SECTOR_KINDS[sector] ?? ""}Company`;
}

// Each pick's name, without its real one: its kind and its number among the picks of that
// kind ("TechCompany (1)", "TechCompany (2)", "MiningCompany (1)", "ETF (1)"). The player can
// give any pick an alias instead (SandboxAliases).
export function pickNames(picks: Kindable[]) {
  const seen: Record<string, number> = {};
  return picks.map((p) => {
    const kind = kindOf(p);
    seen[kind] = (seen[kind] ?? 0) + 1;
    return `${kind} (${seen[kind]})`;
  });
}
