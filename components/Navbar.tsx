import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    // Named, so page transitions leave it in place while the content changes.
    <nav className="relative z-10 flex justify-between p-6 text-slate-600" style={{ viewTransitionName: "site-header" }}>
      <Link href="/" className="font-bold text-xl">
        CanETF
      </Link>

      <div className="flex items-center gap-6">
        <Link href="/" className="hover:text-blue-600">
          Home
        </Link>

        <Link href="/search" className="hover:text-blue-600">
          Search
        </Link>

        <Link href="/watchlist" className="hover:text-blue-600">
          Watch List
        </Link>

        {user ? (
          <>
            <Link href="/account" className="hover:text-blue-600">
              {user.username}
            </Link>

            <form action={logout}>
              <button type="submit" className="hover:text-blue-600">
                Log out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="hover:text-blue-600">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
