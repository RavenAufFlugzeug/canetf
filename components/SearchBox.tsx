"use client";

import { useId, useState } from "react";
import CompanyPicker from "@/components/CompanyPicker";

type By = "symbol" | "name";

const MODE_LABELS: Record<By, string> = { symbol: "Ticker", name: "Name" };

// A search box with a switch above it for how to search: by ticker (symbols starting with
// what is typed) or by name (names containing it), used wherever the site searches for a
// company or ETF. The switch reads after `lead` ("Search by", "Add a company or ETF by"),
// and a white pill slides under whichever way is chosen, with a slight spring. The box
// shows the company on display (symbol, name) its own way, its symbol or its name, and
// starts afresh on each switch, sliding in from the side the pill moved to as it fades in,
// with the cursor in it when it is empty; the choice of switch is kept as other companies
// are chosen. Everything else is CompanyPicker's: etfsOnly, and onChoose and added for a
// box that hands its choice over (the Watch List's) rather than showing it.
export default function SearchBox({
  symbol = null,
  name = null,
  lead = "Search by",
  placeholders = { symbol: "e.g. AAPL", name: "e.g. Shopify" },
  etfsOnly = false,
  onChoose,
  added,
}: {
  symbol?: string | null;
  name?: string | null;
  lead?: string;
  placeholders?: Record<By, string>;
  etfsOnly?: boolean;
  onChoose?: (symbol: string) => Promise<void>;
  added?: string[];
}) {
  const [by, setBy] = useState<By>("symbol");
  // Whether the switch has been used yet: the box only slides in, and takes the cursor,
  // after a switch, not when the page opens.
  const [switched, setSwitched] = useState(false);
  const leadId = useId();
  const what = etfsOnly ? "an ETF" : "a company, ETF or exchange rate";

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id={leadId} className="text-sm text-slate-600">
          {lead}
        </span>
        <div
          role="radiogroup"
          aria-labelledby={leadId}
          className="relative grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold"
        >
          {/* The pill under the chosen way, sliding across when it changes. */}
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,1.3,0.5,1)] motion-reduce:transition-none"
            style={{ transform: by === "name" ? "translateX(100%)" : "none" }}
          />
          {(["symbol", "name"] as const).map((way) => (
            <button
              key={way}
              type="button"
              role="radio"
              aria-checked={by === way}
              onClick={() => {
                if (way === by) return;
                setBy(way);
                setSwitched(true);
              }}
              className={`relative rounded-md px-4 py-1 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                by === way ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {MODE_LABELS[way]}
            </button>
          ))}
        </div>
      </div>
      {/* Keyed by the way and the company, so a switch (or a new choice) starts afresh. */}
      <div
        key={by}
        className={switched ? (by === "name" ? "search-swap-from-right" : "search-swap-from-left") : undefined}
      >
        <CompanyPicker
          key={`${by}-${symbol}`}
          by={by}
          selected={symbol}
          selectedName={name}
          label={`Find ${what} by its ${by === "name" ? "name" : "ticker"}`}
          hideLabel
          placeholder={placeholders[by]}
          etfsOnly={etfsOnly}
          onChoose={onChoose}
          added={added}
          autoFocus={switched && !symbol}
        />
      </div>
    </div>
  );
}
