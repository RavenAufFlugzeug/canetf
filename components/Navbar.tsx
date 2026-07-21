import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex justify-between p-6 text-slate-600">
      <Link href="/" className="font-bold text-xl">
        CanETF
      </Link>

      <Link href="/login" className="hover:text-blue-600">
        Login
      </Link>
    </nav>
  );
}
