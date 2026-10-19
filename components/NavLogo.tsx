"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LogoMark from "@/components/LogoMark";

// The lid's front flap's angle (degrees) for each state: closed, lifted a little as the
// cat peeks, and fallen right open once she is out (see LogoMark).
const LID = { closed: 0, peeking: 40, open: 200 };

// How the lid swings to a new angle: a spring, a little lively, so it overshoots slightly
// and settles (stiffness and damping per second, for a unit mass).
const STIFFNESS = 180;
const DAMPING = 17;

// The navbar's logo: the box, by the site's name, linking home. Pointed at (or tabbed to),
// the box's lid lifts a little and its cat peeks out, ears first. Clicked, the lid falls
// open and her whole head comes out (data-peek); clicked again, she gets cross, an angry
// mark popping up by her head (data-angry). A click on another page goes home straight
// away; the navbar stays in place as the page changes (it is built once, in the site's
// layout), so she stays as she was. All of it goes back only when the pointer leaves
// (.logo-mark-* in globals.css; the lid's angle is sprung here). The name folds away like
// the links' labels once the page is scrolled, and opens again while the logo is pointed
// at (.nav-label in globals.css).
export default function NavLogo() {
  // How many times it has been clicked since the pointer came over it, up to two.
  const [clicks, setClicks] = useState(0);
  const [pointedAt, setPointedAt] = useState(false);
  const pathname = usePathname();
  const target = clicks >= 1 ? LID.open : pointedAt ? LID.peeking : LID.closed;

  // The lid's angle as it swings, and how fast, sprung towards the target each frame.
  const [lid, setLid] = useState(LID.closed);
  const angle = useRef(LID.closed);
  const speed = useRef(0);

  useEffect(() => {
    // With reduced motion, the lid goes straight to where it is going.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      angle.current = target;
      speed.current = 0;
      const frame = requestAnimationFrame(() => setLid(target));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const force = STIFFNESS * (target - angle.current) - DAMPING * speed.current;
      speed.current += force * dt;
      angle.current += speed.current * dt;
      const settled = Math.abs(target - angle.current) < 0.2 && Math.abs(speed.current) < 0.5;
      if (settled) {
        angle.current = target;
        speed.current = 0;
      }
      setLid(angle.current);
      if (!settled) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

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
      className="group flex items-center font-bold text-xl text-slate-950"
      data-peek={clicks >= 1 ? "" : undefined}
      data-angry={clicks >= 2 ? "" : undefined}
      onClick={onClick}
      onMouseEnter={() => setPointedAt(true)}
      onMouseLeave={() => {
        setPointedAt(false);
        setClicks(0);
      }}
      onFocus={() => setPointedAt(true)}
      onBlur={() => setPointedAt(false)}
    >
      {/* Larger than the bar's other icons; its negative margins keep the bar its height. */}
      <LogoMark id="logo-mark-nav" lid={lid} className="-my-2 size-[68px]" />
      <span className="nav-label">
        <span>
          <span className="nav-label-text">LitterBox</span>
        </span>
      </span>
    </Link>
  );
}
