// NAICS Canada 2022 sectors (the two-digit level), grouped as Statistics Canada often
// presents them, with a colour for each group: the Holdings Map colours companies by it.
// Utilities and construction are one group (22-23), and services from 56 to 91 are "Other".
// Yahoo Finance doesn't give NAICS codes, so a company's sector is worked out from Yahoo's
// industry (YAHOO_INDUSTRIES), or failing that its broader sector (YAHOO_SECTORS).
//
// The colours are light, so a box's dark text stays readable (at least 6.9:1), and spread
// as far apart as such colours can be in OKLab: goods-producing groups warm, trade and
// transport in between, services cool, Other a quiet warm grey. The map's legend lists
// every group with its codes, and its hover card names a company's group.
export type NaicsGroup = { code: string; name: string; color: string };

export const NAICS_GROUPS: NaicsGroup[] = [
  { code: "11", name: "Agriculture, forestry, fishing and hunting", color: "#d0bc0f" },
  { code: "21", name: "Mining, quarrying, and oil and gas extraction", color: "#fe9424" },
  { code: "22-23", name: "Utilities and construction", color: "#ffe682" },
  { code: "31-33", name: "Manufacturing", color: "#fe8b8a" },
  { code: "41", name: "Wholesale trade", color: "#e6c087" },
  { code: "44-45", name: "Retail trade", color: "#fca0ee" },
  { code: "48-49", name: "Transportation and warehousing", color: "#bb96fe" },
  { code: "51", name: "Information and cultural industries", color: "#89b8ff" },
  { code: "52", name: "Finance and insurance", color: "#3ed1d4" },
  { code: "53", name: "Real estate and rental and leasing", color: "#63df8d" },
  { code: "54", name: "Professional, scientific and technical services", color: "#c4c2ec" },
  { code: "55", name: "Management of companies and enterprises", color: "#9ee4cb" },
  { code: "56-91", name: "Other", color: "#e2ddd8" },
];

// The group a two-digit sector (as used below) belongs to.
const GROUP_OF: Record<string, string> = {
  "22": "22-23",
  "23": "22-23",
  "56": "56-91",
  "61": "56-91",
  "62": "56-91",
  "71": "56-91",
  "72": "56-91",
  "81": "56-91",
  "91": "56-91",
};

const BY_CODE = new Map(NAICS_GROUPS.map((g) => [g.code, g]));

