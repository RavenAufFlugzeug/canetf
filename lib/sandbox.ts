// The Sandbox's choices, its addresses and how its picks are named, shared by its page
// (app/sandbox/page.tsx) and its parts.

// How long a run of price data each timeframe loads, in trading days (one close per day).
export const TIMEFRAMES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "1m", label: "1 month", days: 21 },
  { key: "3m", label: "3 months", days: 63 },
  { key: "6m", label: "6 months", days: 126 },
  { key: "12m", label: "1 year", days: 252 },
  { key: "2y", label: "2 years", days: 504 },
  { key: "4y", label: "4 years", days: 1008 },
];

// What the test can start with, in Canadian dollars.
export const AMOUNTS = [500, 1_000, 2_000, 5_000];

// What can be added each month, in Canadian dollars (0: nothing), for a test longer than
// MONTHLY_AFTER trading days (3 months): a set amount, or "random", a different amount each month
// (as someone with more or less to spare from month to month: RANDOM_MONTHLY). A month is 21
// trading days (as the test's Next month), and it comes in at the end of each: on Day 21, 42, 63
// and so on.
export type Monthly = number | "random";
export const MONTHLY: Monthly[] = [0, 50, 100, 500, 1_000, "random"];
export const DEFAULT_MONTHLY: Monthly = 0;
export const MONTH_DAYS = 21;
export const MONTHLY_AFTER = 63;
export const parseMonthly = (v: unknown): Monthly =>
  MONTHLY.find((m) => String(m) === v) ?? DEFAULT_MONTHLY;

// A random month's amount: from 0 to 500, on a bell curve round the middle (250, give or take
// 100), so the ends are rare; in whole dollars.
export const RANDOM_MONTHLY = { least: 0, most: 500, mean: 250, spread: 100 };

// What comes in at the end of each of `months` months. Random amounts follow from `seed` (the
// test's), so they stay the same however often they are worked out.
export function monthlyAmounts(monthly: Monthly, months: number, seed: string): number[] {
  if (monthly !== "random") return Array(months).fill(monthly);
  const next = seeded(seed);
  const { least, most, mean, spread } = RANDOM_MONTHLY;
  return Array.from({ length: months }, () => {
    // A normal draw (Box–Muller), kept within the range.
    const z = Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
    return Math.min(most, Math.max(least, Math.round(mean + z * spread)));
  });
}

// How much has been added by the end of Day `day`, each month's amount in `amounts`.
export function addedBy(amounts: number[], day: number) {
  const months = Math.floor(Math.max(day, 0) / MONTH_DAYS);
  let sum = 0;
  for (let i = 0; i < months; i++) sum += amounts[i] ?? 0;
  return sum;
}

// Numbers from 0 up to 1, the same for the same text (mulberry32 on its hash).
function seeded(text: string) {
  let a = 0;
  for (let i = 0; i < text.length; i++) a = (Math.imul(a, 31) + text.charCodeAt(i)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

// The most listings a set chosen by hand can have (as many as the largest random one).
export const MOST_CHOSEN = Math.max(...COUNTS);

// (`custom`: the listings are chosen by hand, `symbols`, and the test starts on `start`, rather
// than a random set at a random time.)
export type Choices = {
  range?: string;
  amount?: number;
  monthly?: Monthly;
  count?: number;
  seed?: number;
  custom?: boolean;
  symbols?: string[];
  start?: string;
};

// The Sandbox's address for these choices; those left out aren't made yet (no seed: nothing
// picked yet; no start: no custom set yet).
export function sandboxHref({ range, amount, monthly, count, seed, custom, symbols, start }: Choices) {
  const params = new URLSearchParams();
  if (custom) params.set("mode", "custom");
  if (amount) params.set("amount", String(amount));
  if (monthly) params.set("monthly", String(monthly));
  if (range) params.set("range", range);
  if (custom) {
    if (symbols?.length) params.set("symbols", symbols.join(","));
    if (start) params.set("start", start);
  } else if (count) params.set("count", String(count));
  if (seed !== undefined && !custom) params.set("seed", String(seed));
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
