import { addToWatchlist, removeFromWatchlist } from "@/app/actions/watchlist";
import Prompt from "@/components/Prompt";
import SearchBox from "@/components/SearchBox";
import WatchlistTable from "@/components/WatchlistTable";
import { getAppDb } from "@/lib/appDb";
import { getCompanies } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import Page from "@/components/Page";
import { CARD, PAGE_TITLE } from "@/lib/ui";

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
    <Page width="xl">
      {/* The same card as the Company lookup's search. */}
      <div className={CARD}>
        {!user ? (
          // Signed out: the same login prompt as the Sandbox page's.
          <>
            <h1 className={PAGE_TITLE}>Watch List</h1>
            <div className="mt-4 max-w-xl">
              <Prompt
                text="Log in to build your watch list of companies and ETFs."
                href="/login?next=/watchlist"
                action="Log in"
              />
            </div>
          </>
        ) : (
          <>
            {/* The title, with the switch for adding a company or ETF by its ticker or by (part
                of) its name at the end of its line; the search box under them, the card's width. */}
            <SearchBox
              heading={<h1 className={PAGE_TITLE}>Watch List</h1>}
              placeholders={{ symbol: "e.g. AAPL or XEQT.TO", name: "e.g. Apple or iShares" }}
              onChoose={addToWatchlist}
              added={symbols}
            />
            {companies.length === 0 && (
              <p className="mt-4 text-slate-600">
                Your watch list is empty.
              </p>
            )}
          </>
        )}
      </div>

      {/* The table (what its icons mean is a pop-up from its Sector heading). */}
      {companies.length > 0 && (
        <div className="rounded-2xl bg-white shadow">
          <WatchlistTable companies={companies} justAdded={justAdded} remove={removeFromWatchlist} />
        </div>
      )}
    </Page>
  );
}
