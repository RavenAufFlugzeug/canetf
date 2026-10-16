import Link from "next/link";
import CompanyPicker from "@/components/CompanyPicker";
import EtfBreakdown from "@/components/EtfBreakdown";
import KeyStats from "@/components/KeyStats";
import Navbar from "@/components/Navbar";
import PriceChart from "@/components/PriceChart";
import { getCompany, getEtfBreakdown, getExchange, getKeyStats, getPriceHistory } from "@/lib/db";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The company on display is whichever ?symbol= the picker last chose.
  const { symbol } = await searchParams;
  const company = typeof symbol === "string" && symbol ? await getCompany(symbol) : null;
  const history = company ? await getPriceHistory(company.symbol) : null;
  const stats = company ? await getKeyStats(company.symbol) : null;
  const exchange = company ? await getExchange(company.symbol) : null;
  const breakdown = company ? await getEtfBreakdown(company.symbol) : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-2xl px-6 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Search</h1>
          <CompanyPicker
            key={`picker-${company?.symbol}`}
            selected={company?.symbol ?? null}
            hideLabel
          />

          {company && history ? (
            // Keyed by symbol, so each newly chosen company plays its entrance.
            <div key={`company-${company.symbol}`} className="mt-6 border-t border-slate-200 pt-6">
              <p className="rise-in text-lg font-semibold text-slate-900">
                {/* Name, then the ticker on its own line, so a long name never splits them. */}
                {company.name ?? company.symbol}
                <span className="block text-base font-normal text-slate-500">{company.symbol}</span>
              </p>
              <div className="rise-in" style={{ animationDelay: "80ms" }}>
                <PriceChart history={history} currency={company.currency} exchange={exchange} />
              </div>
              {stats && <KeyStats stats={stats} currency={company.currency} />}
              {breakdown && (
                <div className="rise-in" style={{ animationDelay: "400ms" }}>
                  <EtfBreakdown breakdown={breakdown} />
                  <div className="mt-8 flex justify-center">
                    <Link
                      href={`/map?symbol=${encodeURIComponent(company.symbol)}`}
                      // On hover the button lifts and gains a shadow, and the map icon tilts.
                      className="group inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 transition duration-300 ease-out hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:translate-y-0 active:shadow-sm motion-safe:hover:-translate-y-0.5"
                    >
                      View full holdings of {company.symbol}
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4 shrink-0 text-slate-500 transition duration-300 ease-out group-hover:text-slate-900 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-110"
                      >
                        <path d="M9 4 3.5 6.5v13L9 17l6 3 5.5-2.5v-13L15 7 9 4Z" />
                        <path d="M9 4v13M15 7v13" />
                      </svg>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="rise-in mt-4 text-slate-600">
              {typeof symbol === "string" && symbol
                ? `No company with the symbol ${symbol.toUpperCase()} in our database.`
                : "Enter a symbol to see the company's price chart and key figures."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
