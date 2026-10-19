import CompanyDescription from "@/components/CompanyDescription";
import CountUp from "@/components/CountUp";
import type { CompanyProfile } from "@/lib/db";
import { naicsOf } from "@/lib/naics";

// A balance sheet's date as written under its figures: "Jun 30, 2026".
const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// How a company's assets are funded, as a bar under its figures: the share owed (its
// liabilities, dark) and the share that is its own (equity, the rest, lighter). The two
// parts grow in from the left one after the other; a part brightens when pointed at. When
// it owes more than it has, the bar is all liabilities and says so.
function BalanceBar({ assets, liabilities }: { assets: number; liabilities: number }) {
  const owed = Math.min(Math.max(liabilities / assets, 0), 1);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <span className="flex w-full flex-col gap-1.5">
      <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <span
          title={`Liabilities: ${pct(owed)} of assets`}
          className="bar-grow h-full bg-slate-700 transition-[filter] hover:brightness-125"
          style={{ width: pct(owed), animationDelay: "650ms" }}
        />
        {owed < 1 && (
          <span
            title={`Equity: ${pct(1 - owed)} of assets`}
            className="bar-grow h-full border-l-2 border-white bg-slate-300 transition-[filter] hover:brightness-90"
            style={{ width: pct(1 - owed), animationDelay: "900ms" }}
          />
        )}
      </span>
      <span className="flex justify-between text-xs font-normal text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-slate-700" />
          Liabilities {pct(owed)}
        </span>
        {liabilities > assets ? (
          <span>Liabilities exceed assets</span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-slate-300" />
            Equity {pct(1 - owed)}
          </span>
        )}
      </span>
    </span>
  );
}

// A value with a small note under it, right-aligned like the rest.
function Noted({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <span className="flex flex-col items-end text-right">
      {children}
      <span className="text-xs font-normal text-slate-500">{note}</span>
    </span>
  );
}

