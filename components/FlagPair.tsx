import { countryFlag, currencyName, flagOf } from "@/lib/fx";

// A currency pair's icon: its two currencies' flags as rounded squares, the one priced in front
// on the left, the one it is priced in tucked behind it on the right. When it, or anything
// round it marked `flag-hover`, is pointed at, the two slide apart and back, as if trading
// places (.flag-pair in globals.css). A currency with no flag shows its code instead.
export default function FlagPair({
  base,
  quote,
  className = "size-6",
}: {
  base: string;
  quote: string;
  className?: string; // each flag's size
}) {
  const coin = (code: string, back: boolean) => {
    const src = flagOf(code);
    return (
      <span
        className={`${back ? "flag-b -ml-2.5" : "flag-a relative z-10"} grid shrink-0 place-items-center overflow-hidden rounded-[28%] bg-slate-100 text-[8px] font-bold text-slate-700 ring-2 ring-white shadow-sm ${className}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          code
        )}
      </span>
    );
  };
  return (
    <span
      role="img"
      aria-label={`${currencyName(base)} and ${currencyName(quote)}`}
      className="flag-pair inline-flex shrink-0 items-center"
    >
      {coin(base, false)}
      {coin(quote, true)}
    </span>
  );
}

// One flag as a rounded square, as in the pair: a currency's (`code`), or the flag of the
// country named (`country`, as Yahoo writes where a company is based). Nothing for a
// country without a flag here.
export function Flag({
  code,
  country,
  className = "size-5",
}: {
  code?: string;
  country?: string | null;
  className?: string;
}) {
  const src = code ? flagOf(code) : countryFlag(country);
  if (!code && !src) return null;
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-[28%] bg-slate-100 text-[8px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        code
      )}
    </span>
  );
}

// Where a company is based, as the Search page's About has it: its country's flag, a small
// rectangle in the flag's own shape, set on the line's middle before the place; it stays still.
// Just the place for a country without a flag here.
export function BasedIn({ place, country }: { place: string; country: string | null | undefined }) {
  const src = countryFlag(country, true);
  return (
    <span className="inline-flex items-start gap-2">
      {src && (
        // On the first line's middle (a line is 20px; the flag 14px), even if the place wraps.
        <span className="mt-[3px] inline-block h-3.5 shrink-0 overflow-hidden rounded-[2px] shadow-sm ring-1 ring-slate-900/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG */}
          <img src={src} alt="" className="block h-full w-auto" />
        </span>
      )}
      <span>{place}</span>
    </span>
  );
}

// Where a company is based, its country's flag before it ("🇹🇼 Taipei, Taiwan").
export function Place({ place, country }: { place: string; country: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Flag country={country} className="size-3.5" />
      {place}
    </span>
  );
}
