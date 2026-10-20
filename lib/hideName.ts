// Hides which company a text is about, for the Sandbox: every mention of its name, as
// written in full ("Teck Resources Limited", "The Toronto-Dominion Bank"), without its
// legal suffix or a leading "The" ("Teck Resources", "Toronto-Dominion Bank"), or by its
// ticker ("TD" for TD.TO, "TECK" for TECK-B.TO), becomes `mask`. So does the name's first
// word on its own when it is distinctive ("Apple Watch", "Brookfield Asset Management"),
// but not a generic one (COMMON). Possessives keep their "'s" ("???'s"). Product and
// brand names that don't share the name (Optum, Enbrel) are left as they are.
const SUFFIX =
  /[\s,]+(?:Inc|Incorporated|Corp|Corporation|Company|Companies|Co|Ltd|Limited|plc|LLC|L\.?P|S\.?A|AG|N\.?V|SE|Holdings?|Group)\.?$/i;

// First words of names that are ordinary words in a description too.
const COMMON = new Set(
  ("bank canadian american first national general international united royal great north " +
    "south east west northern southern eastern western new pacific atlantic global power " +
    "energy capital financial gold silver real advanced applied digital health medical " +
    "public premium select core enhanced")
    .split(/\s+/),
);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The ways the name may be written, longest first so a full name goes before its parts.
function spellings(name: string): string[] {
  const out = new Set<string>();
  for (let n = name.trim(); n; ) {
    out.add(n);
    out.add(n.replace(/^The\s+/i, ""));
    const shorter = n.replace(SUFFIX, "");
    if (shorter === n) break;
    n = shorter;
  }
  const first = name.trim().replace(/^The\s+/i, "").split(/[\s,]+/)[0];
  if (first.length > 3 && !COMMON.has(first.toLowerCase())) out.add(first);
  // Too short to be anything but a ticker-like word, which is handled below.
  return [...out].filter((s) => s.length > 2).sort((a, b) => b.length - a.length);
}

export function hideName(text: string, name: string | null, symbol: string, mask = "???"): string {
  let out = text;
  // A name at the start of a word, with its capitals as written, so the brands made from
  // it go too (AppleCare -> ???Care, Loblaws -> ???s) but "revolutionary" isn't touched.
  const names = name ? spellings(name) : [];
  if (names.length) {
    out = out.replace(new RegExp(names.map((s) => `(?<![\\w&])${escape(s)}`).join("|"), "g"), mask);
  }
  // The ticker without its exchange suffix or share class, in capitals, as a word of its
  // own, so "TD" doesn't touch "STD".
  const ticker = symbol.split(/[.-]/)[0];
  if (ticker.length >= 2) {
    out = out.replace(new RegExp(`(?<![\\w&])${escape(ticker)}(?![\\w&])`, "g"), mask);
  }
  return out;
}
