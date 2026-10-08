"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchCompanies } from "@/app/actions/companies";
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

// New results merged into what is on screen, kept in symbol order: options still
// matching stay put, missing ones start leaving, new ones enter one after another.
function merge(rows: Row[], results: CompanyMatch[]): Row[] {
  const now = Date.now();
  const bySymbol = new Map(results.map((m) => [m.symbol, m]));
  const onScreen = new Set(rows.map((r) => r.match.symbol));
  const kept = rows.map((r) => {
    const match = bySymbol.get(r.match.symbol);
    return match ? { ...r, match, leftAt: null } : { ...r, leftAt: r.leftAt ?? now };
  });
  const added = results
    .filter((m) => !onScreen.has(m.symbol))
    .map((match, i) => ({ match, leftAt: null, enterDelay: i * ENTER_STAGGER_MS }));
  return [...kept, ...added].sort((a, b) => a.match.symbol.localeCompare(b.match.symbol));
}

const leaveAll = (rows: Row[]) => rows.map((r) => ({ ...r, leftAt: r.leftAt ?? Date.now() }));

// Picks the company on display by writing ?symbol= to the URL; the page reads it back.
export default function CompanyPicker({ selected }: { selected: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const [query, setQuery] = useState(selected ?? "");
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
      const results = await searchCompanies(prefix);
      const rest = MIN_THINKING_MS - (Date.now() - started);
      if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
      if (id !== request.current) return; // the user has typed something newer

      setSearching(false);
      setNoMatches(results.length === 0);
      setRows((rs) => merge(rs, results));
      setActive(results.length ? 0 : -1);
      purgeSoon();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, open]);

  // The options that still match, in order; keyboard navigation moves through these.
  const live = rows.filter((r) => r.leftAt === null).map((r) => r.match);

  function choose(match: CompanyMatch) {
    setQuery(match.symbol);
    setOpen(false);
    dismiss();
    startNavigation(() => {
      router.replace(`${pathname}?symbol=${encodeURIComponent(match.symbol)}`, { scroll: false });
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
      <label htmlFor={`${listId}-input`} className="block text-sm font-medium text-slate-700">
        Company symbol
      </label>
      <div className="relative mt-1">
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. AAPL"
          value={query}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            const value = e.target.value.toUpperCase();
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
          className="w-full rounded-lg border p-3 uppercase text-slate-700"
        />
        {navigating && (
          <span
            role="status"
            aria-label="Loading"
            className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
          />
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
                <span className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                {searching ? "Searching…" : ""}
              </p>
            </div>
          </div>

          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto">
            {rows.map((row) => {
              const leaving = row.leftAt !== null;
              const i = leaving ? -1 : ++liveIndex;
              return (
                <li
                  key={row.match.symbol}
                  id={leaving ? undefined : `${listId}-${i}`}
                  role="option"
                  aria-selected={!leaving && i === active}
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
                      className={`flex cursor-pointer justify-between gap-4 px-4 py-2 transition-colors ${
                        !leaving && i === active ? "bg-blue-50" : ""
                      }`}
                    >
                      <span className="font-semibold text-slate-900">{row.match.symbol}</span>
                      <span className="truncate text-slate-500">{row.match.name ?? ""}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="picker-collapse" data-closed={noMatches && !searching ? undefined : ""}>
            <div>
              <p className="px-4 py-2 text-sm text-slate-500">
                No companies start with &ldquo;{query.trim()}&rdquo;.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
