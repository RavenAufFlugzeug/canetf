import Link from "next/link";
import CompanyPicker from "@/components/CompanyPicker";
import EtfBreakdown from "@/components/EtfBreakdown";
import HoldingsMap from "@/components/HoldingsMap";
import KeyStats from "@/components/KeyStats";
import MapDetail from "@/components/MapDetail";
import Navbar from "@/components/Navbar";
import PriceChart from "@/components/PriceChart";
import { getCompany, getEtfBreakdown, getEtfTree, getKeyStats, getPriceHistory } from "@/lib/db";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The ETF on display is whichever ?symbol= the picker last chose.
  const { symbol, detail } = await searchParams;
  const chosen = typeof symbol === "string" && symbol ? symbol : null;
  const etf = chosen ? await getCompany(chosen) : null;
  const tree = etf ? await getEtfTree(etf.symbol) : null;

  // Clicking a product on the map puts it in ?detail=, and its chart, key figures and
  // (for a fund) composition are shown under the map, as on the Search page.
  const picked = tree && typeof detail === "string" && detail ? await getCompany(detail) : null;
  const history = picked ? await getPriceHistory(picked.symbol) : null;
  const stats = picked ? await getKeyStats(picked.symbol) : null;
  const breakdown = picked ? await getEtfBreakdown(picked.symbol) : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          {/* Back to the Search page, showing the ETF that is on the map (if any). */}
          <Link
            href={etf ? `/search?symbol=${encodeURIComponent(etf.symbol)}` : "/search"}
            className="group mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-900 transition duration-300 ease-out hover:border-slate-300 hover:bg-white hover:shadow-md hover:shadow-slate-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:shadow-sm"
          >
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3 text-slate-500 transition duration-300 ease-out group-hover:text-slate-900 motion-safe:group-hover:-translate-x-0.5"
            >
              <path d="M7.5 2.5 4 6l3.5 3.5" />
            </svg>
            Back to Search
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Holdings Map</h1>
          <p className="mt-1 text-slate-600">
            Explore an ETF&rsquo;s underlying holdings, level by level.
          </p>
          <div className="max-w-xl">
            <CompanyPicker
              key={`picker-${etf?.symbol}`}
              selected={etf?.symbol ?? null}
              label="Enter an ETF's symbol"
              hideLabel
              placeholder="e.g. XEQT.TO"
              etfsOnly
            />
          </div>

          {etf && tree ? (
            // Keyed by symbol, so each newly chosen ETF plays its entrance.
            <div key={`map-${etf.symbol}`} className="mt-6 border-t border-slate-200 pt-6">
              <p className="rise-in text-lg font-semibold text-slate-900">
                {etf.name ?? etf.symbol} <span className="font-normal text-slate-500">{etf.symbol}</span>
              </p>
              <div className="rise-in mt-2" style={{ animationDelay: "80ms" }}>
                <HoldingsMap tree={tree} detail={picked?.symbol ?? null} />
              </div>

              {picked && history && (
                // Keyed by symbol, so each newly clicked product plays its entrance.
                <MapDetail
                  key={`detail-${picked.symbol}`}
                  name={picked.name ?? picked.symbol}
                  symbol={picked.symbol}
                  closeHref={`/map?symbol=${encodeURIComponent(etf.symbol)}`}
                >
                  <div className="rise-in" style={{ animationDelay: "80ms" }}>
                    <PriceChart history={history} currency={picked.currency} />
                  </div>
                  {stats && <KeyStats stats={stats} currency={picked.currency} />}
                  {breakdown && (
                    <div className="rise-in" style={{ animationDelay: "400ms" }}>
                      <EtfBreakdown breakdown={breakdown} />
                    </div>
                  )}
                </MapDetail>
              )}
            </div>
          ) : (
            <p className="rise-in mt-4 text-slate-600">
              {!chosen
                ? "Enter an ETF's symbol to map everything inside it."
                : etf
                  ? `${etf.symbol} has no composition to map: it is a company, or an ETF with no holdings list.`
                  : `No ETF with the symbol ${chosen.toUpperCase()} in our database.`}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
