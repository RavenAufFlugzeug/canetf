import Link from "next/link";
import { logout } from "@/app/actions/auth";
import AccountMark from "@/components/AccountMark";
import DoorMark from "@/components/DoorMark";
import KeyMark from "@/components/KeyMark";
import NavLogo from "@/components/NavLogo";
import NavShell from "@/components/NavShell";
import SandboxMark from "@/components/SandboxMark";
import SearchMark from "@/components/SearchMark";
import WatchMark from "@/components/WatchMark";
import { getCurrentUser } from "@/lib/session";

// Every link's icon gets the same box, so they line up at one size. Each mark's viewBox
// frames its main shape (the glass, the cube, the book, the pawn, the door, the key) with
// the same small margin, so those come out the same size; extras such as Search's star and
// the Watch List's pen are left to reach past the box.
const ICON = "size-[22px]";

// A link (or the log out button) in the navbar: its icon, then its label.
const ITEM =
  "group flex items-center rounded outline-none hover:text-black focus-visible:text-black focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-4";

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
      className="sticky top-0 z-40 flex justify-between border-b border-transparent bg-white/80 p-6 text-slate-950 backdrop-blur transition-colors duration-300 data-[scrolled]:border-slate-200"
      style={{ viewTransitionName: "site-header" }}
    >
      <NavLogo />

      <div className="flex items-center gap-6">
        <Link href="/search" className={ITEM}>
          <SearchMark className={ICON} />
          <NavLabel>Search</NavLabel>
        </Link>

        <Link href="/sandbox" className={ITEM}>
          <SandboxMark className={`${ICON} motion-safe:group-hover:scale-110`} />
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
          <Link href="/login" className={ITEM}>
            {/* The key reaches a little past its box, so it gets room either side. */}
            <KeyMark className={`${ICON} mx-[3px]`} />
            <NavLabel>Log in</NavLabel>
          </Link>
        )}
      </div>
    </NavShell>
  );
}
