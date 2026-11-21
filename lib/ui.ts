// The site's shared looks for its buttons, text fields and small labels, so each kind looks
// and moves the same wherever it is. (Its switches are a component: components/SlideTabs.tsx.)
// Each is a class string, to which a caller adds its own layout (width, margins, `group`).

// The keyboard's outline, the same round everything that can be tabbed to: a grey ring just
// outside it, shown only when the keyboard (not a click) put the focus there.
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

// A button (or a link made to look like one): primary, dark, for the main thing to do;
// secondary, white with a border, for the rest. Pointed at, it lifts a little with a soft
// shadow and darkens (or lightens) a touch; pressed, it sinks back. One that can't be used is
// faded, unless it is busy (aria-busy) working on a click, when it stays as it was with the
// waiting cursor. sm for toolbars and small panels, md the usual, lg for a form's submit.
const BUTTON_BASE =
  `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-300 ease-out ${FOCUS_RING} motion-safe:not-disabled:hover:-translate-y-0.5 not-disabled:active:translate-y-0 not-disabled:active:shadow-sm disabled:not-aria-busy:opacity-40 aria-busy:cursor-wait`;

const BUTTON_TONES = {
  primary:
    "bg-slate-900 text-white shadow-sm not-disabled:hover:bg-slate-800 not-disabled:hover:shadow-lg not-disabled:hover:shadow-slate-900/25",
  secondary:
    "border border-slate-200 bg-white text-slate-900 not-disabled:hover:border-slate-300 not-disabled:hover:bg-slate-50 not-disabled:hover:shadow-md not-disabled:hover:shadow-slate-300/60",
  // A secondary one that leaves (Exit): it reddens when pointed at.
  leave:
    "border border-slate-200 bg-white text-slate-900 not-disabled:hover:border-red-300 not-disabled:hover:bg-red-50/40 not-disabled:hover:text-red-700 not-disabled:hover:shadow-md not-disabled:hover:shadow-red-200/60",
  // A primary one once what it does is done (a trade confirmed).
  done: "bg-green-700 text-white shadow-sm",
} as const;

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3",
} as const;

export function button(tone: keyof typeof BUTTON_TONES = "primary", size: keyof typeof BUTTON_SIZES = "md") {
  return `${BUTTON_BASE} ${BUTTON_TONES[tone]} ${BUTTON_SIZES[size]}`;
}

// A text field (or a menu): a grey border that darkens when pointed at, and when typed in
// turns dark with a soft ring around it. md for forms and the search box, sm for fields
// in a row of others (the strategy builder's).
const FIELD_BASE =
  "rounded-lg border border-slate-300 bg-white text-slate-900 transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

const FIELD_SIZES = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "p-3",
} as const;

export function field(size: keyof typeof FIELD_SIZES = "md") {
  return `${FIELD_BASE} ${FIELD_SIZES[size]}`;
}

// A white card on the page (components/Page.tsx): each page's main panels. CARD_COMPACT, with
// less padding, for the smaller panels laid side by side (the strategy builder's).
export const CARD = "rounded-2xl bg-white p-8 shadow";
export const CARD_COMPACT = "rounded-2xl bg-white p-6 shadow";

// A small label in capitals over (or beside) what it names: a filter, a group of fields.
export const LABEL = "text-xs font-semibold uppercase tracking-wide text-slate-500";

// The same, darker, as the title of a small panel ("In plain words", the legend's parts).
export const PANEL_TITLE = "text-xs font-semibold uppercase tracking-wide text-slate-900";
