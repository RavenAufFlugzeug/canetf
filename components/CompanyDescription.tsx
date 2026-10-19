// A company's description in its About section: the opening of Yahoo Finance's business
// summary, which says what the company does, in whole sentences only, so it never ends
// part-way through one: its first sentence, then as many of the next as still fit within
// FITS characters (about three lines of the section), so there is nothing to expand or
// read at length. Every company's first sentence is short enough to fit in four lines.
const FITS = 240;

// Abbreviations a full stop doesn't end a sentence after ("Inc.", "U.S.", "No.").
const ABBREVIATION = /\b(?:[A-Z]|Inc|Ltd|Corp|Co|No|St|Mr|Ms|Dr|Jr|Sr|vs|etc|approx)\.$/;

// The text's sentences, in order.
function sentences(text: string): string[] {
  const found: string[] = [];
  let start = 0;
  // Each place a sentence might end: a full stop, question or exclamation mark, then space
  // and a capital letter or digit.
  for (const match of text.matchAll(/[.!?](?=\s+[A-Z0-9])/g)) {
    const end = match.index + 1;
    if (ABBREVIATION.test(text.slice(Math.max(0, end - 12), end))) continue;
    found.push(text.slice(start, end).trim());
    start = end;
  }
  found.push(text.slice(start).trim());
  return found.filter(Boolean);
}

// The first sentence, and each one after it that still fits within FITS characters.
function opening(text: string): string {
  const [first, ...rest] = sentences(text);
  let shown = first ?? "";
  for (const sentence of rest) {
    if (shown.length + 1 + sentence.length > FITS) break;
    shown += ` ${sentence}`;
  }
  return shown;
}

export default function CompanyDescription({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-slate-600">{opening(text)}</p>;
}
