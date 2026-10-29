import ChoiceChips from "@/components/ChoiceChips";
import PickButton from "@/components/PickButton";
import { type PickCard } from "@/components/PickCards";
import PickOverview from "@/components/PickOverview";
import { AliasProvider } from "@/components/SandboxAliases";
import { SetupArea, StageProvider } from "@/components/SandboxStage";
import { SandboxSwapProvider, Swap } from "@/components/SandboxSwap";
import SandboxTest from "@/components/SandboxTest";
import { getCompanyProfile, pickSandboxSet } from "@/lib/db";
import { hideName } from "@/lib/hideName";
import { markOn, naicsOf } from "@/lib/naics";
import {
  AMOUNTS,
  COUNTS,
  DEFAULT_AMOUNT,
  DEFAULT_COUNT,
  DEFAULT_RANGE,
  kindOf,
  pickNames,
  sandboxHref,
  SEEDS,
  TIMEFRAMES,
} from "@/lib/sandbox";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

// One step of the Sandbox, numbered and titled, with a rule above it. Its entrance gives it
// a layer of its own, which the steps after it would cover; so while it is pointed at (or
// tabbed into) it is lifted above them, and a hover card that drops below it stays on top of
// the next step's choices.
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

// A place to try things out, in five steps. 1: a starting amount, 2: a timeframe and 3: how
// many companies and ETFs to test with (4, 12 or 24), each an ordinary link (the choices live
// in the address). 4: a random set of that many, all trading through the same stretch of time
// (from the seed in the address: pickSandboxSet), shown without their names, each named by its
// kind instead ("TechCompany (1)"), which the player can give aliases; pointing at one shows
// its general figures today. 5: the testing ground, trading them day by day
// (SandboxTest), while which the set-up (steps 1 to 4 and the picks) folds away. A new set, or
// a new timeframe or number, fades the set and the test below it
// out and the new ones in; a new amount, only the test.
export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const timeframe =
    TIMEFRAMES.find((t) => t.key === params.range) ?? TIMEFRAMES.find((t) => t.key === DEFAULT_RANGE)!;
  const amount = AMOUNTS.find((a) => String(a) === params.amount) ?? DEFAULT_AMOUNT;
  const count = COUNTS.find((c) => String(c) === params.count) ?? DEFAULT_COUNT;
  const seed = Number(params.seed);
  const seeded = typeof params.seed === "string" && Number.isInteger(seed) && seed >= 0 && seed < SEEDS;

  // The set, when one has been asked for, with what each listing is like (to show it without
  // its name).
  const set = seeded ? await pickSandboxSet(count, timeframe.days, seed) : null;
  const names = set ? pickNames(set.picks) : [];
  const profiles = set ? await Promise.all(set.picks.map((p) => getCompanyProfile(p.symbol))) : [];

  // The keys of the areas that change with the choices (see SandboxSwap): the set's, which a
  // new set, timeframe or number changes, and the test's, which a new amount changes too.
  // Each pick as the page shows it: its name, kind and sector colour (an ETF's dark, any other
  // grey), its industry and place, what it does with its name hidden, and its figures today.
  const cards: PickCard[] = (set?.picks ?? []).map((p, i) => {
    const profile = profiles[i];
    const naics = naicsOf(p.sector, p.industry);
    const kind = kindOf(p);
    const place = [profile?.hqCity, profile?.hqCountry].filter(Boolean).join(", ");
    const fund = kind === "ETF";
    return {
      symbol: p.symbol,
      name: names[i],
      kind,
      color: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
      ink: naics?.ink ?? (fund ? "#ffffff" : "#0f172a"),
      mark: (naics && markOn(naics)) ?? (fund ? "#ffffff" : "#0f172a"),
      line: [p.industry ?? (p.sector ? null : (p.category ?? "ETF")), place].filter(Boolean).join(" · "),
      about: (profile?.description && hideName(profile.description, p.name, p.symbol)) || null,
      sector: naics?.name ?? null,
      currency: p.currency ?? null,
      size: profile?.marketCap ?? null,
      figures:
        fund || !profile
          ? null
          : {
              revenue: profile.revenue,
              totalAssets: profile.totalAssets,
              totalLiabilities: profile.totalLiabilities,
              employees: profile.employees,
              currency: profile.financialCurrency,
              balanceDate: profile.balanceDate,
            },
    };
  });

  const setKey = seeded ? `set-${count}-${timeframe.key}-${seed}` : `empty-${count}-${timeframe.key}`;
  const testKey = `${setKey}-${amount}`;
  const choices = { range: timeframe.key, amount, count };

  return (
    <main className="flex-1 bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-12">
        <SandboxSwapProvider>
          <StageProvider>
            <div className="rounded-2xl bg-white p-8 shadow">
              <h1 className="text-2xl font-bold text-slate-900">Sandbox</h1>
              <p className="mt-1 text-slate-600">
                A workspace for testing your ideas, forecasts and expectations against real market data: trade
                a mystery set of companies and ETFs day by day, all through the same stretch of time, and see
                how you do.
              </p>

              {/* The set-up: folded away while the test is under way (SetupArea). */}
              <SetupArea>
                <Step n={1} title="Starting amount">
                  <ChoiceChips
                    label="Starting amount"
                    swaps={testKey}
                    chosen={String(amount)}
                    choices={AMOUNTS.map((a) => ({
                      key: String(a),
                      label: `${cad.format(a)} CAD`,
                      href: sandboxHref({ ...choices, amount: a, seed: seeded ? seed : undefined }),
                    }))}
                  />
                </Step>

                <Step n={2} title="Timeframe" delay={40}>
                  <ChoiceChips
                    label="Timeframe"
                    swaps={setKey}
                    chosen={timeframe.key}
                    choices={TIMEFRAMES.map((t) => ({
                      key: t.key,
                      label: t.label,
                      href: sandboxHref({ ...choices, range: t.key, seed: seeded ? seed : undefined }),
                    }))}
                  />
                  <p key={timeframe.key} className="text-fade-in mt-2 text-sm text-slate-500">
                    Day 1 – Day {timeframe.days}, from a random point in time.
                  </p>
                </Step>

                <Step n={3} title="How many" delay={80}>
                  <ChoiceChips
                    label="How many companies and ETFs"
                    swaps={setKey}
                    chosen={String(count)}
                    choices={COUNTS.map((c) => ({
                      key: String(c),
                      label: `${c} companies`,
                      href: sandboxHref({ ...choices, count: c, seed: seeded ? seed : undefined }),
                    }))}
                  />
                  <p key={count} className="text-fade-in mt-2 text-sm text-slate-500">
                    {count} companies and ETFs, picked at random, all trading through the same{" "}
                    {timeframe.label}.
                  </p>
                </Step>

                <Step n={4} title="Your picks" delay={120} id="sandbox-picks">
                  <div className="rise-in mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                    <p className="min-w-0 text-sm text-slate-600">
                      {set
                        ? `${count} picked from the same stretch of time. Their names stay hidden.`
                        : seeded
                          ? `There aren't ${count} listings trading through a stretch of ${timeframe.label}. Try fewer, or a shorter timeframe.`
                          : `Pick ${count} random companies and ETFs to test with. Their names stay hidden.`}
                    </p>
                    <PickButton current={set ? setKey : undefined} {...choices} />
                  </div>
                </Step>
              </SetupArea>

              {/* Everything below the picking, which changes smoothly with the set (Swap); the
                aliases given its picks are the set's own (AliasProvider). */}
              <Swap swapKey={setKey}>
                {set && (
                  <AliasProvider key={setKey} setKey={setKey}>
                    <SetupArea>
                      {/* What the set is made of, then the picks themselves, folded away. */}
                      <PickOverview cards={cards} />
                    </SetupArea>

                    <Step n={5} title="Testing ground" delay={200}>
                      {/* A new amount starts the test over, smoothly (Swap). */}
                      <Swap swapKey={testKey}>
                        <SandboxTest
                          key={testKey}
                          picks={cards.map((c, i) => ({ ...c, from: set.picks[i].from }))}
                          days={timeframe.days}
                          amount={amount}
                          setKey={setKey}
                          choices={choices}
                        />
                      </Swap>
                    </Step>
                  </AliasProvider>
                )}
              </Swap>
            </div>
          </StageProvider>
        </SandboxSwapProvider>
      </div>
    </main>
  );
}
