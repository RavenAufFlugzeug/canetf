import Link from "next/link";
import Prompt from "@/components/Prompt";
import SearchBox from "@/components/SearchBox";
import PriceChart from "@/components/PriceChart";
import WatchMark from "@/components/WatchMark";
import { getAppDb } from "@/lib/appDb";
import { getCompanies, getCompany, getExchange, getPriceHistory } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

// A place to try things out. For now: pick a company or ETF, by searching for it or from
// your watch list, and see its price chart (the same one as the Search page).
export default async function SandboxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The company on display is whichever ?symbol= was last chosen (by the picker or a chip).
  const { symbol } = await searchParams;
  const company = typeof symbol === "string" && symbol ? await getCompany(symbol) : null;
  const history = company ? await getPriceHistory(company.symbol) : null;
  const exchange = company ? await getExchange(company.symbol) : null;

  // The signed-in user's watch list, in the order it was built, for the chips.
  const user = await getCurrentUser();
  const watched = user
    ? (getAppDb()
        .prepare("SELECT symbol FROM watchlist WHERE user_id = ? ORDER BY added_at")
        .all(user.id) as { symbol: string }[])
    : [];
  const names = new Map(
    ((await getCompanies(watched.map((w) => w.symbol))) ?? []).map((c) => [c.symbol, c.name]),
  );

  return (
    <main className="flex-1 bg-slate-50">
      <section className="mx-auto max-w-2xl px-6 pt-10 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Sandbox</h1>
          <p className="mt-1 text-slate-600">
            A workspace for testing your ideas, forecasts and expectations against real market
            data. Start by choosing a company or ETF, by searching for it or from your watch list.
          </p>

          {/* Find a company or ETF by its ticker or by (part of) its name, with a switch. */}
          <SearchBox symbol={company?.symbol ?? null} name={company?.name ?? null} />

          {/* The watch list as chips: choosing one shows it below, like the picker does. */}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From your watch list</p>
            {!user ? (
              <Prompt
                text="Log in to choose from the companies and ETFs on your watch list."
                href="/login?next=/sandbox"
                action="Log in"
              />
            ) : watched.length === 0 ? (
              <Prompt
                icon={
                  // The Watch List's own mark, the book and pen.
                  <BadgeIcon>
                    <WatchMark id="watch-mark-sandbox" className="size-4.5" />
                  </BadgeIcon>
                }
                text="Your watch list is empty. Add companies and ETFs to it, and they will appear here."
                href="/watchlist"
                action="Go to Watch List"
              />
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {watched.map(({ symbol: s }, i) => {
                  const chosen = s === company?.symbol;
                  return (
                    // The chips rise in one after another.
                    <li key={s} className="rise-in" style={{ animationDelay: `${60 + i * 45}ms` }}>
                      <Link
                        href={`/sandbox?symbol=${encodeURIComponent(s)}`}
                        replace
                        scroll={false}
                        title={names.get(s) ?? s}
                        aria-current={chosen ? "true" : undefined}
                        // The chosen one is dark; the others lift a touch when pointed at.
                        className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                          chosen
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm motion-safe:hover:-translate-y-0.5"
                        }`}
                      >
                        {s}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {company && history ? (
            // Keyed by symbol, so each newly chosen company plays its entrance.
            <div key={`company-${company.symbol}`} className="mt-6 border-t border-slate-200 pt-6">
              <p className="rise-in text-lg font-semibold text-slate-900">
                {company.name ?? company.symbol}
                <span className="block text-base font-normal text-slate-500">{company.symbol}</span>
              </p>
              <div className="rise-in" style={{ animationDelay: "80ms" }}>
                <PriceChart history={history} currency={company.currency} exchange={exchange} />
              </div>
            </div>
          ) : (
            typeof symbol === "string" &&
            symbol && (
              <p className="rise-in mt-6 border-t border-slate-200 pt-6 text-slate-600">
                No company with the symbol {symbol.toUpperCase()} in our database.
              </p>
            )
          )}
        </div>
      </section>
    </main>
  );
}


// An icon in a round white badge (the empty watch list's book and pen); it darkens and
// lifts a touch when its panel is pointed at.
function BadgeIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition duration-300 ease-out group-hover/prompt:text-slate-900 group-hover/prompt:ring-slate-300 motion-safe:group-hover/prompt:-translate-y-0.5 motion-safe:group-hover/prompt:scale-105">
      {children}
    </span>
  );
}
