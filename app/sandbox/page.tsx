import Link from "next/link";
import CompanyPicker from "@/components/CompanyPicker";
import Navbar from "@/components/Navbar";
import PriceChart from "@/components/PriceChart";
import SandboxMark from "@/components/SandboxMark";
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
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-2xl px-6 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          {/* The mark sits on the heading's baseline, about as tall as its capitals. */}
          <div className="flex items-baseline gap-2.5">
            <SandboxMark className="size-[20px] text-slate-900" popIn />
            <h1 className="text-2xl font-bold text-slate-900">Sandbox</h1>
          </div>
          <p className="mt-1 text-slate-600">
            A workspace for testing your ideas, forecasts and expectations against real market
            data. Start by choosing a company or ETF, by searching for it or from your watch list.
          </p>

          <CompanyPicker key={`picker-${company?.symbol}`} selected={company?.symbol ?? null} hideLabel />

          {/* The watch list as chips: choosing one shows it below, like the picker does. */}
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From your watch list</p>
            {!user ? (
              <Prompt
                icon={<KeyIcon />}
                text="Log in to choose from the companies and ETFs on your watch list."
                href="/login?next=/sandbox"
                action="Log in"
              />
            ) : watched.length === 0 ? (
              <Prompt
                icon={
                  // An eye: the watch list.
                  <BadgeIcon>
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="3" />
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

// The watch list section's message when there are no chips to show (signed out, or an
// empty watch list): an icon, a line of text and a button. The panel rises in; pointing at
// it brightens its border and stirs the icon (each icon below says how), and the button
// lifts with its arrow sliding forward, like the Search page's map button.
function Prompt({
  icon,
  text,
  href,
  action,
}: {
  icon: React.ReactNode;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div
      className="rise-in group/prompt mt-2 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition duration-300 ease-out hover:border-slate-300 hover:bg-white hover:shadow-sm"
      style={{ animationDelay: "120ms" }}
    >
      {icon}
      <p className="min-w-0 flex-1 text-sm text-slate-600">{text}</p>
      <Link
        href={href}
        className="group/button inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-300 ease-out hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:translate-y-0 active:shadow-sm motion-safe:hover:-translate-y-0.5"
      >
        {action}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 transition-transform duration-300 ease-out motion-safe:group-hover/button:translate-x-1"
        >
          <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
        </svg>
      </Link>
    </div>
  );
}

// A line icon in a round white badge (the empty watch list's eye); it darkens and lifts
// a touch when its panel is pointed at.
function BadgeIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition duration-300 ease-out group-hover/prompt:text-slate-900 group-hover/prompt:ring-slate-300 motion-safe:group-hover/prompt:-translate-y-0.5 motion-safe:group-hover/prompt:scale-105">
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
        {children}
      </svg>
    </span>
  );
}

// The login prompt's icon: a solid dark key, all sharp edges to match the page's triangle
// mark. Its bow is a diamond with a smaller diamond cut through it; its shaft is a straight
// bar with a square end, and its two teeth are rectangles. When its panel is pointed at, it
// gives a small turn, as if unlocking.
function KeyIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-9 shrink-0 fill-slate-900 transition-transform duration-500 ease-out motion-safe:group-hover/prompt:-rotate-[20deg]"
    >
      {/* The bow: a diamond, with a smaller diamond cut out of its middle. */}
      <path fillRule="evenodd" d="M0.6 12 6.2 6.4l5.6 5.6-5.6 5.6L0.6 12Zm3.5 0 2.1-2.1 2.1 2.1-2.1 2.1L4.1 12Z" />
      {/* The shaft, a straight bar with a square end, and two rectangular teeth. */}
      <path d="M10.8 10.7h12.6v2.6H10.8Z" />
      <path d="M16.6 13.3h2v3h-2Z" />
      <path d="M20.6 13.3h2.8v3.6h-2.8Z" />
    </svg>
  );
}
