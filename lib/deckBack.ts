import { useSyncExternalStore } from "react";

// The deck back chosen on the account page, used by every deck and card back on the site:
// "classic" (the cat in her box) or "tea-party" (the cat behind her cup of coffee). It is
// remembered in this browser (localStorage), as Search's chart colours are.
export const DECK_BACKS = [
  { value: "classic", label: "Classic" },
  { value: "tea-party", label: "Tea Party" },
] as const;

export type DeckBackName = (typeof DECK_BACKS)[number]["value"];

const DEFAULT: DeckBackName = "classic";
const STORAGE_KEY = "canetf:deck-back";
const CHANGE_EVENT = "canetf:deck-back";
const isDeckBack = (v: string | null): v is DeckBackName => DECK_BACKS.some((b) => b.value === v);

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(CHANGE_EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function read(): DeckBackName {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDeckBack(stored) ? stored : DEFAULT;
  } catch {
    return DEFAULT; // storage blocked: just use the default
  }
}

export function saveDeckBack(back: DeckBackName) {
  try {
    localStorage.setItem(STORAGE_KEY, back);
  } catch {
    // Storage blocked: the choice lasts until the page is left.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// The back chosen in this browser. The server always renders the default; the stored choice
// applies once in the browser.
export const useDeckBack = () => useSyncExternalStore(subscribe, read, () => DEFAULT);
