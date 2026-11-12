import DividendHistory from "@/components/DividendHistory";
import type { KeyStats as Stats } from "@/lib/db";
import { moneyFormatter, rateDecimals } from "@/lib/money";

const count = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-CA"));
const exDate = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// With `rate`, an exchange rate's: a rate's decimals, and no volume (currencies trade between
// banks, and Yahoo counts none). With `symbol`, a listing that has paid dividends gets a History
// button by its dividend, opening its dividend history (DividendHistory).
export default function KeyStats({
  stats,
  currency,
  rate = false,
  symbol,
}: {
  stats: Stats;
  currency: string | null;
  rate?: boolean;
  symbol?: string;
}) {
  // Prices as finance sites list them: plain numbers, no currency sign,
  // with the currency's usual decimals (two for dollars, none for yen or won).
  const decimals = rate ? rateDecimals(stats.prevClose ?? stats.open ?? 1) : moneyFormatter(currency).decimals;
  const price = (n: number | null) =>
    n === null
      ? "—"
      : n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  // A dividend per share: to the cent, or finer when it is a small one (0.091).
  const amount = (n: number) =>
    n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: n < 1 ? 4 : decimals });
  const range = (lo: number | null, hi: number | null) =>
    lo === null || hi === null ? "—" : `${price(lo)} - ${price(hi)}`;

  const rows: [string, React.ReactNode][] = [
    ["Previous Close", price(stats.prevClose)],
    ["Open", price(stats.open)],
    ["Day's Range", range(stats.dayLow, stats.dayHigh)],
    ["52 Week Range", range(stats.week52Low, stats.week52High)],
    ...(rate
      ? []
      : ([
          ["Volume", count(stats.volume)],
          ["Avg. Volume", count(stats.avgVolume)],
          // Cash dividends over the last 12 months, and that as a share of the price.
          [
            "Dividend (12 mo.)",
            <>
              {stats.dividendTtm === null
                ? "None"
                : `${amount(stats.dividendTtm)}${
                    stats.dividendYield === null ? "" : ` (${(stats.dividendYield * 100).toFixed(2)}%)`
                  }`}
              {symbol && stats.lastDividend && <DividendHistory symbol={symbol} currency={currency} />}
            </>,
          ],
          [
            "Last Ex-Dividend",
            stats.lastDividend
              ? `${amount(stats.lastDividend.amount)} · ${exDate.format(new Date(`${stats.lastDividend.date}T00:00:00Z`))}`
              : "—",
          ],
        ] as [string, React.ReactNode][])),
  ];

  return (
    <dl className="mt-6 grid gap-x-8 text-sm sm:grid-cols-2">
      {rows.map(([label, value], i) => (
        <div
          key={label}
          className="rise-in flex justify-between gap-4 border-b border-slate-200 py-2"
          style={{ animationDelay: `${300 + i * 40}ms` }}
        >
          <dt className="whitespace-nowrap text-slate-600">{label}</dt>
          <dd className="text-right font-semibold tabular-nums text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
