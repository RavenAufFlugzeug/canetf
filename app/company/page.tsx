import CompanyPicker from "@/components/CompanyPicker";
import KeyStats from "@/components/KeyStats";
import Navbar from "@/components/Navbar";
import PriceChart from "@/components/PriceChart";
import { getCompany, getKeyStats, getPriceHistory } from "@/lib/db";

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The company on display is whichever ?symbol= the picker last chose.
  const { symbol } = await searchParams;
  const company = typeof symbol === "string" && symbol ? await getCompany(symbol) : null;
  const history = company ? await getPriceHistory(company.symbol) : null;
  const stats = company ? await getKeyStats(company.symbol) : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-2xl px-6 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Company</h1>
          <CompanyPicker key={`picker-${company?.symbol}`} selected={company?.symbol ?? null} />

          {company && history ? (
            // Keyed by symbol, so each newly chosen company plays its entrance.
            <div key={`company-${company.symbol}`} className="mt-6 border-t border-slate-200 pt-6">
              <p className="rise-in text-lg font-semibold text-slate-900">
                {company.name ?? company.symbol}{" "}
                <span className="font-normal text-slate-500">{company.symbol}</span>
              </p>
              <div className="rise-in" style={{ animationDelay: "80ms" }}>
                <PriceChart history={history} currency={company.currency} />
              </div>
              {stats && <KeyStats stats={stats} />}
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
