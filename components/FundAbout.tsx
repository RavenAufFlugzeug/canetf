import { BasedIn } from "@/components/FlagPair";
import ProviderLink from "@/components/ProviderLink";
import type { CompanyProfile } from "@/lib/db";
import { listingOf } from "@/lib/exchanges";

// The Search page's About section for an ETF, in place of a company's: which country it is
// from (where it is listed, by that country's flag, and on which exchange), who runs it and
// what kind of fund it is; the provider opens a pop-up of the company behind it. Laid out, rising in and responding to the pointer as the
// company's About section does: a row tints when pointed at and opens a card saying what
// its figure means. Rows with nothing to show are left out, and the section with them.
export default function FundAbout({
  profile,
  delay = 380,
  stagger = 40,
}: {
  profile: CompanyProfile;
  delay?: number;
  stagger?: number;
}) {
  const listing = listingOf(profile.exchange);
  const rows: { label: string; value: React.ReactNode; note?: string; tip: string }[] = [];
  if (listing) {
    rows.push({
      label: "Listed in",
      value: <BasedIn place={listing.country} country={listing.country} />,
      note: listing.exchange,
      tip: `The country the fund is from: it is listed on the ${listing.exchange}, in ${listing.country}, where its units trade. What it holds can be from anywhere.`,
    });
  }
  if (profile.fundFamily) {
    rows.push({
      label: "Provider",
      value: <ProviderLink fundFamily={profile.fundFamily} />,
      tip: "The company that runs the fund, as listed on its Yahoo Finance profile. Click it to see the company behind it.",
    });
  }
  if (profile.category) {
    rows.push({
      label: "Category",
      value: profile.category,
      tip: "The kind of fund it is, by what it invests in, as Yahoo Finance classifies it.",
    });
  }
  if (!rows.length) return null;

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="rise-in text-lg font-semibold text-slate-900" style={{ animationDelay: `${delay}ms` }}>
        About this fund
      </h3>
      <dl className="mt-4 text-sm">
        {rows.map((row, i) => {
          const tip = `fund-about-${i}`;
          return (
            <div
              key={row.label}
              className="rise-in group/row relative flex items-start justify-between gap-4 border-b border-slate-200 py-2 transition-colors duration-200 focus-within:z-30 hover:z-30 hover:bg-slate-50"
              style={{ animationDelay: `${delay + 40 + i * stagger}ms` }}
            >
              <dt>
                <span
                  tabIndex={0}
                  aria-describedby={tip}
                  className="cursor-help rounded whitespace-nowrap text-slate-600 underline decoration-slate-300 decoration-dotted underline-offset-4 outline-none group-hover/row:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  {row.label}
                </span>
              </dt>
              <dd className="flex min-w-0 flex-col items-end text-right font-semibold text-slate-900">
                {row.value}
                {row.note && <span className="text-xs font-normal text-slate-500">{row.note}</span>}
              </dd>
              <span
                id={tip}
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-20 mt-2.5 w-72 max-w-[85vw] translate-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed font-normal text-slate-600 opacity-0 shadow-lg shadow-slate-300/50 transition duration-200 ease-out group-focus-within/row:translate-y-0 group-focus-within/row:opacity-100 group-hover/row:translate-y-0 group-hover/row:opacity-100"
              >
                <span
                  aria-hidden
                  className="absolute -top-[5.5px] left-[18px] size-2.5 rotate-45 border-t border-l border-slate-200 bg-white"
                />
                <span className="block font-semibold text-slate-900">{row.label}</span>
                {row.tip}
              </span>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