// The Search page's About section for a company (not a fund), below its key figures: its
// sector, as the NAICS group the Holdings Map colours it by (with that colour as a swatch)
// over Yahoo's finer industry; where it is based; its revenue over the last 12 months and
// its total assets and liabilities (from its latest balance sheet), in the currency it
// reports in, with a bar showing how its assets are funded; how many people it employs;
// then its website and a short summary of what it does. Rows the database has nothing for
// are left out, and the section with them when there is nothing at all. The rows rise in
// one after another, like the key figures', and the figures count up as they come into
// view (CountUp). Pointing at a row tints it, pops the sector's swatch and opens a card
// saying where its figure comes from.
export default function CompanyAbout({ name, profile }: { name: string; profile: CompanyProfile }) {
  const naics = naicsOf(profile.sector, profile.industry);
  const place = [profile.hqCity, profile.hqState, profile.hqCountry].filter(Boolean).join(", ");
  const currency = profile.financialCurrency;
  const asOf = profile.balanceDate ? `as of ${day(profile.balanceDate)}` : "latest balance sheet";
  // The website without its scheme, "www." or trailing slash, as it is usually written.
  const site = profile.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  // Where each figure comes from, for the card that pops up when its row is pointed at.
  const balanceSource = `From ${name}'s latest balance sheet on Yahoo Finance${
    profile.balanceDate ? `, for the period ending ${day(profile.balanceDate)}` : ""
  } (its latest quarter, or its latest year when there is no quarterly one)${
    currency ? `, in ${currency}, the currency it reports in` : ""
  }. The pipeline looks for a newer one once a week.`;
  const SOURCES: Record<string, string> = {
    Sector:
      "Yahoo Finance doesn't give NAICS codes, so this is worked out from the industry Yahoo lists for the company (or, failing that, its broader sector), matched to its NAICS Canada 2022 sector group. The Holdings Map colours companies the same way.",
    Industry: "The industry Yahoo Finance classifies the company under, from its company profile.",
    "Based in":
      "Where the company has its headquarters: the city, province or state, and country on its Yahoo Finance profile.",
    Revenue: `${name}'s total revenue over the last 12 months (its last four quarters), from its Yahoo Finance profile${
      currency ? `, in ${currency}, the currency it reports in` : ""
    }. Refreshed about once a day.`,
    "Total assets": balanceSource,
    "Total liabilities": `${balanceSource} Minority interest is not counted.`,
    Employees: "Full-time employees, as listed on the company's Yahoo Finance profile.",
    "Corporate website": `${name}'s official website, as listed on its Yahoo Finance profile. It opens in a new tab.`,
    "Business summary": `The opening of the business summary on ${name}'s Yahoo Finance profile, in whole sentences, shortened to what the company does.`,
    "Funded by": `How ${name}'s assets are paid for: the share owed to others (its total liabilities) and the share that is its own (shareholders' equity, the rest), both from its latest balance sheet on Yahoo Finance${
      profile.balanceDate ? ` (period ending ${day(profile.balanceDate)})` : ""
    }.`,
  };

  // Each row: its label, its value, whether it takes the full width (the sector, whose
  // names run long, so it isn't squeezed into two lines, the balance bar, the website and
  // the summary), and whether its value is prose (the summary), which goes under its label
  // across the full width, left-aligned, rather than beside it.
  const rows: [string, React.ReactNode, boolean?, boolean?][] = [];
  if (naics) {
    rows.push([
      "Sector",
      <Noted key="sector" note={`NAICS ${naics.code.replace("-", "–")}`}>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="about-swatch size-3 shrink-0 rounded-sm"
            style={{ background: naics.color }}
          />
          {naics.name}
        </span>
      </Noted>,
      true,
    ]);
  }
  if (profile.industry) rows.push(["Industry", profile.industry]);
  if (place) rows.push(["Based in", place]);
  if (profile.revenue !== null) {
    rows.push([
      "Revenue",
      <Noted key="revenue" note="last 12 months">
        <CountUp value={profile.revenue} kind="amount" currency={currency} />
      </Noted>,
    ]);
  }
  if (profile.totalAssets !== null) {
    rows.push([
      "Total assets",
      <Noted key="assets" note={asOf}>
        <CountUp value={profile.totalAssets} kind="amount" currency={currency} />
      </Noted>,
    ]);
  }
  if (profile.totalLiabilities !== null) {
    rows.push([
      "Total liabilities",
      <Noted key="liabilities" note={asOf}>
        <CountUp value={profile.totalLiabilities} kind="amount" currency={currency} />
      </Noted>,
    ]);
  }
  if (profile.employees)
    rows.push(["Employees", <CountUp key="employees" value={profile.employees} kind="count" />]);
  if (profile.totalAssets && profile.totalLiabilities !== null && profile.totalAssets > 0) {
    rows.push([
      "Funded by",
      <BalanceBar key="balance" assets={profile.totalAssets} liabilities={profile.totalLiabilities} />,
      true,
    ]);
  }
  if (profile.website && site) {
    rows.push([
      "Corporate website",
      // Its icon, in the line style of the navbar's glass, is a box open at its top right
      // corner with an arrow leaving through the gap; pointed at, the arrow nudges out.
      <a
        key="website"
        href={profile.website}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link inline-flex items-center gap-2 rounded underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0 text-slate-500 transition-colors duration-300 group-hover/link:text-slate-900"
        >
          {/* The box, open at its top right corner. */}
          <path d="M10 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
          {/* The arrow, leaving through the gap. */}
          <path
            d="M14 4h6v6M20 4l-9 9"
            className="transition-transform duration-300 ease-out motion-safe:group-hover/link:translate-x-[1.5px] motion-safe:group-hover/link:-translate-y-[1.5px]"
          />
        </svg>
        {site}
      </a>,
      true,
    ]);
  }
  if (profile.description) {
    rows.push([
      "Business summary",
      <CompanyDescription key="summary" text={profile.description} />,
      true,
      true,
    ]);
  }

  // Which rows sit in the right-hand column of the two-column list: every second one after
  // a full-width row.
  let column = 0;
  const rightColumn = rows.map(([, , wide]) => {
    if (wide) {
      column = 0;
      return false;
    }
    return column++ % 2 === 1;
  });

  if (!rows.length) return null;

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="rise-in text-lg font-semibold text-slate-900" style={{ animationDelay: "380ms" }}>
        About {name}
      </h3>
      {rows.length > 0 && (
        <dl className="mt-4 grid gap-x-8 text-sm sm:grid-cols-2">
          {rows.map(([label, value, wide, prose], i) => {
            const tip = `about-source-${label.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              // Pointing at a row (or tabbing to its label) pops up a card under it saying
              // where its figure comes from; it fades and rises in. The row is lifted above
              // its neighbours meanwhile (each row's entrance animation gives it a layer of
              // its own, which would otherwise cover the card), and a row in the right-hand
              // column opens its card towards the left, so it stays within the page.
              <div
                key={label}
                className={`rise-in group/row relative flex border-b border-slate-200 py-2 transition-colors duration-200 focus-within:z-30 hover:z-30 hover:bg-slate-50 ${prose ? "flex-col gap-1.5" : "items-start justify-between gap-4"} ${wide ? "sm:col-span-2" : ""}`}
                style={{ animationDelay: `${420 + i * 40}ms` }}
              >
                <dt>
                  <span
                    tabIndex={0}
                    aria-describedby={tip}
                    className="cursor-help rounded whitespace-nowrap text-slate-600 underline decoration-slate-300 decoration-dotted underline-offset-4 outline-none group-hover/row:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    {label}
                  </span>
                </dt>
                <dd
                  className={`min-w-0 ${prose ? "text-left" : "text-right font-semibold tabular-nums text-slate-900"} ${wide && !prose ? "max-w-md flex-1" : ""}`}
                >
                  {value}
                </dd>
                <span
                  id={tip}
                  role="tooltip"
                  className={`pointer-events-none absolute top-full z-20 mt-1 w-72 ${rightColumn[i] ? "left-0 sm:right-0 sm:left-auto" : "left-0"} max-w-[85vw] translate-y-1 rounded-lg bg-slate-900 px-3 py-2.5 text-xs leading-relaxed font-normal text-white opacity-0 shadow-lg shadow-slate-900/20 transition duration-200 ease-out group-focus-within/row:translate-y-0 group-focus-within/row:opacity-100 group-hover/row:translate-y-0 group-hover/row:opacity-100`}
                >
                  {SOURCES[label]}
                </span>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
