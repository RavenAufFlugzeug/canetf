import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-5xl font-bold text-slate-900">CanETF Selector</h1>

        <p className="mt-6 max-w-xl text-xl text-slate-600">
          Build a Canadian ETF portfolio, automate your monthly contributions,
          and stay on track without complicated decisions.
        </p>

        <Link
          href="/onboarding"
          className="
            mt-8
            rounded-xl
            bg-blue-600
            px-8
            py-4
            text-lg
            font-semibold
            text-white
            hover:bg-blue-700
          "
        >
          Build My Portfolio
        </Link>
      </section>
    </main>
  );
}
