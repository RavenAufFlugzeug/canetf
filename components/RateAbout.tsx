import Link from "next/link";
import FlagPair, { Flag } from "@/components/FlagPair";
import { currencyName, pairOf, usedIn } from "@/lib/fx";
import { moneyFormatter, rateDecimals } from "@/lib/money";

// The Search page's About section for an exchange rate (USDCAD=X), in place of a company's:
// the pair, what one of each currency buys of the other, how the rate moved over the last
// year, and what it is for, with a worked example. When the database has the pair the other
// way round (`reverse`), a button beside the heading switches the page, chart and all, to it. Laid out, rising in and responding to
// the pointer as the company's About section does: a row tints when pointed at and opens a
// card saying what its figure means.
export default function RateAbout({
  symbol,
  reverse = null,
  rate,
  yearAgo,
  delay = 380,
  stagger = 40,
}: {
  symbol: string;
  reverse?: string | null; // the pair the other way round (CADUSD=X for USDCAD=X), if stored
  rate: number; // the latest close: one of the base currency in the quote currency
  yearAgo: number | null; // the close about a year (252 trading days) before
  delay?: number;
  stagger?: number;
}) {
  const pair = pairOf(symbol);
  if (!pair || !(rate > 0)) return null;
  const { base, quote } = pair;
  const inQuote = moneyFormatter(quote, rateDecimals(rate));
  const inBase = moneyFormatter(base, rateDecimals(1 / rate));
  // An everyday amount to convert: 100 of a currency worth about a dollar, more of one worth
  // a cent or less (10,000 yen), so the answer isn't a few cents.
  const amount = 10 ** Math.max(2, Math.ceil(-Math.log10(rate)) + 1);
  const change = yearAgo ? (rate / yearAgo - 1) * 100 : null;

  // Each currency of the pair, by its flag, code and name, with where it is used: so one
  // less heard of is plain.
  const currency = (code: string) => (
    <span className="inline-flex items-center gap-2">
      <Flag code={code} />
      <span>
        {code} <span className="font-normal text-slate-400">·</span> {currencyName(code)}
      </span>
    </span>
  );
  const where = (code: string) => (usedIn(code) ? `Used in ${usedIn(code)}` : undefined);

  const rows: { label: string; value: React.ReactNode; note?: string; tip: string; wide?: boolean }[] = [
    {
      label: "Base currency",
      value: currency(base),
      note: where(base),
      tip: `The currency being priced: the rate is the price of one ${currencyName(base)} (${base}), as Yahoo Finance quotes it under ${symbol}.`,
      wide: true,
    },
    {
      label: "Quote currency",
      value: currency(quote),
      note: where(quote),
      tip: `The currency the price is given in: the rate says how many ${currencyName(quote)}s (${quote}) one ${base} is worth.`,
      wide: true,
    },
    {
      label: `1 ${base} buys`,
      value: inQuote.format(rate),
      tip: `The latest rate: how many ${currencyName(quote)}s one ${currencyName(base)} buys.`,
    },
    {
      label: `1 ${quote} buys`,
      value: inBase.format(1 / rate),
      tip: `The same rate the other way round (one divided by it): how many ${currencyName(base)}s one ${currencyName(quote)} buys.`,
    },
  ];
  if (change !== null) {
    rows.push({
      label: "Over the last year",
      value: `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`,
      note: `the ${currencyName(base)} ${change >= 0 ? "rose" : "fell"} against the ${currencyName(quote)}`,
      tip: `The change in the rate since its close about a year (252 trading days) ago. A rise means a ${currencyName(base)} buys more ${currencyName(quote)}s than it did.`,
      wide: true,
    });
  }
  rows.push({
    label: "Indicative conversion",
    value: `${moneyFormatter(base).format(amount)} = ${moneyFormatter(quote).format(amount * rate)}`,
    note: `${base} to ${quote} at the latest market rate`,
    tip: `An amount in ${currencyName(base)}s converted to ${currencyName(quote)}s by multiplying it by the latest rate. Indicative only: banks and brokers apply a spread, so the rate they offer will differ.`,
    wide: true,
  });

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <div className="rise-in flex flex-wrap items-center gap-3" style={{ animationDelay: `${delay}ms` }}>
        <h3 className="flag-hover flex items-center gap-2.5 text-lg font-semibold text-slate-900">
          <FlagPair base={base} quote={quote} className="size-7" />
          About this rate
        </h3>
        {reverse && (
          // Pointed at, it lifts and its arrows swap places; pressed, it sinks back.
          <Link
            href={`/search?symbol=${encodeURIComponent(reverse)}`}
            title={`See ${currencyName(quote)} to ${currencyName(base)}: one ${quote} in ${base}`}
            className="group ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition duration-300 ease-out hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-400/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:translate-y-0 active:shadow-sm motion-safe:hover:-translate-y-0.5"
          >
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.3,1.4,0.5,1)] motion-safe:group-hover:rotate-180"
            >
              <path d="M3.5 7.5h12M12.5 4.5l3 3-3 3M16.5 12.5h-12M7.5 9.5l-3 3 3 3" />
            </svg>
            Switch to {quote}/{base}
          </Link>
        )}
      </div>
      <dl className="mt-4 grid gap-x-8 text-sm sm:grid-cols-2">
        {rows.map((row, i) => {
          const tip = `rate-about-${i}`;
          // The second of two half-width rows sits on the right: its card opens leftwards.
          const right = !row.wide && i > 0 && !rows[i - 1].wide;
          return (
            <div
              key={row.label}
              className={`rise-in group/row flag-hover relative flex items-start justify-between gap-4 border-b border-slate-200 py-2 transition-colors duration-200 focus-within:z-30 hover:z-30 hover:bg-slate-50 ${row.wide ? "sm:col-span-2" : ""}`}
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
              <dd className="flex min-w-0 flex-col items-end text-right font-semibold tabular-nums text-slate-900">
                {row.value}
                {row.note && <span className="text-xs font-normal text-slate-500">{row.note}</span>}
              </dd>
              <span
                id={tip}
                role="tooltip"
                className={`pointer-events-none absolute top-full z-20 mt-2.5 w-72 ${right ? "left-0 sm:right-0 sm:left-auto" : "left-0"} max-w-[85vw] translate-y-1 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed font-normal text-slate-600 opacity-0 shadow-lg shadow-slate-300/50 transition duration-200 ease-out group-focus-within/row:translate-y-0 group-focus-within/row:opacity-100 group-hover/row:translate-y-0 group-hover/row:opacity-100`}
              >
                <span
                  aria-hidden
                  className={`absolute -top-[5.5px] left-[18px] size-2.5 rotate-45 border-t border-l border-slate-200 bg-white ${right ? "sm:right-[18px] sm:left-auto" : ""}`}
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
