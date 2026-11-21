"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/Icons";
import { button, SECTION_TITLE } from "@/lib/ui";

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
                <p className={SECTION_TITLE}>
                  {/* Name, then the ticker on its own line, so a long name never splits them. */}
                  {name}
                  <span className="block text-base font-normal text-slate-500">{symbol}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className={`group shrink-0 gap-1.5 ${button("secondary", "xs")}`}
              >
                <CloseIcon className="size-3 transition-transform duration-300 ease-out motion-safe:group-hover:rotate-90" />
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
