import Navbar from "@/components/Navbar";
import { getCompanies } from "@/lib/db";

const money = (value: number | null, currency: string | null) =>
  value === null
    ? "—"
    : value.toLocaleString("en-CA", {
        style: "currency",
        currency: currency ?? "CAD",
      });

const compact = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("en-CA", { notation: "compact", maximumFractionDigits: 1 });

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <h1 className="text-3xl font-bold text-slate-900">Companies</h1>

        {companies === null || companies.length === 0 ? (
          <p className="mt-4 text-slate-600">
            No company data yet. Run the pipeline in <code>search/</code> first
            (<code>build_database</code> in Database.ipynb).
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="p-4">Symbol</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Sector</th>
                  <th className="p-4 text-right">Price</th>
                  <th className="p-4 text-right">Change</th>
                  <th className="p-4 text-right">Market cap</th>
                  <th className="p-4 text-right">P/E</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.symbol} className="border-b last:border-0">
                    <td className="p-4 font-semibold">{c.symbol}</td>
                    <td className="p-4">{c.name ?? "—"}</td>
                    <td className="p-4">{c.sector ?? "—"}</td>
                    <td className="p-4 text-right">{money(c.price, c.currency)}</td>
                    <td
                      className={`p-4 text-right ${
                        (c.changePct ?? 0) < 0 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {c.changePct === null
                        ? "—"
                        : `${c.changePct > 0 ? "+" : ""}${c.changePct.toFixed(2)}%`}
                    </td>
                    <td className="p-4 text-right">{compact(c.marketCap)}</td>
                    <td className="p-4 text-right">
                      {c.peTrailing === null ? "—" : c.peTrailing.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
