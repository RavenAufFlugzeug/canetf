"use client";

import { Fragment, useEffect, useState } from "react";
import { getSandboxSetHistory } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import FoldButton from "@/components/FoldButton";
import KindMark from "@/components/KindMark";
import { FigureRows, type PickCard } from "@/components/PickCards";
import { AliasName } from "@/components/SandboxAliases";
import SandboxChart from "@/components/SandboxChart";
import SetComposition from "@/components/SetComposition";
import { countryFlag } from "@/lib/fx";

const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 });

// The picked set, before the test: what it is made of (SetComposition), always in view; then
// the testing group, in one box: a bar saying how many there are, with a peek at their icons,
// that opens (as does its Fold / Open button) into a table of them, as the summary's after the
// test, but with nothing that names them: each one's icon, flag and test name, its sector, its
// size and its currency. Clicking a row opens it out: what it does, its figures (or, for a
// fund, what it holds), and its price before the test (TestingRow). The box eases open and
// shut with the table.
export default function PickOverview({ cards, starts }: { cards: PickCard[]; starts: string[] }) {
  const [open, setOpen] = useState(false);
  // The row opened out, and how many times each has been opened (its chart draws in afresh).
  const [opened, setOpened] = useState<string | null>(null);
  const [openings, setOpenings] = useState<Record<string, number>>({});

  return (
    <div>
      <SetComposition cards={cards} />

      <div className="mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* A peek at the group: the first few icons, fanned. */}
            <span className="flex shrink-0 -space-x-1.5" aria-hidden>
              {cards.slice(0, 5).map((c) => (
                <span
                  key={c.symbol}
                  className="grid size-6 place-items-center rounded-md ring-2 ring-white"
                  style={{ background: c.color, color: c.mark }}
                >
                  <KindMark kind={c.kind} className="size-3.5" />
                </span>
              ))}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">Testing group</span>
            </span>
          </div>
          <FoldButton
            open={open}
            controls="sandbox-testing-group"
            onClick={() => setOpen(!open)}
            className="text-xs"
          />
        </div>

        <div
          id="sandbox-testing-group"
          className="legend-fold"
          data-closed={open ? undefined : ""}
          inert={!open}
        >
          <div>
            <div className="border-t border-slate-100 px-2 pb-2">
              <table className="w-full table-fixed text-sm tabular-nums">
                <colgroup>
                  <col />
                  <col className="hidden w-44 sm:table-column" />
                  <col className="w-24" />
                  <col className="w-20" />
                </colgroup>
                <thead className="text-[11px] text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Listing</th>
                    <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">Sector</th>
                    <th className="px-2 py-2 text-right font-medium">Market value</th>
                    <th className="px-2 py-2 text-right font-medium">Trades in</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c, i) => {
                    const on = opened === c.symbol;
                    const toggle = () => {
                      if (!on) setOpenings((o) => ({ ...o, [c.symbol]: (o[c.symbol] ?? 0) + 1 }));
                      setOpened(on ? null : c.symbol);
                    };
                    const flag = countryFlag(c.country, true);
                    return (
                      <Fragment key={c.symbol}>
                        <tr
                          tabIndex={0}
                          onClick={toggle}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            toggle();
                          }}
                          aria-expanded={on}
                          className="result-row group kind-hover cursor-pointer border-t border-slate-100 outline-none focus-visible:bg-slate-50"
                          style={{ "--accent": c.color } as React.CSSProperties}
                        >
                          <td className="px-2 py-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <svg
                                aria-hidden
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`size-3 shrink-0 text-slate-400 transition duration-300 ease-out group-hover:text-slate-900 ${
                                  on ? "rotate-90 text-slate-900" : "motion-safe:group-hover:translate-x-0.5"
                                }`}
                              >
                                <path d="M4.5 2.5 8 6 4.5 9.5" />
                              </svg>
                              <span
                                className="kind-badge grid size-7 shrink-0 place-items-center rounded-md shadow-sm"
                                style={{ background: c.color, color: c.mark, ["--badge" as string]: c.color }}
                              >
                                <KindMark kind={c.kind} className="size-3.5" />
                              </span>
                              {flag && (
                                // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG
                                <img
                                  src={flag}
                                  alt={c.country ?? ""}
                                  title={`${c.kind === "ETF" ? "Listed in" : "Based in"} ${c.country}`}
                                  className="h-3 w-auto shrink-0 rounded-[2px] ring-1 ring-black/10"
                                />
                              )}
                              <span className="min-w-0">
                                <AliasName
                                  symbol={c.symbol}
                                  name={c.name}
                                  editable={false}
                                  className="block truncate text-sm font-semibold text-slate-900"
                                />
                                {c.note && (
                                  <span className="block truncate text-[11px] text-slate-500">{c.note}</span>
                                )}
                              </span>
                            </span>
                          </td>
                          <td className="hidden truncate px-2 py-2 text-xs text-slate-600 sm:table-cell">
                            {c.sector ?? (c.kind === "ETF" ? "A fund" : "—")}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right text-slate-700">
                            {c.size ? `$${compact.format(c.size)}` : "—"}
                          </td>
                          <td className="px-2 py-2 text-right text-xs font-semibold text-slate-700">
                            {c.currency ?? "—"}
                          </td>
                        </tr>
                        <tr aria-hidden={!on}>
                          <td colSpan={4} className="p-0">
                            <div className="legend-fold" data-closed={on ? undefined : ""} inert={!on}>
                              <div>
                                {/* Drawn once opened (and kept while it folds shut, so it closes as
                                    it opened); each opening starts it afresh. */}
                                {(openings[c.symbol] ?? 0) > 0 && (
                                  <TestingRow key={openings[c.symbol]} card={c} from={starts[i]} />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A row of the testing group, opened out: what it does (its name hidden), its figures today
// (or, for a fund, what it holds), and its price over the five years before the test, asked
// for as it opens. Nothing from the test's own days shows: they are for the test.
function TestingRow({ card, from }: { card: PickCard; from: string }) {
  const [history, setHistory] = useState<{ closes: number[]; yearStarts: number[] } | null | "loading">(
    "loading",
  );
  useEffect(() => {
    let live = true;
    getSandboxSetHistory([{ symbol: card.symbol, from }]).then(
      (h) => live && setHistory(h?.[card.symbol] ?? null),
      () => live && setHistory(null),
    );
    return () => {
      live = false;
    };
  }, [card.symbol, from]);

  return (
    <div className="text-fade-in border-t border-slate-100 bg-slate-50/60 px-3 pb-4 pt-3">
      <p className="text-xs text-slate-500">{card.line}</p>
      {card.about && (
        <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed text-slate-700" title={card.about}>
          {card.about}
        </p>
      )}
      {card.figures ? (
        <div className="mt-3">
          <FigureRows figures={card.figures} />
        </div>
      ) : (
        card.note && <p className="mt-2 text-xs font-medium text-slate-700">{card.note}</p>
      )}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Its price before the test
      </p>
      {history === "loading" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <DiamondLoader className="size-3" />
          Loading its prices…
        </p>
      ) : history && history.closes.length > 1 ? (
        // The days before the test only (its last the day before Day 1); the test's own are
        // for the test.
        <SandboxChart
          symbol={`${card.symbol}-before`}
          exampleDay={false}
          history={history.closes}
          prices={[]}
          yearStarts={history.yearStarts.filter((y) => y < history.closes.length)}
        />
      ) : (
        <p className="mt-2 text-xs text-slate-500">No prices on record for it before the test.</p>
      )}
    </div>
  );
}
