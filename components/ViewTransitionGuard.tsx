"use client";

import { useEffect } from "react";

// The site animates page changes with view transitions (app/template.tsx). A browser won't
// animate one while the tab is hidden (a reload from the dev server, or switching tabs as a
// page loads): it still makes the change, but rejects the transition with an
// InvalidStateError ("Transition was aborted because of invalid state. Document hidden"),
// which nothing catches, so it shows up as an uncaught error, in the console and in the dev
// server's log. So while the tab is hidden, a page change isn't asked to animate at all:
// it is made straight away and handed back as a finished transition with nothing to show,
// exactly what the browser would end up doing, but without the error. It renders nothing;
// the site's layout includes it once.
type Update = (() => unknown) | undefined;
type StartViewTransition = (arg?: Update | { update?: Update; types?: string[] }) => ViewTransition;

export default function ViewTransitionGuard() {
  useEffect(() => {
    const start = document.startViewTransition as StartViewTransition | undefined;
    if (!start) return;

    const guarded: StartViewTransition = function (arg) {
      if (document.visibilityState !== "hidden") return start.call(document, arg);
      // Hidden: make the change now, and report it as done, with no animation.
      const update = typeof arg === "function" ? arg : arg?.update;
      const updated = Promise.resolve().then(() => update?.());
      return {
        updateCallbackDone: updated,
        ready: updated.then(() => undefined),
        finished: updated.then(() => undefined),
        skipTransition: () => {},
        types: new Set(typeof arg === "object" && arg?.types ? arg.types : []),
      } as unknown as ViewTransition;
    };
    document.startViewTransition = guarded as typeof document.startViewTransition;
    return () => {
      document.startViewTransition = start as typeof document.startViewTransition;
    };
  }, []);
  return null;
}
