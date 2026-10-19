import Link from "next/link";
import AccountMark from "@/components/AccountMark";
import MapMark from "@/components/MapMark";
import SearchMark from "@/components/SearchMark";
import WatchMark from "@/components/WatchMark";
import { getCurrentUser } from "@/lib/session";

// What the site offers, one card each, each with its page's mark, which plays its
// animation while the card is pointed at.
const FEATURES = [
  {
    title: "Search ETFs & companies",
    text: "Look up any Canadian ETF or company to see its price history, key figures and what each fund holds.",
    href: "/search",
    icon: <SearchMark className="size-6" />,
  },
  {
    title: "Holdings Map",
    text: "Follow an ETF down through the funds it owns to the companies underneath, level by level.",
    href: "/map",
    icon: <MapMark className="size-6" />,
  },
  {
    title: "Watch List",
    text: "Keep the ETFs you care about in one place and check how they are doing at a glance.",
    href: "/watchlist",
    icon: <WatchMark id="watch-mark-welcome" className="size-6" />,
  },
  {
    title: "Investor Profile",
    text: "Answer a few questions about your goals and comfort with risk to build a plan that suits you.",
    href: "/onboarding",
    icon: <AccountMark className="size-6" />,
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="flex-1 bg-white">
      {/* Hero */}
      <section className="relative px-6 pb-24 pt-16 text-center sm:pt-24">
        <div className="relative mx-auto max-w-3xl">
          <h1
            className="rise-in text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl"
            style={{ animationDelay: "100ms" }}
          >
            Welcome to LitterBox
          </h1>

          <p
            className="rise-in mx-auto mt-6 max-w-xl text-xl text-slate-600"
            style={{ animationDelay: "200ms" }}
          >
            Find the right Canadian ETFs without the guesswork. See what each fund really
            holds, keep an eye on your favourites, and build a simple plan that fits your goals.
          </p>
        </div>
      </section>

      {/* What the site does */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="rise-in group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-300/50"
              style={{ animationDelay: `${400 + i * 100}ms` }}
            >
              {/* The badge turns dark when the card is pointed at; --mark-paper follows its
                  background, so the parts of a mark drawn in the background colour turn
                  with it. */}
              <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition [--mark-paper:var(--color-slate-100)] group-hover:bg-slate-900 group-hover:text-white group-hover:[--mark-paper:var(--color-slate-900)]">
                {feature.icon}
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Create account */}
      <section className="px-6 pb-20">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-neutral-800 px-8 py-14 text-center shadow-xl">
          <div className="relative">
            {user ? (
              <>
                <h2 className="text-3xl font-bold text-white">Welcome back, {user.username}</h2>
                <p className="mx-auto mt-3 max-w-lg text-slate-300">
                  Pick up where you left off with your watch list.
                </p>
                <Link
                  href="/watchlist"
                  className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-lg font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  Open my Watch List
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
                <p className="mx-auto mt-3 max-w-lg text-slate-300">
                  Create a free account to save your watch list and investor profile.
                </p>
                <Link
                  href="/signup"
                  className="mt-8 inline-block rounded-xl bg-white px-8 py-4 text-lg font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  Create account
                </Link>
                <p className="mt-4 text-sm text-slate-400">
                  Already have one?{" "}
                  <Link href="/login" className="font-medium text-white underline underline-offset-4 hover:text-slate-200">
                    Log in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
