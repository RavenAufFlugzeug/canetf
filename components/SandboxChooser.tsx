"use client";

import { useEffect, useRef, useState } from "react";
import { getChooserPreview, type ChooserPreview } from "@/app/actions/sandbox";
import DiamondLoader from "@/components/DiamondLoader";
import KindMark from "@/components/KindMark";
import SearchBox from "@/components/SearchBox";
import { EaseHeight, useSandboxSwap } from "@/components/SandboxSwap";
import { MOST_CHOSEN, sandboxHref, type Choices } from "@/lib/sandbox";
import { button, EMPTY_STATE, REMOVE_BUTTON } from "@/lib/ui";
import { FADE_MS } from "@/lib/motion";

const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 });
// How long a row or the preview takes to go (.chosen-row, .chosen-preview in globals.css).
const OUT_MS = FADE_MS;

// The Sandbox's companies and ETFs chosen by hand (its Custom mode). A search box: a listing
// found there is shown first, with its general info, to add or clear; finding another shows that
// one in its place. Under it, the list of those chosen, as the results after a test have them:
// each with its kind's badge in its sector's colours, its name and ticker, what it does and
// where, what it trades in and its market value, and a button to take it out. Up to
// MOST_CHOSEN; exchange rates can't be added.
//
// The list changes at once (a row added rises in; one taken out folds away) while the page goes
// to the Sandbox's address with the new list (keeping the other choices), the area below fading
// (Swap: `swaps`) as it does.
export default function SandboxChooser({
  choices,
  chosen,
  swaps,
}: {
  choices: Choices;
  chosen: ChooserPreview[];
  swaps: string;
}) {
  const { change } = useSandboxSwap();
  // The list as shown: the page's, with the change just made until the page has it.
  const [rows, setRows] = useState(chosen);
  const [lastChosen, setLastChosen] = useState(chosen);
  if (chosen !== lastChosen) {
    setLastChosen(chosen);
    setRows(chosen);
  }
  // (The latest list, for a row taken out once it has folded away.)
  const rowsNow = useRef(rows);
  useEffect(() => {
    rowsNow.current = rows;
  }, [rows]);
  // Rows on their way out (folding away before they go).
  const [going, setGoing] = useState<string[]>([]);
  const go = (next: ChooserPreview[]) =>
    change(swaps, () => sandboxHref({ ...choices, symbols: next.map((r) => r.symbol) }));
  const full = rows.length >= MOST_CHOSEN;

  // The listing found, before it is added: loading, shown, or none on record; and whether the
  // preview is going.
  const [found, setFound] = useState<ChooserPreview | "loading" | "none" | null>(null);
  const [closing, setClosing] = useState(false);
  const [asked, setAsked] = useState("");
  // The latest search: only its answer is shown.
  const latest = useRef("");

  const look = async (symbol: string) => {
    latest.current = symbol;
    setAsked(symbol);
    setClosing(false);
    setFound("loading");
    const preview = await getChooserPreview(symbol).catch(() => null);
    if (latest.current === symbol) setFound(preview ?? "none");
  };
  const clear = () => {
    latest.current = "";
    setClosing(true);
    window.setTimeout(() => {
      // (Unless another was looked up meanwhile: that one stays.)
      if (latest.current) return;
      setFound(null);
      setClosing(false);
    }, OUT_MS);
  };
  const add = (row: ChooserPreview) => {
    const next = [...rows, row];
    setRows(next);
    clear();
    go(next);
  };
  const remove = (symbol: string) => {
    setGoing((g) => [...g, symbol]);
    window.setTimeout(() => {
      const next = rowsNow.current.filter((x) => x.symbol !== symbol);
      setGoing((g) => g.filter((s) => s !== symbol));
      setRows(next);
      go(next);
    }, OUT_MS);
  };
  const previewKey = found && typeof found === "object" ? found.symbol : String(found);
  const added = found && typeof found === "object" && rows.some((r) => r.symbol === found.symbol);

  return (
    <div className="mt-3 space-y-4">
      {!full && (
        <div className="max-w-xl">
          <SearchBox
            placeholders={{ symbol: "e.g. NVDA or XEQT.TO", name: "e.g. Shopify" }}
            added={rows.map((r) => r.symbol)}
            onChoose={look}
          />
          {/* The preview folds open and shut (as a chosen row does), so what is below glides
              rather than jumping once it has gone; one listing to the next eases between heights. */}
          {found && (
            <div data-out={closing ? "" : undefined} className="chosen-row grid">
              <div className="min-h-0 overflow-clip [overflow-clip-margin:6px]">
                <EaseHeight changeKey={previewKey} duration={OUT_MS}>
                  <div className="pt-3">
                    <div
                      key={previewKey}
                      data-out={closing ? "" : undefined}
                      className="chosen-preview rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      {found === "loading" ? (
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <DiamondLoader className="size-3.5" />
                          Loading {asked}…
                        </p>
                      ) : found === "none" ? (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-600">{asked} can&apos;t be added.</p>
                          <button type="button" onClick={clear} className={button("secondary", "xs")}>
                            Clear
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-full shadow-sm"
                              style={{ background: found.color, color: found.mark }}
                            >
                              <KindMark kind={found.kind} className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900">
                                {found.name} <span className="text-sm font-normal text-slate-500">{found.symbol}</span>
                              </p>
                              {found.line && <p className="text-xs text-slate-500">{found.line}</p>}
                              <p className="mt-0.5 text-xs text-slate-500">
                                {[
                                  found.trades && `Trades on ${found.trades}`,
                                  found.currency,
                                  found.marketCap && `Market value ${compact.format(found.marketCap)}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              disabled={added || full || closing}
                              onClick={() => add(found)}
                              className={button("primary", "xs")}
                            >
                              {added ? "Added" : "Add"}
                            </button>
                            <button type="button" onClick={clear} className={button("secondary", "xs")}>
                              Clear
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </EaseHeight>
              </div>
            </div>
          )}
        </div>
      )}
      {rows.length ? (
        <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((r, i) => (
            <li key={r.symbol} data-out={going.includes(r.symbol) ? "" : undefined} className="chosen-row grid">
              <div className="min-h-0 overflow-hidden">
                <div className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t border-slate-100" : ""}`}>
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-full shadow-sm"
                    style={{ background: r.color, color: r.mark }}
                  >
                    <KindMark kind={r.kind} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {r.name}
                      <span className="ml-1.5 text-xs font-normal text-slate-500">{r.symbol}</span>
                    </span>
                    {r.line && <span className="block truncate text-xs text-slate-500">{r.line}</span>}
                  </span>
                  <span className="hidden shrink-0 text-right text-xs tabular-nums text-slate-500 sm:block">
                    <span className="block font-semibold text-slate-700">{r.currency}</span>
                    {r.marketCap ? compact.format(r.marketCap) : ""}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => remove(r.symbol)}
                    className={`${REMOVE_BUTTON} shrink-0`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={EMPTY_STATE}>None chosen yet</p>
      )}
    </div>
  );
}
