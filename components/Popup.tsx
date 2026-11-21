"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { POPUP_CARD, POPUP_OUT_MS, popupOverlay } from "@/lib/popup";

// Everything focusable inside the card, for keeping Tab within it.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The site's one modal pop-up, in every pop-up's look (lib/popup.ts): over the screen (a
// portal, so it is in view wherever the page is scrolled), the page dimmed and blurred behind
// it. It is a modal dialog to screen readers; while it is open, Tab and Shift+Tab go round its
// own controls only. It opens with the keyboard on `initialFocus` (else on the card itself),
// without jumping the page, and when it goes, the keyboard goes back to where it was before.
// Escape, or a click beside the card (pressed and let go there, so dragging out of a field
// doesn't close it), calls onClose. `leaving` plays its way out; whoever shows it unmounts it
// once that is done (usePopupClose does both for a pop-up that closes itself).
export default function Popup({
  label,
  leaving = false,
  onClose,
  initialFocus,
  className = "",
  overlayClassName = "",
  children,
}: {
  label: string; // what it is, for screen readers
  leaving?: boolean;
  onClose: () => void;
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string; // its width and padding, and any look of its own
  overlayClassName?: string;
  children: React.ReactNode;
}) {
  const card = useRef<HTMLDivElement>(null);
  // Whether the pointer went down beside the card, not on it.
  const downBeside = useRef(false);
  // The latest onClose, so the Escape listener needn't be added again on every render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    (initialFocus?.current ?? card.current)?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
    // Once, when it opens.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab from the last control goes round to the first, and Shift+Tab from the first to the last.
  function trap(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !card.current) return;
    const all = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (all.length === 0) {
      e.preventDefault();
      return;
    }
    const first = all[0];
    const last = all[all.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === card.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className={`${popupOverlay(leaving)} ${overlayClassName}`}
      onPointerDown={(e) => (downBeside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downBeside.current && e.target === e.currentTarget) onClose();
        downBeside.current = false;
      }}
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={trap}
        className={`${POPUP_CARD} outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// For a pop-up that closes itself (Icons, a holding's chart, a provider): `close` plays its
// way out (`leaving`), then calls onClosed, at once when motion is reduced; asked again while
// it goes, it does nothing more.
export function usePopupClose(onClosed: () => void) {
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setLeaving(true);
    window.setTimeout(onClosed, calm ? 0 : POPUP_OUT_MS);
  };
  return { leaving, close };
}
