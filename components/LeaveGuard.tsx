"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Popup from "@/components/Popup";
import { testUnderway } from "@/components/SandboxStage";
import { ExitMark, WarnMark } from "@/components/TestMarks";
import { POPUP_OUT_MS } from "@/lib/popup";
import { button, SECTION_TITLE } from "@/lib/ui";

// Asks before a Sandbox test under way is left, however it is left. Built once, in the
// site's layout, round every page.
//  - A link to another page of the site (the navbar's, the logo's, one on the page), or a form
//    that leaves the page (one marked data-leaves-page: the navbar's Log out): it is held,
//    and a card asks first, as the test's own Exit does; Leave goes on with it.
//  - Reloading, closing the tab, or going to another site: the browser's own question (it
//    allows no other).
// A link opened elsewhere (a new tab, say) leaves the test as it is, so it isn't asked about.
export default function LeaveGuard() {
  const router = useRouter();
  // What was held (going on to the link's page, or sending the form), while the card asks;
  // and whether the card is going away.
  const [going, setGoing] = useState<{ go: () => void } | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Set while a held form is sent again on Leave, so it isn't held a second time.
  const letThrough = useRef(false);

  useEffect(() => {
    // Before the page's own handlers (Next's Link among them), so a held click goes nowhere.
    function onClick(e: MouseEvent) {
      if (!testUnderway()) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const to = new URL(link.href, location.href);
      // Another site: the browser asks (beforeunload, below). The same page: nothing is left.
      if (to.origin !== location.origin) return;
      if (to.pathname === location.pathname && to.search === location.search) return;
      e.preventDefault();
      const path = to.pathname + to.search + to.hash;
      setGoing({ go: () => router.push(path) });
    }
    // A form that leaves the page, held before React sends it (it sends none already held).
    function onSubmit(e: SubmitEvent) {
      const form = e.target;
      if (!testUnderway() || letThrough.current) return;
      if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-leaves-page")) return;
      e.preventDefault();
      const submitter = e.submitter instanceof HTMLElement ? e.submitter : null;
      setGoing({
        go: () => {
          letThrough.current = true;
          form.requestSubmit(submitter);
          letThrough.current = false;
        },
      });
    }
    function onUnload(e: BeforeUnloadEvent) {
      if (!testUnderway()) return;
      e.preventDefault();
      e.returnValue = ""; // older browsers ask only when this is set
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [router]);

  // The card goes away; then, if leaving was chosen, on with what was held.
  function answer(leave: boolean) {
    if (leaving || !going) return;
    const held = going;
    setLeaving(true);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        setGoing(null);
        setLeaving(false);
        if (leave) held.go();
      },
      calm ? 0 : POPUP_OUT_MS,
    );
  }

  return going ? <LeaveCard leaving={leaving} onDone={answer} /> : null;
}

// The card, in the look of the test's own "Leave the test?": its warning, that the test won't
// be kept, and Stay (the keyboard's, and Escape's, or a click beside it) or Leave.
function LeaveCard({ leaving, onDone }: { leaving: boolean; onDone: (leave: boolean) => void }) {
  const stay = useRef<HTMLButtonElement>(null);

  return (
    <Popup
      label="Leave?"
      leaving={leaving}
      onClose={() => onDone(false)}
      initialFocus={stay}
      className="max-w-sm overflow-hidden p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          <WarnMark className="warn-pop size-5" />
        </span>
        <p className={SECTION_TITLE}>Leave?</p>
      </div>
      <p className="rise-in mt-4 text-sm text-slate-600" style={{ animationDelay: "100ms" }}>
        Your progress won&apos;t be saved
      </p>
      <div className="rise-in mt-5 flex gap-2" style={{ animationDelay: "170ms" }}>
        <button ref={stay} type="button" onClick={() => onDone(false)} className={`group flex-1 ${button("primary")}`}>
          Stay
        </button>
        <button type="button" onClick={() => onDone(true)} className={`group flex-1 ${button("leave")}`}>
          <ExitMark className="size-4" />
          Leave
        </button>
      </div>
    </Popup>
  );
}
