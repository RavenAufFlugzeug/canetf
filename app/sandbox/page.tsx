import Link from "next/link";
import { redirect } from "next/navigation";
import CompanyAbout from "@/components/CompanyAbout";
import HoldingsMap from "@/components/HoldingsMap";
import SandboxTest from "@/components/SandboxTest";
import {
  countPriceDays,
  getCompany,
  getCompanyProfile,
  getEtfTree,
  getStartDay,
  pickRandomListing,
} from "@/lib/db";
import { hideName } from "@/lib/hideName";

// How long a run of price data each timeframe loads, in trading days (one close per day).
const TIMEFRAMES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "1m", label: "1 month", days: 21 },
  { key: "3m", label: "3 months", days: 63 },
  { key: "6m", label: "6 months", days: 126 },
  { key: "12m", label: "12 months", days: 252 },
];
// A pick has at least this many days, so it always has a timeframe to offer.
const SHORTEST = Math.min(...TIMEFRAMES.map((t) => t.days));

// What the test can start with, in Canadian dollars.
const AMOUNTS = [1_000, 10_000, 100_000];
const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

// A choice chip: the chosen one is dark; the others lift a touch when pointed at.
const chipClass = (chosen: boolean) =>
  `inline-block rounded-full border px-3 py-1 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
    chosen
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm motion-safe:hover:-translate-y-0.5"
  }`;
// A pick's seed: a whole number below this, saying where in its history each timeframe's
// Day 1 falls (as a share of the way through it).
const SEEDS = 1_000_000;
const newSeed = () => Math.floor(Math.random() * SEEDS);

const BUTTON =
  "inline-block shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

type Choices = { pick?: boolean; symbol?: string; seed?: number; range?: string; amount?: number };

// The Sandbox's address for these choices; those left out aren't made yet.
function sandboxHref({ pick, symbol, seed, range, amount }: Choices) {
  const params = new URLSearchParams();
  if (pick) params.set("pick", "1");
  if (symbol) params.set("symbol", symbol);
  if (seed !== undefined) params.set("seed", String(seed));
  if (range) params.set("range", range);
  if (amount) params.set("amount", String(amount));
  const query = params.toString();
  return query ? `/sandbox?${query}` : "/sandbox";
}

