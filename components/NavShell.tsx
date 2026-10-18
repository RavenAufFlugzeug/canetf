"use client";

import { useSyncExternalStore } from "react";

// The navbar's outer element, which knows whether the page has been scrolled. At the top
// of the page its links show their labels; once scrolled, `data-scrolled` folds them away
// to their icons (.nav-label in globals.css), each opening again while pointed at.
function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const isScrolled = () => window.scrollY > 8;

export default function NavShell({
  className,
  style,
  children,
}: {
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  // The server renders the top of the page: labels open.
  const scrolled = useSyncExternalStore(subscribe, isScrolled, () => false);
  return (
    <nav className={className} style={style} data-scrolled={scrolled ? "" : undefined}>
      {children}
    </nav>
  );
}
