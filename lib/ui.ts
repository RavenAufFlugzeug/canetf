// The site's shared looks for its buttons, text fields, links, titles, tags and small labels,
// so each kind looks and moves the same wherever it is. (Its switches are a component:
// components/SlideTabs.tsx.) Each is a class string, to which a caller adds its own layout
// (width, margins, `group`).

// One height for every control of a size, whatever kind it is (a button, a text field, a
// menu, a switch), so any of them can sit side by side and line up: xs for a compact toolbar
// (the Sandbox's investment universe), sm the usual, lg for a form's own fields and submit.
// Heights are set, not left to padding, as the browser draws menus its own way.
//
// Corners: boxes everywhere, never pills. Circles only for: a pop-up's close button, the icon
// beside a pop-up's title, a numbered list's numbers, every sector badge (a sector's mark on
// its NAICS colour, wherever it is: components/KindBadge.tsx and those drawn like it) and the
// NAICS colours in a key, and true circles in a picture (a chart's point). Otherwise one radius for each kind of thing, by its size:
//   rounded-xs (2px)   bars, dots, colour swatches and flag images (12px or less)
//   rounded-sm (4px)   tags, counts, chips and small icon boxes (up to 20px)
//   rounded-md (6px)   other small boxes (24 to 32px), and a switch's options in its track
//   rounded-lg (8px)   every control (buttons, fields, menus, switches), tooltips, and tiles
//                      inside a panel
//   rounded-xl (12px)  panels inside a card, pop-ups, and cards and decks
//   rounded-2xl (16px) a page's cards (CARD)
export type ControlSize = "xs" | "sm" | "lg";
export const CONTROL_HEIGHT: Record<ControlSize, string> = { xs: "h-8", sm: "h-9", lg: "h-12" };

// The keyboard's outline, the same round everything that can be tabbed to: a grey ring just
// outside it, shown only when the keyboard (not a click) put the focus there.
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

// A button (or a link made to look like one): primary, dark, for the main thing to do;
// secondary, white with a border, for the rest. Pointed at, it lifts a little with a soft
// shadow and darkens (or lightens) a touch; pressed, it sinks back. One that can't be used is
// faded, unless it is busy (aria-busy) working on a click, when it stays as it was with the
// waiting cursor. Its size is a control size (CONTROL_HEIGHT).
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

const BUTTON_SIZES: Record<ControlSize, string> = {
  xs: `${CONTROL_HEIGHT.xs} px-3 text-xs`,
  sm: `${CONTROL_HEIGHT.sm} px-4 text-sm`,
  lg: `${CONTROL_HEIGHT.lg} px-6`,
};

export function button(tone: keyof typeof BUTTON_TONES = "primary", size: ControlSize = "sm") {
  return `${BUTTON_BASE} ${BUTTON_TONES[tone]} ${BUTTON_SIZES[size]}`;
}

// A button that removes or deletes something (a watch-list entry, a strategy's deck, card or
// condition), as the Watch List's Remove is: quiet grey words that turn red, on a pale red
// ground, when pointed at, so it never draws the eye until it's wanted. One waiting for a
// second click to confirm adds REMOVE_ARMED.
export const REMOVE_BUTTON = `rounded-md px-2 py-1 text-sm text-slate-500 transition-colors duration-500 ease-out hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none ${FOCUS_RING}`;
export const REMOVE_ARMED = "bg-red-50 text-red-600";

// A text field (or a menu): a grey border that darkens when pointed at, and when typed in
// turns dark with a soft ring around it. Its size is a control size (CONTROL_HEIGHT): lg for
// a form's fields and the search box, sm for fields in a row of others (the strategy
// builder's), xs in a compact toolbar.
const FIELD_BASE =
  "rounded-lg border border-slate-300 bg-white text-slate-900 transition-[border-color,box-shadow] duration-200 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

const FIELD_SIZES: Record<ControlSize, string> = {
  xs: `${CONTROL_HEIGHT.xs} px-2.5 text-sm`,
  sm: `${CONTROL_HEIGHT.sm} px-2.5 text-sm`,
  lg: `${CONTROL_HEIGHT.lg} px-3`,
};

export function field(size: ControlSize = "sm") {
  return `${FIELD_BASE} ${FIELD_SIZES[size]}`;
}

// A white card on the page (components/Page.tsx): each page's main panels. CARD_COMPACT, with
// less padding, for the smaller panels laid side by side (the strategy builder's).
export const CARD = "rounded-2xl bg-white p-8 shadow";
export const CARD_COMPACT = "rounded-2xl bg-white p-6 shadow";

// A link in running text (or round what it names): an underline, light until pointed at.
// Words in a sentence add LINK_TEXT, so they stand out from it.
export const LINK = `rounded-sm underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900 ${FOCUS_RING}`;
export const LINK_TEXT = `${LINK} font-semibold text-slate-900`;

// A small tag in capitals (OPEN, EDITING, a card's BUY or SELL, the pick being traded): its
// own height, the capitals centred in it (trimmed to their height where the browser can, so
// the room kept for letters below the line doesn't push them up). TAG is dark; TAG_SHAPE is
// for a tag in colours of its own.
export const TAG_SHAPE =
  "inline-flex h-4 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-1.5 text-[9px] leading-none font-bold uppercase tracking-wide [text-box:trim-both_cap_alphabetic]";
export const TAG = `${TAG_SHAPE} bg-slate-900 text-white`;

// An empty list's message, in a dashed box where the list would be ("No trades yet.").
export const EMPTY_STATE = "rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500";

// A dashed space the shape of a card or deck: one that's empty, or one to add another in.
export const CARD_SLOT =
  "grid place-items-center rounded-xl border-2 border-dashed border-slate-300 text-center text-slate-400";

// Titles: a page's own (its h1), and a section's or a pop-up's.
export const PAGE_TITLE = "text-2xl font-bold text-slate-900";
export const SECTION_TITLE = "text-lg font-semibold text-slate-900";

// A small label in capitals over (or beside) what it names: a filter, a group of fields.
export const LABEL = "text-xs font-semibold uppercase tracking-wide text-slate-500";

// The same, darker, as the title of a small panel ("In plain words", the legend's parts).
export const PANEL_TITLE = "text-xs font-semibold uppercase tracking-wide text-slate-900";
