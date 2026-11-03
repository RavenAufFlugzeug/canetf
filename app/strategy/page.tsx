import type { Metadata } from "next";
import StrategyBuilder from "@/components/StrategyBuilder";

export const metadata: Metadata = { title: "Strategies" };

// Strategies: each strategy a deck (what it applies to: a sector, all ETFs, or one firm or ETF)
// and each of its rules a card (a few conditions, and how many shares to buy or sell once they
// all hold), written out in plain words as they are made. Then how it works, in three steps.
export default function StrategyPage() {
  return (
    <main className="flex-1 bg-slate-50">
      <section className="mx-auto max-w-6xl space-y-6 px-6 pt-10 pb-12">
        <div className="rise-in rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Strategies</h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Each strategy is a deck, and each of its rules is a card that decides when to buy or sell. Open a
            deck, choose what it applies to, then click a card to edit it. Start from the tech example below,
            or a new deck.
          </p>
          <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            {[
              ["Applies to", "The deck covers a whole sector, every ETF, or one firm or ETF."],
              ["When", "Each card's conditions on the price, its trend, or what you hold. All must hold."],
              ["Then", "The card buys or sells a number of shares."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3 rounded-xl bg-slate-50 p-4">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">{title}</span>
                  <span className="text-slate-600">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <StrategyBuilder />
      </section>
    </main>
  );
}
