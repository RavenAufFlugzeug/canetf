import ChoiceChips from "@/components/ChoiceChips";
import FadeText from "@/components/FadeText";
import PickButton from "@/components/PickButton";
import { type PickCard } from "@/components/PickCards";
import PickOverview from "@/components/PickOverview";
import SandboxChooser from "@/components/SandboxChooser";
import SandboxStart from "@/components/SandboxStart";
import { getChooserPreview } from "@/app/actions/sandbox";
import { SandboxOpen } from "@/components/SandboxOpen";
import { AliasProvider } from "@/components/SandboxAliases";
import { SetupArea, StageProvider } from "@/components/SandboxStage";
import { SandboxSwapProvider, Swap } from "@/components/SandboxSwap";
import SandboxTest from "@/components/SandboxTest";
import { listingOf } from "@/lib/exchanges";
import {
  getCompanyProfile,
  getEtfTree,
  getLatestCadRate,
  majorOf,
  getTradableFrom,
  pickChosenSet,
  pickSandboxSet,
  type EtfTreeNode,
} from "@/lib/db";
import { KINDS } from "@/lib/kinds";
import { hideName } from "@/lib/hideName";
import { markOn, naicsOf } from "@/lib/naics";
import {
  AMOUNTS,
  COUNTS,
  DEFAULT_AMOUNT,
  DEFAULT_COUNT,
  DEFAULT_MONTHLY,
  DEFAULT_RANGE,
  kindOf,
  MONTHLY,
  MONTHLY_AFTER,
  MOST_CHOSEN,
  pickNames,
  sandboxHref,
  SEEDS,
  TIMEFRAMES,
} from "@/lib/sandbox";
import Page from "@/components/Page";
import { CARD, LABEL, PAGE_TITLE, SECTION_TITLE } from "@/lib/ui";

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
      <h2 className={`flex items-center gap-2.5 ${SECTION_TITLE}`}>
        <span className="grid size-6 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

// A place to try things out, Random or Custom (a switch at the top; switching swaps all below
// it). Random, in five steps. 1: a timeframe, 2: the capital (what the test starts with, and
// what is added each month, which counts only in a test longer than three months) and 3: how
// many companies and ETFs to test with (4, 12 or 24), each an ordinary link (the choices live
// in the address). 4: a random set of that many, all trading through the same stretch of time
// (from the seed in the address: pickSandboxSet), shown without their names, each named by its
// kind instead ("TechCompany (1)"), which the player can give aliases; pointing at one shows its
// general figures today. 5: the testing ground, trading them day by day (SandboxTest), while
// which the set-up (the steps and the picks) folds away. A new set, or a new timeframe or
// number, fades the set and the test below it out and the new ones in; new capital, only the
// test. Custom, in four: 1: the companies and ETFs, chosen by hand (SandboxChooser), 2: the day
// the test starts and how long it runs (one not listed yet that day joins when it is, with a
// note saying so; at least one must be), 3: the capital, and 4: the testing ground, where
// nothing is hidden (SandboxOpen).
// How many trading days every listing in a set has from its start: the longest timeframe's,
// so a set suits every timeframe.
const SET_DAYS = Math.max(...TIMEFRAMES.map((t) => t.days));

