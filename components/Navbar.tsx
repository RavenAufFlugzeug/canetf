import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="flex justify-between p-6 text-slate-600">
      <Link href="/" className="font-bold text-xl">
        CanETF
      </Link>

      <div className="flex items-center gap-6">
        <Link href="/companies" className="hover:text-blue-600">
          Companies
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
