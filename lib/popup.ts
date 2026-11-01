// What every pop-up looks like (as the Sandbox's "Leave the test?" card first did): over the
// screen, the page dimmed a little and softly blurred behind it, the card white with a fine
// border and a soft shadow, rounded; it fades and rises in (.recap-in, .recap-card in
// globals.css), and fades and sinks away over POPUP_OUT_MS (.recap-out) when closed.
export const POPUP_OUT_MS = 260;

// The screen behind the card, as it comes or goes.
export const popupOverlay = (leaving: boolean) =>
  `fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/20 p-4 backdrop-blur-[3px] ${
    leaving ? "recap-out" : "recap-in"
  }`;

// The card itself (its width and padding are each pop-up's own).
export const POPUP_CARD = "recap-card w-full rounded-xl border border-slate-200 bg-white text-left shadow-xl";
