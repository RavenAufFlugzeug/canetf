"use client";

import { useLayoutEffect, useRef, useState } from "react";

// The pill behind a row's chosen option (the site's switches, SlideTabs, and the trade log's
// strip). Give `group` to the row and `pill` to the pill: the pill is put over the option in
// the row that matches `chosen` (a CSS selector), and moved there again whenever `key` changes
// (what is chosen, and what the options are) or the row changes size (its options wrapping,
// say). Its own CSS transition slides it; the first time it is simply put in place, rather
// than sliding in from the corner. `placed` says whether it has been put anywhere yet, so the
// chosen option can look chosen by itself until then (before the page has run its script).
export function useSlidingPill(chosen: string, key: string) {
  const group = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const box = group.current;
    const place = () => {
      const option = box?.querySelector<HTMLElement>(chosen);
      const el = pill.current;
      if (!option || !el) return;
      if (el.style.opacity !== "1") {
        el.style.transition = "none";
        requestAnimationFrame(() => (el.style.transition = ""));
      }
      el.style.transform = `translate(${option.offsetLeft}px, ${option.offsetTop}px)`;
      el.style.width = `${option.offsetWidth}px`;
      el.style.height = `${option.offsetHeight}px`;
      el.style.opacity = "1";
      setPlaced(true);
    };
    place();
    const watch = new ResizeObserver(place);
    if (box) watch.observe(box);
    return () => watch.disconnect();
    // Moved again only when what is chosen or offered changes (key), not on every render.
  }, [chosen, key]);

  return { group, pill, placed };
}
