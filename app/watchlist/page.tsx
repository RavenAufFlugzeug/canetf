import Link from "next/link";
import { addToWatchlist, removeFromWatchlist } from "@/app/actions/watchlist";
import CompanyPicker from "@/components/CompanyPicker";
import Navbar from "@/components/Navbar";
import WatchlistTable from "@/components/WatchlistTable";
import { getAppDb } from "@/lib/appDb";
import { getCompanies } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export default async function WatchlistPage() {
  const user = await getCurrentUser();

  // Oldest first, so newly added companies appear at the bottom. `fresh` marks ones
  // added in the last few seconds, which the table highlights as they arrive.
  const entries = user
    ? (getAppDb()
        .prepare(
          `SELECT symbol, added_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 seconds') AS fresh
           FROM watchlist WHERE user_id = ? ORDER BY added_at`,
        )
        .all(user.id) as { symbol: string; fresh: number }[])
    : [];
  const symbols = entries.map((e) => e.symbol);
  const justAdded = entries.filter((e) => e.fresh).map((e) => e.symbol);
  const companies = (await getCompanies(symbols)) ?? [];

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-5xl space-y-6 px-6 pb-12">
        {/* The same card as the Company lookup's search. */}
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Watch List</h1>

          {!user ? (
            <p className="mt-4 text-slate-600">
              <Link href="/login?next=/watchlist" className="text-blue-600 hover:underline">
                Log in
              </Link>{" "}
              to build your watch list of companies and ETFs.
            </p>
          ) : (
            <>
              <div className="max-w-xl">
                <CompanyPicker
                  label="Add a company or ETF"
                  placeholder="e.g. AAPL or XEQT.TO"
                  onChoose={addToWatchlist}
                  added={symbols}
                />
              </div>
              {companies.length === 0 && (
                <p className="mt-4 text-slate-600">
                  Your watch list is empty. Search above to add companies or ETFs.
                </p>
              )}
            </>
          )}
        </div>

        {companies.length > 0 && (
          <WatchlistTable companies={companies} justAdded={justAdded} remove={removeFromWatchlist} />
        )}
      </section>
    </main>
  );
}
