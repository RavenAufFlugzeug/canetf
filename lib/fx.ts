// Exchange rates (search/fx.py stores them): Yahoo writes a pair as USDCAD=X, the price of
// one US dollar in Canadian dollars.

// Each currency's name, as search/fx.py names them.
const CURRENCY_NAMES: Record<string, string> = {
  CAD: "Canadian Dollar",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  CHF: "Swiss Franc",
  JPY: "Japanese Yen",
  AUD: "Australian Dollar",
  HKD: "Hong Kong Dollar",
  CNY: "Chinese Yuan",
  INR: "Indian Rupee",
  KRW: "South Korean Won",
  TWD: "New Taiwan Dollar",
  SGD: "Singapore Dollar",
  AED: "UAE Dirham",
  MXN: "Mexican Peso",
  NZD: "New Zealand Dollar",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  ZAR: "South African Rand",
  BRL: "Brazilian Real",
  ILS: "Israeli New Shekel",
};

export const currencyName = (code: string) => CURRENCY_NAMES[code] ?? code;

// A pair's two currencies: what is priced (base) and what it is priced in (quote), or null
// for a symbol that is no pair.
export function pairOf(symbol: string): { base: string; quote: string } | null {
  const m = /^([A-Z]{3})([A-Z]{3})=X$/.exec(symbol.toUpperCase());
  return m ? { base: m[1], quote: m[2] } : null;
}

// The flag each currency is shown with (public/flags, from the flag-icons set, MIT): its
// country's, or the European Union's for the euro.
const FLAGS: Record<string, string> = {
  CAD: "ca",
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  CHF: "ch",
  JPY: "jp",
  AUD: "au",
  HKD: "hk",
  CNY: "cn",
  INR: "in",
  KRW: "kr",
  TWD: "tw",
  SGD: "sg",
  AED: "ae",
  MXN: "mx",
  NZD: "nz",
  SEK: "se",
  NOK: "no",
  DKK: "dk",
  ZAR: "za",
  BRL: "br",
  ILS: "il",
};

export const flagOf = (code: string) => (FLAGS[code] ? `/flags/${FLAGS[code]}.svg` : null);

// Where each currency is used, so a less familiar one (the dirham, the won) is clear.
const USED_IN: Record<string, string> = {
  CAD: "Canada",
  USD: "United States",
  EUR: "Euro area (20 EU countries, incl. Germany, France, Italy)",
  GBP: "United Kingdom",
  CHF: "Switzerland and Liechtenstein",
  JPY: "Japan",
  AUD: "Australia",
  HKD: "Hong Kong",
  CNY: "China (mainland)",
  INR: "India",
  KRW: "South Korea",
  TWD: "Taiwan",
  SGD: "Singapore",
  AED: "United Arab Emirates",
  MXN: "Mexico",
  NZD: "New Zealand",
  SEK: "Sweden",
  NOK: "Norway",
  DKK: "Denmark",
  ZAR: "South Africa",
  BRL: "Brazil",
  ILS: "Israel",
};

export const usedIn = (code: string) => USED_IN[code] ?? null;

// The flag of a country by its name, as Yahoo Finance writes where a company is based
// ("United States", "Taiwan"), or null for one without a flag here (public/flags).
const COUNTRY_FLAGS: Record<string, string> = {
  Canada: "ca",
  "United States": "us",
  "United Kingdom": "gb",
  "United Arab Emirates": "ae",
  Taiwan: "tw",
  China: "cn",
  "Hong Kong": "hk",
  Switzerland: "ch",
  India: "in",
  Germany: "de",
  Bermuda: "bm",
  "South Korea": "kr",
  Japan: "jp",
  Italy: "it",
  Spain: "es",
  "South Africa": "za",
  Singapore: "sg",
  Netherlands: "nl",
  France: "fr",
  "Cayman Islands": "ky",
  Australia: "au",
  "New Zealand": "nz",
  Ireland: "ie",
  Luxembourg: "lu",
  Sweden: "se",
  Norway: "no",
  Denmark: "dk",
  Finland: "fi",
  Belgium: "be",
  Austria: "at",
  Israel: "il",
  Brazil: "br",
  Mexico: "mx",
};

// Square by default; `rect` for the flag's own 4:3 shape (public/flags/4x3).
export const countryFlag = (country: string | null | undefined, rect = false) =>
  country && COUNTRY_FLAGS[country] ? `/flags/${rect ? "4x3/" : ""}${COUNTRY_FLAGS[country]}.svg` : null;
