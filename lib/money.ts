// Formats amounts in a company's currency, e.g. "US$336.67", "€78.53", "₩262,000".
// (lib/db.ts already gives prices quoted in pence or cents in the main unit.)
export function moneyFormatter(currency: string | null) {
  const format = new Intl.NumberFormat("en-CA", { style: "currency", currency: currency ?? "CAD" });
  return {
    format: (value: number) => format.format(value),
    // How many decimals the currency uses: 2 for dollars and euros, none for yen or won.
    decimals: format.resolvedOptions().maximumFractionDigits ?? 2,
  };
}
