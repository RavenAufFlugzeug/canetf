// Where a listing trades, from Yahoo Finance's exchange code (companies.exchange, stored
// by search/StockUtils.py), and the exchange's time zone (IANA). Covers the markets the
// database holds; an unknown code gets no line rather than a bare code.
export type Listing = { exchange: string; country: string; timeZone: string };

const EXCHANGES: Record<string, Listing> = {
  // United States
  NMS: { exchange: "Nasdaq", country: "United States", timeZone: "America/New_York" },
  NGM: { exchange: "Nasdaq", country: "United States", timeZone: "America/New_York" },
  NCM: { exchange: "Nasdaq", country: "United States", timeZone: "America/New_York" },
  NYQ: { exchange: "New York Stock Exchange", country: "United States", timeZone: "America/New_York" },
  PCX: { exchange: "NYSE Arca", country: "United States", timeZone: "America/New_York" },
  ASE: { exchange: "NYSE American", country: "United States", timeZone: "America/New_York" },
  BTS: { exchange: "Cboe BZX", country: "United States", timeZone: "America/New_York" },
  // Canada
  TOR: { exchange: "Toronto Stock Exchange", country: "Canada", timeZone: "America/Toronto" },
  VAN: { exchange: "TSX Venture Exchange", country: "Canada", timeZone: "America/Toronto" },
  NEO: { exchange: "Cboe Canada", country: "Canada", timeZone: "America/Toronto" },
  CNQ: { exchange: "Canadian Securities Exchange", country: "Canada", timeZone: "America/Toronto" },
  // Europe
  LSE: { exchange: "London Stock Exchange", country: "United Kingdom", timeZone: "Europe/London" },
  AMS: { exchange: "Euronext Amsterdam", country: "Netherlands", timeZone: "Europe/Amsterdam" },
  PAR: { exchange: "Euronext Paris", country: "France", timeZone: "Europe/Paris" },
  BRU: { exchange: "Euronext Brussels", country: "Belgium", timeZone: "Europe/Brussels" },
  MIL: { exchange: "Euronext Milan", country: "Italy", timeZone: "Europe/Rome" },
  GER: { exchange: "Xetra", country: "Germany", timeZone: "Europe/Berlin" },
  FRA: { exchange: "Frankfurt Stock Exchange", country: "Germany", timeZone: "Europe/Berlin" },
  EBS: { exchange: "SIX Swiss Exchange", country: "Switzerland", timeZone: "Europe/Zurich" },
  MCE: { exchange: "Bolsa de Madrid", country: "Spain", timeZone: "Europe/Madrid" },
  CPH: { exchange: "Nasdaq Copenhagen", country: "Denmark", timeZone: "Europe/Copenhagen" },
  STO: { exchange: "Nasdaq Stockholm", country: "Sweden", timeZone: "Europe/Stockholm" },
  HEL: { exchange: "Nasdaq Helsinki", country: "Finland", timeZone: "Europe/Helsinki" },
  OSL: { exchange: "Oslo Børs", country: "Norway", timeZone: "Europe/Oslo" },
  // Asia-Pacific
  JPX: { exchange: "Tokyo Stock Exchange", country: "Japan", timeZone: "Asia/Tokyo" },
  HKG: { exchange: "Hong Kong Stock Exchange", country: "Hong Kong", timeZone: "Asia/Hong_Kong" },
  KSC: { exchange: "Korea Exchange (KOSPI)", country: "South Korea", timeZone: "Asia/Seoul" },
  KOE: { exchange: "Korea Exchange (KOSDAQ)", country: "South Korea", timeZone: "Asia/Seoul" },
  TAI: { exchange: "Taiwan Stock Exchange", country: "Taiwan", timeZone: "Asia/Taipei" },
  TWO: { exchange: "Taipei Exchange", country: "Taiwan", timeZone: "Asia/Taipei" },
  ASX: { exchange: "Australian Securities Exchange", country: "Australia", timeZone: "Australia/Sydney" },
  NSI: { exchange: "National Stock Exchange of India", country: "India", timeZone: "Asia/Kolkata" },
  BSE: { exchange: "BSE", country: "India", timeZone: "Asia/Kolkata" },
  SES: { exchange: "Singapore Exchange", country: "Singapore", timeZone: "Asia/Singapore" },
  SHH: { exchange: "Shanghai Stock Exchange", country: "China", timeZone: "Asia/Shanghai" },
  SHZ: { exchange: "Shenzhen Stock Exchange", country: "China", timeZone: "Asia/Shanghai" },
};

export function listingOf(code: string | null | undefined): Listing | null {
  return (code && EXCHANGES[code]) || null;
}
