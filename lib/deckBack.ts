// The designs a deck's card backs come in, each strategy choosing its own on the Strategies page:
// "classic" (the cat in her box), "tea-party" (the cat behind her cup of coffee) or "magic" (the
// cat with her book of spells).
export const DECK_BACKS = [
  { value: "classic", label: "Classic" },
  { value: "tea-party", label: "Teegesellschaft" },
  { value: "magic", label: "Hexerei" },
] as const;

export type DeckBackName = (typeof DECK_BACKS)[number]["value"];

export const DEFAULT_BACK: DeckBackName = "classic";
export const isDeckBack = (v: unknown): v is DeckBackName => DECK_BACKS.some((b) => b.value === v);

// The one design the account page used to choose for every deck, remembered in this browser: a
// deck kept from before each had its own still shows it.
const OLD_KEY = "canetf:deck-back";
export function oldDeckBack(): DeckBackName {
  try {
    const stored = localStorage.getItem(OLD_KEY);
    return isDeckBack(stored) ? stored : DEFAULT_BACK;
  } catch {
    return DEFAULT_BACK;
  }
}
