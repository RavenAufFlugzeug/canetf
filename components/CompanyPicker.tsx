"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchCompanies } from "@/app/actions/companies";
import DiamondLoader from "@/components/DiamondLoader";
import type { CompanyMatch } from "@/lib/db";

const DEBOUNCE_MS = 200;
// The "Searching…" stage always shows for at least this long, so a fast search
// doesn't flash; with a big database the real wait takes over.
const MIN_THINKING_MS = 350;
const ENTER_STAGGER_MS = 90; // gap between options appearing one at a time
const LEAVE_MS = 300; // matches .picker-collapse in globals.css

// An option in the dropdown. Options that stop matching stay a moment longer
// (leftAt is set) so they can fade out and fold away.
type Row = { match: CompanyMatch; leftAt: number | null; enterDelay: number };

// New results merged into what is on screen: options still matching stay put, missing
// ones start leaving, new ones enter one after another. Kept in symbol order, or, for a
// search by name, in the order the results came in (best match first), leaving ones last.
function merge(rows: Row[], results: CompanyMatch[], bySymbol: boolean): Row[] {
  const now = Date.now();
  const found = new Map(results.map((m) => [m.symbol, m]));
  const onScreen = new Set(rows.map((r) => r.match.symbol));
  const kept = rows.map((r) => {
    const match = found.get(r.match.symbol);
    return match ? { ...r, match, leftAt: null } : { ...r, leftAt: r.leftAt ?? now };
  });
  const added = results
    .filter((m) => !onScreen.has(m.symbol))
    .map((match, i) => ({ match, leftAt: null, enterDelay: i * ENTER_STAGGER_MS }));
  const merged = [...kept, ...added];
  if (bySymbol) return merged.sort((a, b) => a.match.symbol.localeCompare(b.match.symbol));
  const rank = new Map(results.map((m, i) => [m.symbol, i]));
  const at = (r: Row) => (r.leftAt === null ? (rank.get(r.match.symbol) ?? Infinity) : Infinity);
  return merged.sort((a, b) => at(a) - at(b));
}

// A name with the part that matched the search picked out, for the options of a search by
// name. The match is found ignoring case, as the database does.
function Highlighted({ name, text }: { name: string; text: string }) {
  const at = text ? name.toLowerCase().indexOf(text.toLowerCase()) : -1;
  if (at < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <mark className="rounded-sm bg-slate-200 text-inherit">{name.slice(at, at + text.length)}</mark>
      {name.slice(at + text.length)}
    </>
  );
}

const leaveAll = (rows: Row[]) => rows.map((r) => ({ ...r, leftAt: r.leftAt ?? Date.now() }));

type Props = {
  selected?: string | null;
  // Search by symbol (the default: symbols starting with what is typed) or by name (names
  // containing it). A search by name shows the chosen company's name, selectedName.
  by?: "symbol" | "name";
  selectedName?: string | null;
  // Instead of showing the chosen company (?symbol= in the URL), hand its symbol to
  // this, e.g. a server action; the box is then cleared for the next search.
  onChoose?: (symbol: string) => Promise<void>;
  added?: string[]; // symbols already chosen: marked "Added" and not choosable
  label?: string;
  hideLabel?: boolean; // keep the label for screen readers only
  placeholder?: string;
  etfsOnly?: boolean; // offer only ETFs that have a composition
  autoFocus?: boolean; // put the cursor in the box as it appears
};

