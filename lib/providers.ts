// The companies behind the ETFs' providers (companies.fund_family, as Yahoo Finance names
// them), for the Search page's fund section: clicking a provider shows the listed company
// that runs it (search/providers.py stores them), or, for one privately owned, who owns it.
export type Provider = {
  name: string; // the company behind it
  symbol: string | null; // its listing here, or null when it has no shares that trade
  about: string; // how the provider and the company are linked
};

const PROVIDERS: { match: RegExp; provider: Provider }[] = [
  {
    match: /blackrock|ishares/i,
    provider: {
      name: "BlackRock, Inc.",
      symbol: "BLK",
      about:
        "iShares is BlackRock's family of ETFs; BlackRock Asset Management Canada runs the Canadian ones. BlackRock is the world's largest asset manager.",
    },
  },
  {
    match: /^bmo\b/i,
    provider: {
      name: "Bank of Montreal",
      symbol: "BMO.TO",
      about: "BMO Asset Management, which runs BMO's ETFs, is part of BMO Financial Group: the Bank of Montreal.",
    },
  },
  {
    match: /^td\b/i,
    provider: {
      name: "The Toronto-Dominion Bank",
      symbol: "TD.TO",
      about: "TD Asset Management, which runs TD's ETFs, is part of TD Bank Group: the Toronto-Dominion Bank.",
    },
  },
  {
    match: /manufacturers life|manulife/i,
    provider: {
      name: "Manulife Financial Corporation",
      symbol: "MFC.TO",
      about: "The Manufacturers Life Insurance Company, which offers Manulife's ETFs, belongs to Manulife Financial.",
    },
  },
  {
    match: /mackenzie/i,
    provider: {
      name: "IGM Financial Inc.",
      symbol: "IGM.TO",
      about: "Mackenzie Investments is owned by IGM Financial, itself part of Power Corporation of Canada.",
    },
  },
  {
    match: /vanguard/i,
    provider: {
      name: "The Vanguard Group",
      symbol: null,
      about:
        "Vanguard is owned by its own US funds, and so by the people who invest in them. It has no shares that trade, so there is no price to show.",
    },
  },
  {
    match: /fidelity/i,
    provider: {
      name: "FMR LLC (Fidelity Investments)",
      symbol: null,
      about:
        "Fidelity is privately owned, mostly by the Johnson family and its employees. It has no shares that trade, so there is no price to show.",
    },
  },
  {
    match: /global x/i,
    provider: {
      name: "Mirae Asset Global Investments",
      symbol: null,
      about:
        "Global X is owned by Mirae Asset Global Investments of South Korea, which isn't listed on an exchange, so there is no price to show.",
    },
  },
];

// The company behind a provider, or null for one not known here.
export function providerOf(fundFamily: string | null | undefined): Provider | null {
  if (!fundFamily) return null;
  return PROVIDERS.find((p) => p.match.test(fundFamily))?.provider ?? null;
}

// The listings a provider's pop-up may ask for (the only ones the server action serves).
export const PROVIDER_SYMBOLS = PROVIDERS.flatMap((p) => (p.provider.symbol ? [p.provider.symbol] : []));
