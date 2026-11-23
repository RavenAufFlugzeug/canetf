import Link from "next/link";
import BadgeInfo from "@/components/BadgeInfo";
import CompanyAbout from "@/components/CompanyAbout";
import EtfBreakdown from "@/components/EtfBreakdown";
import FundAbout from "@/components/FundAbout";
import KeyStats from "@/components/KeyStats";
import KindBadge from "@/components/KindBadge";
import MapMark from "@/components/MapMark";
import PriceChart from "@/components/PriceChart";
import RateAbout from "@/components/RateAbout";
import RiskRating from "@/components/RiskRating";
import { pairOf } from "@/lib/fx";
import { naicsOf } from "@/lib/naics";
import { kindOf } from "@/lib/sandbox";
import SearchBox from "@/components/SearchBox";
import { button, CARD, PAGE_TITLE, SECTION_TITLE } from "@/lib/ui";
import {
  getCompany,
  getCompanyProfile,
  getEtfBreakdown,
  getExchange,
  getKeyStats,
  getPriceHistory,
  getRisk,
} from "@/lib/db";
import Page from "@/components/Page";

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
  // A fund's risk rating, from its price history (lib/risk.ts).
  const fund = Boolean(breakdown || profile?.fundFamily);
  const risk = company && fund && !rate ? await getRisk(company.symbol) : null;

  return (
    <Page width="md">
      <div className={CARD}>
        {/* The title, with the switch for finding a company or ETF by its ticker or by (part
            of) its name at the end of its line; the search box under them. */}
        <SearchBox
          heading={<h1 className={PAGE_TITLE}>Search</h1>}
          rates
          symbol={company?.symbol ?? null}
          name={company?.name ?? null}
        />
        {company && history ? (
          // Keyed by symbol, so each newly chosen company plays its entrance.
          <div key={`company-${company.symbol}`} className="company-view mt-6 border-t border-slate-200 pt-6">
            <div className="rise-in flex items-center gap-3">
              {/* Its badge: its sector's colour and its kind's mark. */}
              <KindBadge
                sector={company.sector}
                industry={company.industry}
                fundFamily={company.fundFamily}
                category={company.category}
                className="size-10"
                markClassName="size-5"
              />
              <div className="min-w-0">
                {/* Name, then the ticker on its own line, so a long name never splits them;
                    right after the name, what its icon means, in a pop-up (its sector and
                    its NAICS group picked out). */}
                <p className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${SECTION_TITLE}`}>
                  {company.name ?? company.symbol}
                  <BadgeInfo
                    labelled
                    mark={kindOf(company)}
                    colour={naicsOf(company.sector, company.industry)?.code ?? null}
                  />
                </p>
                <p className="text-base text-slate-500">{company.symbol}</p>
              </div>
            </div>
            <div className="rise-in" style={{ animationDelay: "80ms" }}>
              <PriceChart history={history} currency={company.currency} exchange={exchange} rate={rate} />
            </div>
            {stats && <KeyStats stats={stats} currency={company.currency} rate={rate} symbol={company.symbol} />}
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
            {/* A fund's risk rating, and how it is worked out. */}
            {risk && !rate && <RiskRating risk={risk} symbol={company.symbol} />}
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
                    className={`group ${button("secondary")}`}
                  >
                    View full holdings of {company.symbol}
                    <MapMark className="size-4 text-slate-500 transition-colors duration-300 ease-out group-hover:text-slate-900" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="rise-in mt-4 text-slate-600">
            {typeof symbol === "string" && symbol
              ? `Nothing with the symbol ${symbol.toUpperCase()} in our database.`
              : "Search for a company, ETF, or exchange rate."}
          </p>
        )}
      </div>
    </Page>
  );
}
