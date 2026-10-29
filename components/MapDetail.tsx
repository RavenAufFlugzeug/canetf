"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CLOSE_MS = 500; // matches .detail-fold in globals.css

type Props = {
  name: string;
  symbol: string;
  badge?: React.ReactNode; // its badge (KindBadge), before its name
  closeHref: string; // the map's address without this product
  children: React.ReactNode; // its chart, key figures and composition
};

// The details under the Holdings Map for the product that was last clicked. It scrolls
// into view when it appears; Close fades it and folds it shut before it is removed.
export default function MapDetail({ name, symbol, badge, closeHref, children }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }, []);

  function close() {
    if (closing) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing(true);
    // The page drops the details once the address changes, after they have folded away.
    setTimeout(() => router.replace(closeHref, { scroll: false }), still ? 0 : CLOSE_MS);
  }

  return (
    <div ref={ref} className="detail-fold scroll-mt-6" data-closed={closing ? "" : undefined} inert={closing}>
      <div>
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="mx-auto max-w-2xl">
            <div className="rise-in flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {badge}
                <p className="text-lg font-semibold text-slate-900">
                  {/* Name, then the ticker on its own line, so a long name never splits them. */}
                  {name}
                  <span className="block text-base font-normal text-slate-500">{symbol}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition duration-200 ease-out hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm active:scale-95 active:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="size-3 transition-transform duration-300 ease-out motion-safe:group-hover:rotate-90"
                >
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
                Close
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