export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const timeframe =
    TIMEFRAMES.find((t) => t.key === params.range) ?? TIMEFRAMES.find((t) => t.key === DEFAULT_RANGE)!;
  const amount = AMOUNTS.find((a) => String(a) === params.amount) ?? DEFAULT_AMOUNT;
  // What is added each month: kept as chosen (in the address) whatever the timeframe, but only
  // added in a test longer than three months.
  const monthlyOn = timeframe.days > MONTHLY_AFTER;
  const monthlyChosen = MONTHLY.find((m) => String(m) === params.monthly) ?? DEFAULT_MONTHLY;
  const monthly = monthlyOn ? monthlyChosen : 0;
  const count = COUNTS.find((c) => String(c) === params.count) ?? DEFAULT_COUNT;
  const seed = Number(params.seed);
  const seeded = typeof params.seed === "string" && Number.isInteger(seed) && seed >= 0 && seed < SEEDS;
  // Custom: companies and ETFs chosen by hand (at most MOST_CHOSEN, each once) and the day the
  // test starts, rather than a random set at a random time.
  const custom = params.mode === "custom";
  const symbols =
    custom && typeof params.symbols === "string"
      ? [...new Set(params.symbols.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MOST_CHOSEN)
      : [];
  const start =
    custom && typeof params.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.start) ? params.start : null;
  // Those chosen, as their list shows them (with their general info).
  const chosen = (await Promise.all(symbols.map((s) => getChooserPreview(s)))).filter((c) => c !== null);
  // From when each can be traded here (a currency's rate to CAD may begin after its first price).
  const tradable = custom ? await getTradableFrom(symbols) : {};

  // The set, when one has been asked for, with what each listing is like (to show it without
  // its name). Every listing in a random set has the longest timeframe's prices from its start,
  // so the same set serves any timeframe: changing the timeframe (or the amount) keeps it; only
  // a new number of listings (or Reset) picks another. A custom one is the listings chosen from
  // the day chosen (pickChosenSet): one not listed yet then joins when it is; and as they were
  // chosen, their names are shown.
  const customSet = custom && start && symbols.length ? await pickChosenSet(symbols, timeframe.days, start) : null;
  const set = custom
    ? customSet && !customSet.problem
      ? customSet
      : null
    : seeded
      ? await pickSandboxSet(count, SET_DAYS, seed)
      : null;
  const names = set ? (custom ? set.picks.map((p) => p.name ?? p.symbol) : pickNames(set.picks)) : [];
  const profiles = set ? await Promise.all(set.picks.map((p) => getCompanyProfile(p.symbol))) : [];
  // For each fund, a short line on what it holds, without naming it (fundNote).
  const notes = set
    ? await Promise.all(
        set.picks.map(async (p) => (kindOf(p) === "ETF" ? fundNote(await getEtfTree(p.symbol)) : null)),
      )
    : [];
  // Each pick's latest rate to Canadian dollars, so their market values can be compared.
  const toCad = set ? await Promise.all(set.picks.map((p) => getLatestCadRate(p.currency))) : [];

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
    const listing = listingOf(profile?.exchange);
    return {
      symbol: p.symbol,
      name: names[i],
      kind,
      color: naics?.color ?? (fund ? "#1e293b" : "oklch(0.80 0 0)"),
      ink: naics?.ink ?? (fund ? "#ffffff" : "#0f172a"),
      mark: (naics && markOn(naics)) ?? (fund ? "#ffffff" : "#0f172a"),
      line: [p.industry ?? (p.sector ? null : (p.category ?? "ETF")), place].filter(Boolean).join(" · "),
      industry: p.industry ?? (p.sector ? null : (p.category ?? "ETF")),
      // Where it is from: a company's base; a fund, which has none, by where it is listed.
      place: place || (fund && listing ? `${listing.country} · ${listing.exchange}` : null),
      country: profile?.hqCountry ?? (fund ? (listing?.country ?? null) : null),
      note: notes[i] ?? null,
      about: (profile?.description && (custom ? profile.description : hideName(profile.description, p.name, p.symbol))) || null,
      sector: naics?.name ?? null,
      // Prices come in the main unit (pounds, not pence), so the currency is named that way.
      currency: p.currency ? majorOf(p.currency) : null,
      // Its market value in Canadian dollars, to compare with the others'.
      size: profile?.marketCap && toCad[i] ? profile.marketCap * toCad[i] : null,
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

  // The mode's key (switching mode changes all that is below it), the set's and the test's.
  const modeKey = custom ? "mode-custom" : "mode-random";
  const setKey = custom
    ? start && symbols.length
      ? `custom-${symbols.join(",")}-${timeframe.key}-${start}`
      : `custom-none-${symbols.join(",")}`
    : seeded
      ? `set-${count}-${seed}`
      : `empty-${count}`;
  // The test changes with the set, the timeframe and the money.
  const testKey = `${setKey}-${timeframe.key}-${amount}-${monthly}`;
  const choices = custom
    ? { range: timeframe.key, amount, monthly: monthlyChosen, custom, symbols, start: start ?? undefined }
    : { range: timeframe.key, amount, monthly: monthlyChosen, count };
  const keep = custom ? {} : { seed: seeded ? seed : undefined };
  const nameOf = (symbol: string) => chosen.find((c) => c.symbol === symbol)?.name ?? symbol;
  // When one can first be traded, and why not before: not listed yet, or no rate to CAD yet.
  const fromText = (symbol: string) => {
    const t = tradable[symbol];
    if (!t) return "";
    const currency = chosen.find((c) => c.symbol === symbol)?.currency ?? "";
    return `${longDate(t.from)}${t.byRate ? ` (${currency} to CAD rates begin)` : ""}`;
  };
  // What to say of a custom set's start: why there is no set, or what is late or left out.
  const startProblem =
    customSet?.problem === "none"
      ? `${symbols.length === 1 ? "It can't" : "None of these can"} be traded yet on ${longDate(start!)}.\n${symbols
          .filter((s) => tradable[s])
          .map((s) => `${nameOf(s)} is available from ${fromText(s)}.`)
          .join("\n")}`
      : customSet?.problem === "short"
        ? `There aren't ${timeframe.label} of trading after ${longDate(start!)}. Pick an earlier date or a shorter time period.`
        : null;
  const startNotes = [
    ...(set && custom
      ? set.picks.flatMap((p) =>
          p.offset
            ? [
                p.offset >= timeframe.days
                  ? `${nameOf(p.symbol)} is available from ${tradable[p.symbol]?.byRate ? fromText(p.symbol) : longDate(p.from)}, after this test ends.`
                  : tradable[p.symbol]?.byRate
                    ? `${nameOf(p.symbol)} is available from ${fromText(p.symbol)}, Day ${p.offset + 1}.`
                    : `${nameOf(p.symbol)} wasn't listed yet: it can be traded from ${longDate(p.from)} (Day ${p.offset + 1}).`,
              ]
            : [],
        )
      : []),
    ...(customSet?.missing ?? []).map((s) => `${nameOf(s)} doesn't trade through this period, so it's left out.`),
  ];

  // The capital: what the test starts with, and what is added each month (21 trading days);
  // after the time chosen in either mode (whether the monthly part counts depends on it).
  const capital = (n: number, delay: number) => (
    <Step n={n} title="Capital" delay={delay}>
      <p className={`mt-3 ${LABEL}`}>Initial investment</p>
      <ChoiceChips
        label="Initial investment"
        swaps={testKey}
        chosen={String(amount)}
        choices={AMOUNTS.map((a) => ({
          key: String(a),
          label: `${cad.format(a)} CAD`,
          href: sandboxHref({ ...choices, ...keep, amount: a }),
        }))}
      />
      {/* Added only in a test longer than three months: for a shorter one, greyed out (and
          not to be chosen), with a notice saying so. */}
      <p className={`mt-4 ${LABEL} transition-opacity duration-500 ${monthlyOn ? "" : "opacity-50"}`}>
        Monthly contribution
      </p>
      <div
        className={`transition-[opacity,filter] duration-500 ${monthlyOn ? "" : "pointer-events-none opacity-40 grayscale"}`}
        inert={!monthlyOn}
      >
        <ChoiceChips
          label="Monthly contribution"
          swaps={testKey}
          chosen={String(monthlyChosen)}
          choices={MONTHLY.map((m) => ({
            key: String(m),
            label: m ? `${cad.format(m)} CAD` : "None",
            href: sandboxHref({ ...choices, ...keep, monthly: m }),
          }))}
        />
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          monthlyOn ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
        aria-hidden={monthlyOn}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="mt-2 flex items-start gap-2 text-sm text-amber-800">
            <WarnMark />
            Available for tests of 6 months or longer.
          </p>
        </div>
      </div>
    </Step>
  );

  return (
    <Page width="lg">
      <SandboxSwapProvider>
        <StageProvider>
          <div className={CARD}>
            <h1 className={PAGE_TITLE}>Sandbox</h1>
            <p className="mt-1 text-slate-600">
              Test your ideas against real market data.
            </p>

            {/* Random (a set and its time picked for you) or Custom (your own, from a day you
                choose); switching swaps everything below. Folded away while testing. */}
            <SetupArea>
              <ChoiceChips
                label="Random or custom"
                swaps={modeKey}
                chosen={custom ? "custom" : "random"}
                choices={[
                  { key: "random", label: "Random", href: sandboxHref({ range: timeframe.key, amount, monthly: monthlyChosen }) },
                  { key: "custom", label: "Custom", href: sandboxHref({ range: timeframe.key, amount, monthly: monthlyChosen, custom: true }) },
                ]}
              />
            </SetupArea>

            <Swap swapKey={modeKey}>
              {/* The set-up: folded away while the test is under way (SetupArea). */}
              <SetupArea>

                {custom ? (
                  <>
                    <Step n={1} title="Companies & ETFs">
                      <SandboxChooser choices={choices} chosen={chosen} swaps={setKey} />
                    </Step>

                    <Step n={2} title="Time period" delay={40} id="sandbox-picks">
                      <p className={`mt-3 ${LABEL}`}>Start</p>
                      <SandboxStart
                        choices={choices}
                        start={start}
                        ready={symbols.length > 0}
                        swaps={setKey}
                      />
                      <p className={`mt-4 ${LABEL}`}>Length</p>
                      <ChoiceChips
                        label="Length"
                        swaps={setKey}
                        chosen={timeframe.key}
                        choices={TIMEFRAMES.map((t) => ({
                          key: t.key,
                          label: t.label,
                          href: sandboxHref({ ...choices, range: t.key }),
                        }))}
                      />
                      {/* Why there is no set, or what is late or left out (each can still go ahead). */}
                      {(startProblem || startNotes.length > 0) && (
                        <ul key={setKey} className="mt-4 space-y-2">
                          {(startProblem ? [startProblem] : startNotes).map((text, i) => (
                            <li
                              key={text}
                              className={`start-note flex gap-2.5 rounded-lg px-3 py-2 text-sm ${
                                startProblem ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                              }`}
                              style={{ animationDelay: `${i * 60}ms` }}
                            >
                              <WarnMark />
                              {/* (Each line its own: one for each pick it names.) */}
                              <span className="whitespace-pre-line">{text}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Step>

                    {capital(3, 80)}
                  </>
                ) : (
                  <>
                    <Step n={1} title="Timeframe">
                      <ChoiceChips
                        label="Timeframe"
                        swaps={testKey}
                        chosen={timeframe.key}
                        choices={TIMEFRAMES.map((t) => ({
                          key: t.key,
                          label: t.label,
                          href: sandboxHref({ ...choices, ...keep, range: t.key }),
                        }))}
                      />
                    </Step>

                    {capital(2, 40)}

                    <Step n={3} title="Companies & ETFs" delay={80}>
                      <ChoiceChips
                        label="Number of companies and ETFs"
                        swaps={setKey}
                        chosen={String(count)}
                        choices={COUNTS.map((c) => ({
                          key: String(c),
                          label: String(c),
                          href: sandboxHref({ ...choices, ...keep, count: c }),
                        }))}
                      />
                    </Step>

                    <Step n={4} title="Investment universe" delay={120} id="sandbox-picks">
                      {/* The button to generate a set (with, when none could be, why, in a box);
                          once one is shown below, the same button generates another in its place. */}
                      <div
                        className={`rise-in mt-3 flex flex-wrap items-center gap-4 ${
                          seeded && !set ? "justify-between rounded-xl bg-slate-50 p-4" : ""
                        }`}
                      >
                        {/* Only when no set could be picked: why, cross-fading in (FadeText). */}
                        {seeded && !set && (
                          <FadeText
                            className="min-w-0 flex-1 text-sm text-slate-600"
                            text={`There aren't ${count} listings trading through a stretch of ${timeframe.label}. Try fewer, or a shorter timeframe.`}
                          />
                        )}
                        <PickButton
                          current={set ? setKey : undefined}
                          range={timeframe.key}
                          amount={amount}
                          monthly={monthlyChosen}
                          count={count}
                        />
                      </div>
                    </Step>
                  </>
                )}
              </SetupArea>

              {/* Everything below the picking, which changes smoothly with the set (Swap); the
                  aliases given its picks are the set's own (AliasProvider). */}
              <Swap swapKey={setKey}>
                {set && (
                  <AliasProvider key={setKey} setKey={setKey}>
                    {/* Custom, nothing is hidden: the holdings' names, and the dates. */}
                    <SandboxOpen
                      open={custom}
                      entries={set.picks.map((p) => ({ symbol: p.symbol, from: p.from, offset: p.offset }))}
                      days={timeframe.days}
                    >
                      <SetupArea>
                        {/* What the set is made of, then the picks themselves, folded away. */}
                        <PickOverview cards={cards} starts={set.picks.map((p) => p.from)} />
                      </SetupArea>

                      <Step n={custom ? 4 : 5} title="Testing ground" delay={200}>
                        {/* A new amount starts the test over, smoothly (Swap). */}
                        <Swap swapKey={testKey}>
                          <SandboxTest
                            key={testKey}
                            picks={cards.map((c, i) => ({ ...c, from: set.picks[i].from, offset: set.picks[i].offset ?? 0 }))}
                            days={timeframe.days}
                            amount={amount}
                            monthly={monthly}
                            setKey={setKey}
                            choices={choices}
                          />
                        </Swap>
                      </Step>
                    </SandboxOpen>
                  </AliasProvider>
                )}
              </Swap>
            </Swap>
          </div>
        </StageProvider>
      </SandboxSwapProvider>
    </Page>
  );
}

// "Mar 4, 2019".
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

// A warning's mark: a triangle with an exclamation mark.
function WarnMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-0.5 size-4 shrink-0">
      <path strokeLinejoin="round" d="M8 2.2 14.4 13.5H1.6Z" />
      <path strokeLinecap="round" d="M8 6.5v3.2M8 11.6v.1" />
    </svg>
  );
}

// What a fund holds, in a few words, from its holdings (as listed today) and nothing that names
// it: a bond fund's split by credit rating; a fund mostly of other ETFs (an all-in-one); or
// stocks, by where most of their companies are based and, when one sector is a large part, that
// sector ("Stocks, mostly United States · Tech-heavy"). Null when it has no holdings on record.
function fundNote(tree: EtfTreeNode | null): string | null {
  const items = tree?.children.filter((c) => c.kind !== "other") ?? [];
  if (!items.length) return null;
  if (items.some((c) => c.kind === "rating")) return "Bonds, by credit rating";
  const listed = items.reduce((sum, c) => sum + c.weight, 0) || 1;
  const funds = items.filter((c) => c.kind === "fund").reduce((sum, c) => sum + c.weight, 0);
  if (funds / listed > 0.5) return "Holds other ETFs (all-in-one)";
  const top = (key: (c: EtfTreeNode) => string | null) => {
    const by = new Map<string, number>();
    for (const c of items) {
      const k = key(c);
      if (k) by.set(k, (by.get(k) ?? 0) + c.weight);
    }
    const best = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { name: best[0], share: best[1] / listed } : null;
  };
  const country = top((c) => c.details?.hqCountry ?? null);
  const sector = top((c) =>
    c.kind === "holding" && c.details?.sector
      ? (KINDS.find((k) => k.kind === kindOf({ ...c.details!, fundFamily: null, category: null }))?.label ??
        null)
      : null,
  );
  return [
    country ? `Stocks, mostly ${country.name}` : "Stocks",
    sector && sector.share >= 0.35 ? `${sector.name}-heavy` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
