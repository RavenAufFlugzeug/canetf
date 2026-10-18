import Link from "next/link";
import { logout } from "@/app/actions/auth";
import AccountMark from "@/components/AccountMark";
import DoorMark from "@/components/DoorMark";
import HomeMark from "@/components/HomeMark";
import NavShell from "@/components/NavShell";
import SandboxMark from "@/components/SandboxMark";
import SearchMark from "@/components/SearchMark";
import WatchMark from "@/components/WatchMark";
import { getCurrentUser } from "@/lib/session";

// Every link's icon gets the same box, so they line up at one size.
const ICON = "size-[22px]";

// A link (or the log out button) in the navbar: its icon, then its label.
const ITEM =
  "group flex items-center rounded outline-none hover:text-slate-900 focus-visible:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-4";

// A link's label beside its icon. Showing at the top of the page; once the page is
// scrolled it folds away, opening again while its link is pointed at or tabbed to
// (.nav-label in globals.css). Its link's icon plays its own animation meanwhile.
function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="nav-label">
      <span>
        <span className="nav-label-text">{children}</span>
      </span>
    </span>
  );
}

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    // It stays at the top of the screen as the page scrolls, over a soft frosted backdrop.
    // Named, so page transitions leave it in place while the content changes.
    <NavShell
      className="sticky top-0 z-40 flex justify-between border-b border-transparent bg-white/80 p-6 text-slate-600 backdrop-blur transition-colors duration-300 data-[scrolled]:border-slate-200"
      style={{ viewTransitionName: "site-header" }}
    >
      <Link href="/" className="font-bold text-xl">
        CanETF
      </Link>

      <div className="flex items-center gap-6">
        <Link href="/" className={ITEM}>
          <HomeMark className={`${ICON} motion-safe:group-hover:scale-110`} />
          <NavLabel>Home</NavLabel>
        </Link>

        <Link href="/search" className={ITEM}>
          <SearchMark className={ICON} />
          <NavLabel>Search</NavLabel>
        </Link>

        <Link href="/sandbox" className={ITEM}>
          {/* The board fills its box edge to edge, so it is drawn a little smaller to
              stand as tall as the pieces beside it. */}
          <SandboxMark className="size-[19px] motion-safe:group-hover:scale-110" />
          <NavLabel>Sandbox</NavLabel>
        </Link>

        <Link href="/watchlist" className={ITEM}>
          <WatchMark id="watch-mark-nav" className={ICON} />
          <NavLabel>Watch List</NavLabel>
        </Link>

        {user ? (
          <>
            <Link href="/account" className={ITEM}>
              <AccountMark className={`${ICON} motion-safe:group-hover:scale-110`} />
              <NavLabel>{user.username}</NavLabel>
            </Link>

            <form action={logout} className="flex">
              <button type="submit" className={ITEM}>
                <DoorMark className={ICON} />
                <NavLabel>Log out</NavLabel>
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="hover:text-blue-600">
            Login
          </Link>
        )}
      </div>
    </NavShell>
  );
}
