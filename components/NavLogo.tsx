"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LogoMark from "@/components/LogoMark";
import { MoonMark } from "@/components/TestMarks";
import { POPUP_CARD, POPUP_OUT_MS, popupOverlay } from "@/lib/popup";

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
// mark popping up by her head (data-angry). A click on another page first asks, in a pop-up
// (HomeCard), whether to go home, as what is not saved there will be lost; only once that is
// confirmed does it go. The navbar stays in place as the page changes (it is built once, in
// the site's layout), so she stays as she was. All of it goes back only when the pointer leaves
// (.logo-mark-* in globals.css; the lid's angle is sprung here). The name folds away like
// the links' labels once the page is scrolled, and opens again while the logo is pointed
// at (.nav-label in globals.css).
export default function NavLogo() {
  // How many times it has been clicked since the pointer came over it, up to two.
  const [clicks, setClicks] = useState(0);
  const [pointedAt, setPointedAt] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // The pop-up asking before going home: whether it is up, and whether it is fading away.
  const [asking, setAsking] = useState(false);
  const [askLeaving, setAskLeaving] = useState(false);
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
    event.preventDefault();
    // Already home: just the cat, no reload of the page. Elsewhere: first, ask.
    if (pathname !== "/" && !asking) setAsking(true);
  }

  // The pop-up fades away; then, if going home was confirmed, home.
  function answer(home: boolean) {
    if (askLeaving) return;
    setAskLeaving(true);
    window.setTimeout(() => {
      setAsking(false);
      setAskLeaving(false);
      if (home) router.push("/");
    }, POPUP_OUT_MS);
  }

  return (
    <>
      <Link
        href="/"
        className="group flex items-center font-bold text-xl text-slate-950"
        data-pointed={pointedAt ? "" : undefined}
        data-peek={clicks >= 1 ? "" : undefined}
        data-angry={clicks >= 2 ? "" : undefined}
        onClick={onClick}
        onMouseEnter={() => setPointedAt(true)}
        // (Moving over it too: during and after a page change the browser may not tell it the
        // pointer came in. The cat peeks by the same (data-pointed), so she and the lid go together.)
        onMouseMove={() => setPointedAt(true)}
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
      {asking && <HomeCard leaving={askLeaving} onDone={answer} />}
    </>
  );
}

// The pop-up asking before going home (from the logo, on any other page), in every pop-up's
// style (lib/popup.ts), coming and going as the Sandbox's day recap does, with the same moon
// (its stars twinkling): home is where it will
// go, and what is not saved on this page (a test under way, a strategy not saved) will be lost.
// Stay here (or Escape, or a click beside it) closes it; Go home goes.
function HomeCard({ leaving, onDone }: { leaving: boolean; onDone: (home: boolean) => void }) {
  const stay = useRef<HTMLButtonElement>(null);

  // Ready for the keyboard (on the safe choice), without jumping the page.
  useEffect(() => {
    stay.current?.focus({ preventScroll: true });
  }, []);

  return createPortal(
    <div
      className={popupOverlay(leaving)}
      onClick={() => onDone(false)}
      onKeyDown={(e) => e.key === "Escape" && onDone(false)}
    >
      <div
        role="dialog"
        aria-label="Go back home?"
        className={`${POPUP_CARD} max-w-sm overflow-hidden p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="test-mark-live grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-900">
            <MoonMark className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leaving this page</p>
            <p className="text-lg font-semibold text-slate-900">Go back home?</p>
          </div>
        </div>
        <p className="rise-in mt-4 text-sm text-slate-600" style={{ animationDelay: "100ms" }}>
          You&apos;ll be taken back to the home page.
        </p>
        <p className="rise-in mt-2 text-sm text-slate-600" style={{ animationDelay: "170ms" }}>
          Anything you haven&apos;t saved here, such as a test under way, won&apos;t be kept.
        </p>
        <div className="rise-in mt-5 flex gap-2" style={{ animationDelay: "240ms" }}>
          <button ref={stay} type="button" onClick={() => onDone(false)} className={`${DARK} flex-1`}>
            Stay here
          </button>
          <button type="button" onClick={() => onDone(true)} className={`${LIGHT} flex-1`}>
            Go home
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// The pop-up's buttons, as the Sandbox's pop-ups have them: pointed at, each lifts a little
// with a soft shadow; pressed, it sinks a touch.
const BUTTON =
  "inline-flex justify-center rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 ease-out hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]";
const DARK = `${BUTTON} bg-slate-900 text-white hover:bg-slate-700`;
const LIGHT = `${BUTTON} border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50`;