// One step of the Sandbox, numbered and titled, with a rule above it.
function Step({ n, title, delay = 0, children }: { n: number; title: string; delay?: number; children: React.ReactNode }) {
  return (
    <section className="rise-in mt-6 border-t border-slate-200 pt-6" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="flex items-center gap-2.5 text-lg font-semibold text-slate-900">
        <span className="grid size-6 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// A place to try things out, in four steps. 1: a random company or ETF, which changes only
// when the player asks for another; its prices aren't shown, only what it is like (its
// About section, as on the Search page, and for an ETF its composition map, as on the
// Holdings Map), with its name, and so its website, hidden. 2: a timeframe, from those its
// price history is long enough for, each with a random Day 1 in that history (set by the
// pick's seed, so switching timeframes is an ordinary link, like choosing an amount, and
// leaves the rest of the page as it is). 3: a starting amount. 4: the testing ground,
// trading it day by day (SandboxTest).
export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const asked = TIMEFRAMES.find((t) => t.key === params.range) ?? null;
  const start = AMOUNTS.find((a) => String(a) === params.amount) ?? null;
  const amount = start ?? undefined;

  // A new pick, asked for, with a seed of its own. It's kept in the address so a refresh
  // keeps it, along with the timeframe (if the new pick has the days for it) and amount.
  if (params.pick) {
    const symbol = await pickRandomListing(SHORTEST);
    if (symbol) {
      const fits = asked && asked.days <= (await countPriceDays(symbol));
      redirect(sandboxHref({ symbol, seed: newSeed(), range: fits ? asked.key : undefined, amount }));
    }
  }

  const company = typeof params.symbol === "string" ? await getCompany(params.symbol) : null;
  const available = company ? await countPriceDays(company.symbol) : 0;
  const picked = company && available >= SHORTEST ? company : null;
  // The timeframes its price history is long enough for.
  const offered = TIMEFRAMES.filter((t) => t.days <= available);
  const timeframe = offered.find((t) => t.key === asked?.key) ?? null;

  // The pick's seed; an address typed without one gets one.
  const seed = Number(params.seed);
  if (picked && !(Number.isInteger(seed) && seed >= 0 && seed < SEEDS)) {
    redirect(sandboxHref({ symbol: picked.symbol, seed: newSeed(), range: timeframe?.key, amount }));
  }
  // The chosen timeframe's Day 1.
  const from = picked && timeframe ? await getStartDay(picked.symbol, timeframe.days, seed / SEEDS) : null;

  const profile = picked ? await getCompanyProfile(picked.symbol) : null;
  // Only ETFs with a holdings list have a tree. Its first box is the ETF itself: its ticker
  // and name are hidden, and its provider (iShares, Vanguard: part of the name) left out.
  const etfTree = picked ? await getEtfTree(picked.symbol) : null;
  const tree = etfTree && {
    ...etfTree,
    symbol: null,
    label: "???",
    details: etfTree.details && { ...etfTree.details, fundFamily: null },
  };
  // A fund has a provider (fund family) or a composition; a company has neither.
  const kind = profile?.fundFamily || tree ? "ETF" : "Company";
  const ready = picked && timeframe && from;

  // Asks for a new pick (made fresh each time, so not prefetched), keeping the other choices.
  const pickHref = sandboxHref({ pick: true, range: timeframe?.key ?? asked?.key, amount });

  return (
    <main className="flex-1 bg-slate-50">
      {/* One width for every pick, company or ETF, so the page doesn't jump between them:
          wide enough for three levels of an ETF's map (deeper ones scroll sideways). */}
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Sandbox</h1>
          <p className="mt-1 text-slate-600">
            A workspace for testing your ideas, forecasts and expectations against real market
            data: trade a mystery company or ETF day by day, and see how you do.
          </p>

          <Step n={1} title="Company or ETF">
            {/* Keyed by the pick, so each new one plays its entrance. */}
            <div key={picked?.symbol ?? "none"} className="rise-in mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
              <div className="min-w-0">
                {picked ? (
                  <>
                    <p className="font-semibold text-slate-900">{kind} ??? selected</p>
                    <p className="text-sm text-slate-500">
                      Its name stays hidden. {available.toLocaleString("en-CA")} trading days of
                      prices on record.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">
                    {typeof params.symbol === "string"
                      ? "That pick isn't in our database. Pick another."
                      : "Pick a random company or ETF to test with. Its name stays hidden."}
                  </p>
                )}
              </div>
              <Link
                href={pickHref}
                prefetch={false}
                replace
                scroll={false}
                className={`${BUTTON} ${
                  picked
                    ? "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                    : "bg-slate-900 text-white hover:bg-slate-700"
                }`}
              >
                {picked ? "↻ Pick another" : "Pick a company or ETF"}
              </Link>
            </div>

            {/* What the pick is like, without its name. */}
            {picked && (
              <div key={`info-${picked.symbol}`}>
                {tree && (
                  <div className="rise-in mt-4" style={{ animationDelay: "80ms" }}>
                    <HoldingsMap tree={tree} links={false} />
                  </div>
                )}
                {profile && (
                  <CompanyAbout
                    name="???"
                    profile={{
                      ...profile,
                      website: null,
                      description: profile.description && hideName(profile.description, picked.name, picked.symbol),
                    }}
                  />
                )}
              </div>
            )}
          </Step>

          {picked && (
            <Step n={2} title="Timeframe" delay={40}>
              <ul className="mt-3 flex flex-wrap gap-2">
                {offered.map((t) => {
                  const chosen = t.key === timeframe?.key;
                  return (
                    <li key={t.key}>
                      <Link
                        href={sandboxHref({ symbol: picked.symbol, seed, range: t.key, amount })}
                        replace
                        scroll={false}
                        aria-current={chosen ? "true" : undefined}
                        className={chipClass(chosen)}
                      >
                        {t.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-sm text-slate-500">
                {timeframe
                  ? `Day 1 – Day ${timeframe.days} loaded, from a random point in its history.`
                  : "Choose how long the test runs."}
                {offered.length < TIMEFRAMES.length &&
                  ` Longer timeframes need more than its ${available.toLocaleString("en-CA")} days of prices.`}
              </p>
            </Step>
          )}

          {ready && (
            <Step n={3} title="Starting amount" delay={80}>
              <ul className="mt-3 flex flex-wrap gap-2">
                {AMOUNTS.map((a) => (
                  <li key={a}>
                    <Link
                      href={sandboxHref({ symbol: picked.symbol, seed, range: timeframe.key, amount: a })}
                      replace
                      scroll={false}
                      aria-current={a === start ? "true" : undefined}
                      className={chipClass(a === start)}
                    >
                      {cad.format(a)} CAD
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-slate-500">
                {start ? `You'll start the test with ${cad.format(start)} CAD.` : "Choose how much to start with."}
              </p>
            </Step>
          )}

          {picked && (
            <Step n={4} title="Testing ground" delay={120}>
              {ready && start ? (
                // Changing any choice starts the test over.
                <SandboxTest
                  key={`${picked.symbol}-${from}-${timeframe.key}-${start}`}
                  symbol={picked.symbol}
                  from={from}
                  days={timeframe.days}
                  amount={start}
                />
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Choose a timeframe and a starting amount above to begin.
                </p>
              )}
            </Step>
          )}
        </div>
      </div>
    </main>
  );
}
