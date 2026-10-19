"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoMark from "@/components/LogoMark";

// The navbar's logo: the open box, by the site's name, linking home. Pointed at, the box's
// cat peeks out, ears first. Clicked, her whole head comes out (data-peek); clicked again,
// she gets cross, an angry mark popping up by her head (data-angry). A click on another page
// goes home straight away; the navbar stays in place as the page changes (it is built once,
// in the site's layout), so she stays as she was. All of it goes back only when the pointer
// leaves (.logo-mark-* in globals.css). The name folds away like the links' labels once the
// page is scrolled, and opens again while the logo is pointed at (.nav-label in globals.css).
export default function NavLogo() {
  // How many times it has been clicked since the pointer came over it, up to two.
  const [clicks, setClicks] = useState(0);
  const pathname = usePathname();

  function onClick(event: React.MouseEvent) {
    // Opening the link elsewhere (a new tab or window) is left to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setClicks((n) => Math.min(n + 1, 2));
    // Already home: just the cat, no reload of the page.
    if (pathname === "/") event.preventDefault();
  }

  return (
    <Link
      href="/"
      className="group flex items-center font-bold text-xl"
      data-peek={clicks >= 1 ? "" : undefined}
      data-angry={clicks >= 2 ? "" : undefined}
      onClick={onClick}
      onMouseLeave={() => setClicks(0)}
    >
      <LogoMark id="logo-mark-nav" className="size-[44px]" />
      <span className="nav-label">
        <span>
          <span className="nav-label-text">LitterBox</span>
        </span>
      </span>
    </Link>
  );
}