// Searches companies and ETFs by symbol, or by name. By default the chosen one goes into
// the URL as ?symbol=, which the page reads back; with onChoose it is handed over instead.
export default function CompanyPicker({
  selected = null,
  by = "symbol",
  selectedName = null,
  onChoose,
  added = [],
  label = "Enter a symbol",
  hideLabel = false,
  placeholder = "e.g. AAPL",
  etfsOnly = false,
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const byName = by === "name";
  const [query, setQuery] = useState((byName ? selectedName : selected) ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [noMatches, setNoMatches] = useState(false);
  // True while the dropdown fades out after being dismissed, so it stays on screen even
  // when it had no options to fade with it (it was only "Searching…" or "No companies…").
  const [closing, setClosing] = useState(false);
  const closingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [navigating, startNavigation] = useTransition();
  // Bumped by every new search and every dismissal, so late answers are ignored.
  const request = useRef(0);

  // Drop options once their fade-out has finished.
  function purgeSoon() {
    setTimeout(
      () => setRows((rs) => rs.filter((r) => r.leftAt === null || Date.now() - r.leftAt < LEAVE_MS)),
      LEAVE_MS + 20,
    );
  }

  // Fade the dropdown away (the box was cleared, lost focus, or a company was chosen).
  function dismiss() {
    request.current++;
    setClosing(true);
    clearTimeout(closingTimer.current);
    closingTimer.current = setTimeout(() => setClosing(false), LEAVE_MS);
    setSearching(false);
    setNoMatches(false);
    setRows(leaveAll);
    setActive(-1);
    purgeSoon();
  }

  useEffect(() => {
    const prefix = query.trim();
    if (!open || !prefix) return;

    const id = ++request.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const started = Date.now();
      const results = await searchCompanies(prefix, etfsOnly, by);
      const rest = MIN_THINKING_MS - (Date.now() - started);
      if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
      if (id !== request.current) return; // the user has typed something newer

      setSearching(false);
      setNoMatches(results.length === 0);
      setRows((rs) => merge(rs, results, !byName));
      setActive(results.length ? 0 : -1);
      purgeSoon();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, open, etfsOnly, by, byName]);

  // The options that still match, in order; keyboard navigation moves through these.
  const live = rows.filter((r) => r.leftAt === null).map((r) => r.match);

  function choose(match: CompanyMatch) {
    if (added.includes(match.symbol)) return;
    setQuery(onChoose ? "" : byName ? (match.name ?? match.symbol) : match.symbol);
    setOpen(false);
    dismiss();
    startNavigation(async () => {
      if (onChoose) await onChoose(match.symbol);
      else router.replace(`${pathname}?symbol=${encodeURIComponent(match.symbol)}`, { scroll: false });
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && live.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % live.length);
    } else if (e.key === "ArrowUp" && live.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? live.length - 1 : i - 1));
    } else if (e.key === "Enter" && live[active]) {
      e.preventDefault();
      choose(live[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      dismiss();
    }
  }

  const menuMounted = rows.length > 0 || searching || noMatches || closing;
  // Nothing left to show: the whole menu fades out while its last options leave.
  const menuClosing = !searching && !noMatches && live.length === 0;
  const showList = live.length > 0;
  let liveIndex = -1;

  return (
    <div className="relative mt-4">
      <label
        htmlFor={`${listId}-input`}
        className={hideLabel ? "sr-only" : "block text-sm font-medium text-slate-700"}
      >
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            // Symbols are upper case; names are typed as they are.
            const value = byName ? e.target.value : e.target.value.toUpperCase();
            setQuery(value);
            setOpen(true);
            // Think straight away rather than after the debounce; an emptied box fades the menu.
            if (value.trim()) {
              clearTimeout(closingTimer.current);
              setClosing(false);
              setSearching(true);
            } else dismiss();
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            dismiss();
          }}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          className={`w-full rounded-lg border p-3 text-slate-700 placeholder:normal-case ${byName ? "" : "uppercase"}`}
        />
        {navigating && (
          <DiamondLoader label="Loading" className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
        )}
      </div>

      {menuMounted && (
        <div
          className={`picker-menu absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg ${
            menuClosing ? "picker-menu-closing" : ""
          }`}
        >
          {/* Thinking stage: folds open while a search runs, folds away when it answers. */}
          <div className="picker-collapse" data-closed={searching ? undefined : ""} aria-live="polite">
            <div>
              <p className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500">
                <DiamondLoader className="size-4 text-slate-500" />
                {searching ? "Searching…" : ""}
              </p>
            </div>
          </div>

          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto">
            {rows.map((row) => {
              const leaving = row.leftAt !== null;
              const i = leaving ? -1 : ++liveIndex;
              const isAdded = added.includes(row.match.symbol);
              return (
                <li
                  key={row.match.symbol}
                  id={leaving ? undefined : `${listId}-${i}`}
                  role="option"
                  aria-selected={!leaving && i === active}
                  aria-disabled={isAdded || undefined}
                  aria-hidden={leaving || undefined}
                  className="picker-collapse picker-option"
                  data-closed={leaving ? "" : undefined}
                  style={{ animationDelay: `${row.enterDelay}ms` }}
                  // mousedown fires before the input's blur, so the click isn't lost.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (!leaving) choose(row.match);
                  }}
                  onMouseEnter={() => !leaving && setActive(i)}
                >
                  <div>
                    <div
                      className={`flex justify-between gap-4 px-4 py-2 transition-colors ${
                        isAdded ? "cursor-default" : "cursor-pointer"
                      } ${!leaving && i === active ? (isAdded ? "bg-slate-50" : "bg-blue-50") : ""}`}
                    >
                      {/* By symbol: the symbol first, then the name. By name: the name
                          first, the matched part picked out, then the symbol. */}
                      {byName ? (
                        <span className="min-w-0 truncate font-semibold text-slate-900">
                          <Highlighted name={row.match.name ?? row.match.symbol} text={query.trim()} />
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-900">{row.match.symbol}</span>
                      )}
                      <span className="flex min-w-0 shrink-0 items-center gap-3">
                        <span className="truncate text-slate-500">
                          {byName ? row.match.symbol : (row.match.name ?? "")}
                        </span>
                        {isAdded && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Added
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="picker-collapse" data-closed={noMatches && !searching ? undefined : ""}>
            <div>
              <p className="px-4 py-2 text-sm text-slate-500">
                {byName
                  ? <>No {etfsOnly ? "ETFs" : "companies or ETFs"} have &ldquo;{query.trim()}&rdquo; in their name.</>
                  : <>No {etfsOnly ? "ETFs" : "companies or ETFs"} start with &ldquo;{query.trim()}&rdquo;.</>}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
