"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

// The aliases the player has given a Sandbox set's picks, by symbol, shared by the pick cards
// (PickCards) and the test (SandboxTest), and kept in this browser for the set (by `setKey`),
// so a refresh keeps them. Set round both, keyed by the set, so a new set starts with none.
type Aliases = { aliases: Record<string, string>; setAlias: (symbol: string, alias: string) => void };

const AliasContext = createContext<Aliases | null>(null);
const LONGEST = 24;

export function AliasProvider({ setKey, children }: { setKey: string; children: React.ReactNode }) {
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const storeKey = `sandbox-aliases:${setKey}`;

  // Read just after the first render, so the server's page and the browser's agree.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storeKey) ?? "{}");
        if (saved && typeof saved === "object") setAliases(saved);
      } catch {
        // No storage, or nothing saved: no aliases.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [storeKey]);

  function setAlias(symbol: string, alias: string) {
    setAliases((all) => {
      const next = { ...all };
      const clean = alias.trim().slice(0, LONGEST);
      if (clean) next[symbol] = clean;
      else delete next[symbol];
      try {
        window.localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {
        // Kept for this visit only.
      }
      return next;
    });
  }

  return <AliasContext.Provider value={{ aliases, setAlias }}>{children}</AliasContext.Provider>;
}

export function useAliases() {
  const value = useContext(AliasContext);
  return value ?? { aliases: {} as Record<string, string>, setAlias: () => {} };
}

// A pick's name, or the alias given it; and while aliases can be given (`editable`: once the
// test has started), a pill beside it saying so ("Add alias", or "Rename" once it has one),
// which turns the name into a box: Enter or leaving it saves, Escape cancels, and an empty
// box puts the pick's own name back. Pointed at, the pill darkens and its pencil tilts.
export function AliasName({
  symbol,
  name,
  editable = true,
  className = "",
}: {
  symbol: string;
  name: string;
  editable?: boolean;
  className?: string;
}) {
  const { aliases, setAlias } = useAliases();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const shown = aliases[symbol] ?? name;

  useEffect(() => {
    if (editing) box.current?.select();
  }, [editing]);

  if (!editable) {
    return (
      <span key={shown} className={`text-fade-in min-w-0 break-words ${className}`}>
        {shown}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={box}
        value={draft}
        maxLength={LONGEST}
        aria-label={`Alias for ${name}`}
        placeholder={name}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            setAlias(symbol, draft);
            setEditing(false);
          } else if (e.key === "Escape") setEditing(false);
        }}
        onBlur={() => {
          setAlias(symbol, draft);
          setEditing(false);
        }}
        className={`text-fade-in w-full min-w-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-slate-900 outline-none focus:border-slate-500 ${className}`}
      />
    );
  }

  return (
    <span className={`group/alias inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <span key={shown} className="text-fade-in min-w-0 break-words">
        {shown}
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-label={aliases[symbol] ? `Rename ${shown}` : `Give ${shown} an alias`}
        title={aliases[symbol] ? "Rename it" : "Give it an alias of your own"}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(aliases[symbol] ?? "");
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(aliases[symbol] ?? "");
            setEditing(true);
          }
        }}
        className="group/pen inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-3 transition-transform duration-300 ease-[cubic-bezier(0.3,1.6,0.5,1)] group-hover/pen:-rotate-12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.5 3.5 12.5 5.5M3 13l.6-2.6L11 3a1.4 1.4 0 0 1 2 2l-7.4 7.4Z" />
        </svg>
        {aliases[symbol] ? "Rename" : "Add alias"}
      </span>
    </span>
  );
}