// Yahoo's industries (as stored in companies.industry) -> NAICS sector (two-digit, or the
// range manufacturing, retail and transportation span).
const YAHOO_INDUSTRIES: Record<string, string> = {
  // Basic materials
  "Agricultural Inputs": "31-33", // fertilisers are made, then sold
  "Aluminum": "31-33",
  "Building Materials": "31-33",
  "Chemicals": "31-33",
  "Specialty Chemicals": "31-33",
  "Paper & Paper Products": "31-33",
  "Lumber & Wood Production": "31-33",
  "Steel": "31-33",
  "Copper": "21",
  "Gold": "21",
  "Silver": "21",
  "Other Precious Metals & Mining": "21",
  "Other Industrial Metals & Mining": "21",
  "Coking Coal": "21",
  // Communication services
  "Internet Content & Information": "51",
  "Telecom Services": "51",
  "Entertainment": "51",
  "Publishing": "51",
  "Broadcasting": "51",
  "Advertising Agencies": "54",
  "Electronic Gaming & Multimedia": "51",
  // Consumer cyclical
  "Apparel Retail": "44-45",
  "Auto & Truck Dealerships": "44-45",
  "Department Stores": "44-45",
  "Home Improvement Retail": "44-45",
  "Internet Retail": "44-45",
  "Specialty Retail": "44-45",
  "Luxury Goods": "31-33",
  "Apparel Manufacturing": "31-33",
  "Footwear & Accessories": "31-33",
  "Auto Manufacturers": "31-33",
  "Auto Parts": "31-33",
  "Recreational Vehicles": "31-33",
  "Furnishings, Fixtures & Appliances": "31-33",
  "Packaging & Containers": "31-33",
  "Residential Construction": "23",
  "Restaurants": "72",
  "Lodging": "72",
  "Resorts & Casinos": "72",
  "Gambling": "71",
  "Leisure": "71",
  "Travel Services": "56",
  "Personal Services": "81",
  // Consumer defensive
  "Discount Stores": "44-45",
  "Grocery Stores": "44-45",
  "Pharmaceutical Retailers": "44-45",
  "Food Distribution": "41",
  "Packaged Foods": "31-33",
  "Confectioners": "31-33",
  "Beverages - Non-Alcoholic": "31-33",
  "Beverages - Brewers": "31-33",
  "Beverages - Wineries & Distilleries": "31-33",
  "Household & Personal Products": "31-33",
  "Tobacco": "31-33",
  "Farm Products": "11",
  "Education & Training Services": "61",
  // Energy
  "Oil & Gas E&P": "21",
  "Oil & Gas Integrated": "21",
  "Oil & Gas Drilling": "21",
  "Oil & Gas Equipment & Services": "21",
  "Thermal Coal": "21",
  "Uranium": "21",
  "Oil & Gas Midstream": "48-49", // pipelines are transportation in NAICS
  "Oil & Gas Refining & Marketing": "31-33",
  // Financial services
  "Asset Management": "52",
  "Banks - Diversified": "52",
  "Banks - Regional": "52",
  "Capital Markets": "52",
  "Credit Services": "52",
  "Financial Data & Stock Exchanges": "52",
  "Financial Conglomerates": "52",
  "Insurance - Diversified": "52",
  "Insurance - Life": "52",
  "Insurance - Property & Casualty": "52",
  "Insurance - Reinsurance": "52",
  "Insurance - Specialty": "52",
  "Insurance Brokers": "52",
  "Mortgage Finance": "52",
  "Shell Companies": "55",
  // Healthcare
  "Biotechnology": "31-33",
  "Drug Manufacturers - General": "31-33",
  "Drug Manufacturers - Specialty & Generic": "31-33",
  "Medical Devices": "31-33",
  "Medical Instruments & Supplies": "31-33",
  "Diagnostics & Research": "54",
  "Health Information Services": "51",
  "Healthcare Plans": "52",
  "Medical Care Facilities": "62",
  "Medical Distribution": "41",
  // Industrials
  "Aerospace & Defense": "31-33",
  "Electrical Equipment & Parts": "31-33",
  "Farm & Heavy Construction Machinery": "31-33",
  "Metal Fabrication": "31-33",
  "Specialty Industrial Machinery": "31-33",
  "Tools & Accessories": "31-33",
  "Pollution & Treatment Controls": "31-33",
  "Building Products & Equipment": "31-33",
  "Conglomerates": "31-33",
  "Engineering & Construction": "23",
  "Infrastructure Operations": "48-49",
  "Industrial Distribution": "41",
  "Airlines": "48-49",
  "Airports & Air Services": "48-49",
  "Marine Shipping": "48-49",
  "Railroads": "48-49",
  "Trucking": "48-49",
  "Integrated Freight & Logistics": "48-49",
  "Rental & Leasing Services": "53",
  "Security & Protection Services": "56",
  "Specialty Business Services": "56",
  "Staffing & Employment Services": "56",
  "Waste Management": "56",
  "Consulting Services": "54",
  // Real estate
  "REIT - Diversified": "53",
  "REIT - Healthcare Facilities": "53",
  "REIT - Hotel & Motel": "53",
  "REIT - Industrial": "53",
  "REIT - Office": "53",
  "REIT - Residential": "53",
  "REIT - Retail": "53",
  "REIT - Specialty": "53",
  "REIT - Mortgage": "52", // mortgage REITs lend rather than own property
  "Real Estate - Development": "23",
  "Real Estate - Diversified": "53",
  "Real Estate Services": "53",
  // Technology
  "Communication Equipment": "31-33",
  "Computer Hardware": "31-33",
  "Consumer Electronics": "31-33",
  "Electronic Components": "31-33",
  "Scientific & Technical Instruments": "31-33",
  "Semiconductor Equipment & Materials": "31-33",
  "Semiconductors": "31-33",
  "Solar": "31-33",
  "Electronics & Computer Distribution": "41",
  "Information Technology Services": "54",
  "Software - Application": "51",
  "Software - Infrastructure": "51",
  // Utilities
  "Utilities - Diversified": "22",
  "Utilities - Independent Power Producers": "22",
  "Utilities - Regulated Electric": "22",
  "Utilities - Regulated Gas": "22",
  "Utilities - Regulated Water": "22",
  "Utilities - Renewable": "22",
};

// For an industry not listed above: the NAICS sector most of Yahoo's sector falls in.
const YAHOO_SECTORS: Record<string, string> = {
  "Basic Materials": "31-33",
  "Communication Services": "51",
  "Consumer Cyclical": "44-45",
  "Consumer Defensive": "31-33",
  "Energy": "21",
  "Financial Services": "52",
  "Healthcare": "31-33",
  "Industrials": "31-33",
  "Real Estate": "53",
  "Technology": "51",
  "Utilities": "22",
};

// A company's NAICS group from Yahoo's industry and sector, or null when it has neither
// (funds, and the odd listing Yahoo doesn't classify).
export function naicsOf(sector: string | null, industry: string | null): NaicsGroup | null {
  const code = (industry && YAHOO_INDUSTRIES[industry]) || (sector && YAHOO_SECTORS[sector]);
  return (code && BY_CODE.get(GROUP_OF[code] ?? code)) || null;
}
