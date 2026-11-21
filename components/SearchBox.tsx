"use client";

import { useId, useState } from "react";
import CompanyPicker from "@/components/CompanyPicker";
import SlideTabs from "@/components/SlideTabs";

type By = "symbol" | "name" | "rate";

const WAYS = [
  { value: "symbol", label: "Ticker" },
  { value: "name", label: "Name" },
] as const;

// With `rates`, a third way: exchange rates only.
const WAYS_WITH_RATES = [...WAYS, { value: "rate", label: "Exchange rate" }] as const;

const ORDER: By[] = ["symbol", "name", "rate"];

// A search box with a switch above it for how to search: by ticker (symbols starting with
// what is typed) or by name (names containing it), used wherever the site searches for a
// company or ETF. The switch reads after `lead` ("Add a company or ETF by"), or stands alone
// without one; given a `heading` (the Search page's title), it sits on the heading's line,
// at its end. A white pill slides under whichever way is chosen, with a slight spring. The box
// shows the company on display (symbol, name) its own way, its symbol or its name, and
// starts afresh on each switch, sliding in from the side the pill moved to as it fades in,
// with the cursor in it when it is empty; the choice of switch is kept as other companies
// are chosen. Everything else is CompanyPicker's: etfsOnly, and onChoose and added for a
// box that hands its choice over (the Watch List's) rather than showing it.
export default function SearchBox({
  symbol = null,
  name = null,
  lead,
  heading,
  rates = false,
  placeholders = { symbol: "e.g. AAPL", name: "e.g. Shopify", rate: "e.g. USDCAD or US Dollar" },
  etfsOnly = false,
  onChoose,
  added,
}: {
  symbol?: string | null;
  name?: string | null;
  lead?: string; // without one, the switch has no words before it
  heading?: React.ReactNode;
  rates?: boolean; // offer the third way, exchange rates (the Search page)
  placeholders?: { symbol: string; name: string; rate?: string };
  etfsOnly?: boolean;
  onChoose?: (symbol: string) => Promise<void>;
  added?: string[];
}) {
  const [by, setBy] = useState<By>("symbol");
  // Whether the switch has been used yet: the box only slides in, and takes the cursor,
  // after a switch, not when the page opens.
  const [switched, setSwitched] = useState(false);
  // Which side the new box slides in from: the side the pill moved to.
  const [from, setFrom] = useState<"left" | "right">("right");
  const leadId = useId();
  const what = etfsOnly ? "an ETF" : "a company, ETF or exchange rate";

  return (
    <div className={heading ? undefined : "mt-4"}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${heading ? "justify-between" : ""}`}>
        {heading}
        {lead && (
          <span id={leadId} className="text-sm text-slate-600">
            {lead}
          </span>
        )}
        <SlideTabs
          labelledBy={lead ? leadId : undefined}
          label={lead ? undefined : "Search by"}
          value={by}
          options={rates ? WAYS_WITH_RATES : WAYS}
          onChange={(way) => {
            setFrom(ORDER.indexOf(way) > ORDER.indexOf(by) ? "right" : "left");
            setBy(way);
            setSwitched(true);
          }}
        />
      </div>
      {/* Keyed by the way and the company, so a switch (or a new choice) starts afresh. */}
      <div
        key={by}
        className={switched ? `search-swap-from-${from}` : undefined}
      >
        <CompanyPicker
          key={`${by}-${symbol}`}
          by={by}
          selected={symbol}
          selectedName={name}
          label={by === "rate" ? "Find an exchange rate by its currencies" : `Find ${what} by its ${by === "name" ? "name" : "ticker"}`}
          hideLabel
          placeholder={placeholders[by] ?? ""}
          etfsOnly={etfsOnly}
          onChoose={onChoose}
          added={added}
          autoFocus={switched && !symbol}
        />
      </div>
    </div>
  );
}
