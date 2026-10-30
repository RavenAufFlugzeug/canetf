// Formats amounts in a company's currency, e.g. "US$336.67", "€78.53", "₩262,000".
// (lib/db.ts already gives prices quoted in pence or cents in the main unit.)
// `decimals` overrides the currency's own, for an exchange rate (rateDecimals).
export function moneyFormatter(currency: string | null, decimals?: number) {
  const format = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency ?? "CAD",
    ...(decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  });
  return {
    format: (value: number) => format.format(value),
    // How many decimals the currency uses: 2 for dollars and euros, none for yen or won.
    decimals: format.resolvedOptions().maximumFractionDigits ?? 2,
  };
}

// How many decimals an exchange rate of about `value` is shown with, as markets quote them:
// four for a rate near one (1.3985), more for a small one, so it keeps four figures that
// count (0.01464 for the rupee, 0.008862 for the yen).
export function rateDecimals(value: number) {
  if (!(value > 0)) return 4;
  return Math.max(4, 3 - Math.floor(Math.log10(value)));
}
