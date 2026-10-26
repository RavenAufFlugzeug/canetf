import { redirect } from "next/navigation";
import ChoiceChips from "@/components/ChoiceChips";
import CompanyAbout from "@/components/CompanyAbout";
import HoldingsMap from "@/components/HoldingsMap";
import PickButton from "@/components/PickButton";
import { SandboxSwapProvider, Swap } from "@/components/SandboxSwap";
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
import {
  AMOUNTS,
  DEFAULT_AMOUNT,
  DEFAULT_RANGE,
  newSeed,
  otherSeed,
  sandboxHref,
  SEEDS,
  SHORTEST,
  TIMEFRAMES,
} from "@/lib/sandbox";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

// One step of the Sandbox, numbered and titled, with a rule above it. Its entrance gives it
// a layer of its own, which the steps after it would cover; so while it is pointed at (or
// tabbed into) it is lifted above them, and a hover card that drops below it (the About
// section's) stays on top of the next step's choices.
function Step({
  n,
  title,
  delay = 0,
  id,
  children,
}: {
  n: number;
  title: string;
  delay?: number;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rise-in relative mt-6 scroll-mt-24 border-t border-slate-200 pt-6 focus-within:z-10 hover:z-10"
      style={{ animationDelay: `${delay}ms` }}
    >
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
// trading it day by day (SandboxTest). Once there is a pick, all four show at once: the
// timeframe and amount start at their defaults (7 days and $500), so the test can start
// straight away, and either can be changed first.
export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const asked = TIMEFRAMES.find((t) => t.key === params.range) ?? null;
  const start = AMOUNTS.find((a) => String(a) === params.amount) ?? DEFAULT_AMOUNT;
  const amount = start;

  // A new pick asked for by address (the page's own button asks the server for one instead,
  // and goes straight to it), with a seed of its own. It's kept in the address so a refresh
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
  const timeframe =
    offered.find((t) => t.key === asked?.key) ??
    offered.find((t) => t.key === DEFAULT_RANGE) ??
    offered[offered.length - 1] ??
    null;

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
  // The pick shown, for the area below it to change with.
  const pickKey = picked?.symbol;
  // The test's choices, for the testing ground to change with: every new timeframe, amount
  // or Day 1 (seed) makes a new one.
  const testKey = `test-${timeframe?.key ?? "none"}-${start}-${seed}`;
  // Trying the pick again: the same pick, timeframe and amount, but a different Day 1.
  const againHref =
    picked && timeframe
      ? sandboxHref({
          symbol: picked.symbol,
          seed: otherSeed(seed, available - timeframe.days + 1),
          range: timeframe.key,
          amount: start,
        })
      : "/sandbox";
  // Below the pick, everything rises in top to bottom: the map, then the About section's
  // rows one after another, then the steps after.
  const aboutDelay = tree ? 120 : 40;
  const stepsDelay = profile ? aboutDelay + 300 : tree ? 160 : 40;

  return (
    <main className="flex-1 bg-slate-50">
      {/* One width for every pick, company or ETF, so the page doesn't jump between them:
          wide enough for three levels of an ETF's map (deeper ones scroll sideways). */}
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-12">
        <SandboxSwapProvider>
          <div className="rounded-2xl bg-white p-8 shadow">
            <h1 className="text-2xl font-bold text-slate-900">Sandbox</h1>
            <p className="mt-1 text-slate-600">
              A workspace for testing your ideas, forecasts and expectations against real market data: trade a
              mystery company or ETF day by day, and see how you do.
            </p>

            <Step n={1} title="Company or ETF">
              {/* It stays in place as picks change; only what is below it is new each time. */}
              <div className="rise-in mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                <div className="min-w-0">
                  {picked ? (
                    <>
                      <p className="font-semibold text-slate-900">{kind} ??? selected</p>
                      <p className="text-sm text-slate-500">
                        Its name stays hidden. {available.toLocaleString("en-CA")} trading days of prices on
                        record.
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
                <PickButton current={pickKey} range={timeframe?.key ?? asked?.key} amount={amount} />
              </div>
            </Step>

            {/* Everything below the pick, which changes smoothly with it (Swap). */}
            <Swap swapKey={pickKey ?? "none"}>
              {/* What the pick is like, without its name; lifted over the next step while pointed
              at, like a step, so the About section's hover cards stay on top. */}
              {picked && (
                <div className="relative focus-within:z-10 hover:z-10">
                  {tree && (
                    <div className="rise-in mt-4">
                      <HoldingsMap tree={tree} links={false} />
                    </div>
                  )}
                  {profile && (
                    <CompanyAbout
                      name="???"
                      delay={aboutDelay}
                      stagger={25}
                      profile={{
                        ...profile,
                        website: null,
                        description:
                          profile.description && hideName(profile.description, picked.name, picked.symbol),
                      }}
                    />
                  )}
                </div>
              )}

              {picked && (
                <Step n={2} title="Timeframe" delay={stepsDelay} id="sandbox-timeframe">
                  <ChoiceChips
                    label="Timeframe"
                    swaps={testKey}
                    chosen={timeframe?.key}
                    choices={offered.map((t) => ({
                      key: t.key,
                      label: t.label,
                      href: sandboxHref({ symbol: picked.symbol, seed, range: t.key, amount }),
                    }))}
                  />
                  <p key={timeframe?.key ?? "none"} className="text-fade-in mt-2 text-sm text-slate-500">
                    {timeframe
                      ? `Day 1 – Day ${timeframe.days} loaded, from a random point in its history.`
                      : "Choose how long the test runs."}
                    {offered.length < TIMEFRAMES.length &&
                      ` Longer timeframes need more than its ${available.toLocaleString("en-CA")} days of prices.`}
                  </p>
                </Step>
              )}

              {ready && (
                <Step n={3} title="Starting amount" delay={stepsDelay + 40}>
                  <ChoiceChips
                    label="Starting amount"
                    swaps={testKey}
                    chosen={String(start)}
                    choices={AMOUNTS.map((a) => ({
                      key: String(a),
                      label: `${cad.format(a)} CAD`,
                      href: sandboxHref({ symbol: picked.symbol, seed, range: timeframe.key, amount: a }),
                    }))}
                  />
                  <p key={start} className="text-fade-in mt-2 text-sm text-slate-500">
                    You&apos;ll start the test with {cad.format(start)} CAD.
                  </p>
                </Step>
              )}

              {picked && (
                <Step n={4} title="Testing ground" delay={stepsDelay + 80}>
                  {/* Changing any choice starts the test over, smoothly (Swap). */}
                  <Swap swapKey={testKey}>
                    {ready ? (
                      <SandboxTest
                        key={`${picked.symbol}-${from}-${timeframe.key}-${start}`}
                        symbol={picked.symbol}
                        from={from}
                        days={timeframe.days}
                        amount={start}
                        pickKey={picked.symbol}
                        testKey={testKey}
                        againHref={againHref}
                      />
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        This pick&apos;s prices couldn&apos;t be loaded. Pick another.
                      </p>
                    )}
                  </Swap>
                </Step>
              )}
            </Swap>
          </div>
        </SandboxSwapProvider>
      </div>
    </main>
  );
}
