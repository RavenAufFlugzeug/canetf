// The Sandbox's choices and its addresses, shared by its page (app/sandbox/page.tsx) and the
// action that makes a new pick (app/actions/sandbox.ts).

// How long a run of price data each timeframe loads, in trading days (one close per day).
export const TIMEFRAMES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "1m", label: "1 month", days: 21 },
  { key: "3m", label: "3 months", days: 63 },
  { key: "6m", label: "6 months", days: 126 },
  { key: "12m", label: "12 months", days: 252 },
];
// A pick has at least this many days, so it always has a timeframe to offer.
export const SHORTEST = Math.min(...TIMEFRAMES.map((t) => t.days));

// What the test can start with, in Canadian dollars.
export const AMOUNTS = [500, 1_000, 2_000, 5_000, 10_000];

// The choices a new pick starts with, so the test is ready to start at once: 7 days (which
// every pick has the prices for) and $500.
export const DEFAULT_RANGE = "7d";
export const DEFAULT_AMOUNT = 500;

// A pick's seed: a whole number below this, saying where in its history each timeframe's
// Day 1 falls (as a share of the way through it).
export const SEEDS = 1_000_000;
export const newSeed = () => Math.floor(Math.random() * SEEDS);

// A new seed for the same pick and timeframe whose Day 1 is a different one from `seed`'s,
// when there is another: `places` is how many Day 1s the timeframe could have (its price
// history's length, less the timeframe, plus one). A seed's Day 1 is that share of the way
// through them, rounded down (getStartDay in lib/db.ts), so a seed is picked from the middle
// of another one's share.
export function otherSeed(seed: number, places: number) {
  if (places < 2) return newSeed();
  const now = Math.min(Math.floor((seed / SEEDS) * places), places - 1);
  const next = (now + 1 + Math.floor(Math.random() * (places - 1))) % places;
  return Math.floor(((next + 0.5) / places) * SEEDS);
}

export type Choices = { pick?: boolean; symbol?: string; seed?: number; range?: string; amount?: number };

// The Sandbox's address for these choices; those left out aren't made yet.
export function sandboxHref({ pick, symbol, seed, range, amount }: Choices) {
  const params = new URLSearchParams();
  if (pick) params.set("pick", "1");
  if (symbol) params.set("symbol", symbol);
  if (seed !== undefined) params.set("seed", String(seed));
  if (range) params.set("range", range);
  if (amount) params.set("amount", String(amount));
  const query = params.toString();
  return query ? `/sandbox?${query}` : "/sandbox";
}
