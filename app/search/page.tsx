import Link from "next/link";
import BadgeLegend from "@/components/BadgeLegend";
import CompanyAbout from "@/components/CompanyAbout";
import EtfBreakdown from "@/components/EtfBreakdown";
import FundAbout from "@/components/FundAbout";
import KeyStats from "@/components/KeyStats";
import KindBadge from "@/components/KindBadge";
import MapMark from "@/components/MapMark";
import PriceChart from "@/components/PriceChart";
import RateAbout from "@/components/RateAbout";
import { pairOf } from "@/lib/fx";
import SearchBox from "@/components/SearchBox";
import {
  getCompany,
  getCompanyProfile,
  getEtfBreakdown,
  getExchange,
  getKeyStats,
  getPriceHistory,
} from "@/lib/db";

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
  const profile = company ? await getCompanyProfile(company.symbol) : null;
  // An exchange rate (USDCAD=X) rather than a company or fund.
  const rate = company?.category === "Currency";
  // The same pair the other way round (CADUSD=X for USDCAD=X), when the database has it.
  const pair = rate && company ? pairOf(company.symbol) : null;
  const reverse = pair ? await getCompany(`${pair.quote}${pair.base}=X`) : null;

  return (
    <main className="flex-1 bg-slate-50">
      <section className="mx-auto max-w-2xl px-6 pt-10 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Search</h1>
          {/* Find a company or ETF by its ticker or by (part of) its name, with a switch. */}
          <SearchBox symbol={company?.symbol ?? null} name={company?.name ?? null} />
          {company && history ? (
            // Keyed by symbol, so each newly chosen company plays its entrance.
            <div key={`company-${company.symbol}`} className="mt-6 border-t border-slate-200 pt-6">
              <div className="rise-in flex items-center gap-3">
                {/* Its badge: its sector's colour and its kind's mark. */}
                <KindBadge
                  sector={company.sector}
                  industry={company.industry}
                  fundFamily={company.fundFamily}
                  category={company.category}
                  className="size-10 rounded-xl"
                  markClassName="size-5"
                />
                <p className="text-lg font-semibold text-slate-900">
                  {/* Name, then the ticker on its own line, so a long name never splits them. */}
                  {company.name ?? company.symbol}
                  <span className="block text-base font-normal text-slate-500">{company.symbol}</span>
                </p>
              </div>
              <div className="rise-in" style={{ animationDelay: "80ms" }}>
                <PriceChart history={history} currency={company.currency} exchange={exchange} rate={rate} />
              </div>
              {stats && <KeyStats stats={stats} currency={company.currency} rate={rate} />}
              {/* An exchange rate gets an About section of its own: what each currency buys of
                  the other, how it moved over the year, and an example. */}
              {rate && history.daily.length > 0 && (
                <RateAbout
                  symbol={company.symbol}
                  reverse={reverse?.symbol ?? null}
                  rate={history.daily[history.daily.length - 1].close}
                  yearAgo={history.daily[history.daily.length - 253]?.close ?? null}
                />
              )}
              {/* A company (not a fund) gets an About section: sector, where it is based,
                  size, website and what it does. */}
              {/* A fund gets one of its own: which country it is from (where it is listed, by
                  that country's flag), who runs it and what kind of fund it is. */}
              {profile && !rate && (breakdown || profile.fundFamily) && <FundAbout profile={profile} />}
              {profile && !rate && !breakdown && !profile.fundFamily && (
                <CompanyAbout name={company.name ?? company.symbol} profile={profile} />
              )}
              {breakdown && (
                <div className="rise-in" style={{ animationDelay: "400ms" }}>
                  <EtfBreakdown breakdown={breakdown} />
                  <div className="mt-8 flex justify-center">
                    <Link
                      href={`/map?symbol=${encodeURIComponent(company.symbol)}`}
                      // On hover the button lifts and gains a shadow, and the Holdings Map's mark darkens
                      // and plays its wave of tiles.
                      className="group inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-900 transition duration-300 ease-out hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:translate-y-0 active:shadow-sm motion-safe:hover:-translate-y-0.5"
                    >
                      View full holdings of {company.symbol}
                      <MapMark className="size-4 text-slate-500 transition-colors duration-300 ease-out group-hover:text-slate-900" />
                    </Link>
                  </div>
                </div>
              )}
              {/* What the badge by its name means: its mark, and its colour. */}
              <BadgeLegend
                sector={company.sector}
                industry={company.industry}
                fundFamily={company.fundFamily}
                category={company.category}
                delay={500}
              />
            </div>
          ) : (
            <p className="rise-in mt-4 text-slate-600">
              {typeof symbol === "string" && symbol
                ? `Nothing with the symbol ${symbol.toUpperCase()} in our database.`
                : "Search for a company, ETF or exchange rate by its ticker or name to see its price chart and key figures. For a rate, try USDCAD or “US Dollar”."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
