// Each mark, the kind it stands for, what makes a listing that kind (Yahoo Finance's sector;
// for basic materials, its industry too; or being a fund), and what such listings do, for the
// pop-up when its tile is pointed at. Shown on the Search page's badge legend
// (components/BadgeLegend.tsx) and in the Holdings Map's key.
export const KINDS: { kind: string; label: string; from: string; about: string }[] = [
  {
    kind: "TechCompany",
    label: "Tech",
    from: "Technology",
    about: "Software, chips, computers and IT services.",
  },
  {
    kind: "MediaCompany",
    label: "Media",
    from: "Communication Services",
    about: "Phone and internet carriers, media, entertainment and online platforms.",
  },
  {
    kind: "ConsumerCompany",
    label: "Consumer",
    from: "Consumer Cyclical",
    about:
      "Things people buy more of when times are good and cut back on when they aren\u2019t: cars, clothes, restaurants, travel, homes. Sales rise and fall with the economy.",
  },
  {
    kind: "StaplesCompany",
    label: "Staples",
    from: "Consumer Defensive",
    about:
      "Things people buy in any economy: food, drinks, groceries, household and personal goods. Sales hold up in hard times, which is why it is called defensive.",
  },
  {
    kind: "EnergyCompany",
    label: "Energy",
    from: "Energy",
    about: "Oil, gas and coal producers, refiners and pipelines.",
  },
  {
    kind: "FinanceCompany",
    label: "Finance",
    from: "Financial Services",
    about: "Banks, insurers, asset managers and exchanges.",
  },
  {
    kind: "HealthCompany",
    label: "Health",
    from: "Healthcare",
    about: "Drug makers, medical devices, hospitals and care.",
  },
  {
    kind: "IndustrialCompany",
    label: "Industrial",
    from: "Industrials",
    about: "Aerospace, machinery, railways and trucking, construction and business services.",
  },
  {
    kind: "RealEstateCompany",
    label: "Real estate",
    from: "Real Estate",
    about: "Owners, developers and managers of property, including REITs.",
  },
  {
    kind: "UtilityCompany",
    label: "Utility",
    from: "Utilities",
    about: "Suppliers of electricity, gas and water.",
  },
  {
    kind: "MiningCompany",
    label: "Mining",
    from: "Basic Materials: mining and metals",
    about: "Miners of gold, silver, copper, uranium and other metals and ores.",
  },
  {
    kind: "ChemicalCompany",
    label: "Chemical",
    from: "Basic Materials: chemicals",
    about: "Makers of chemicals, from bulk ones to specialty products.",
  },
  {
    kind: "AgriCompany",
    label: "Agriculture",
    from: "Basic Materials: agricultural inputs",
    about: "Makers of what farms use: fertilizers, seeds and crop protection.",
  },
  {
    kind: "MaterialsCompany",
    label: "Materials",
    from: "Basic Materials: the rest",
    about: "Steel, aluminum, lumber, paper, packaging and building materials.",
  },
  {
    kind: "ETF",
    label: "ETF",
    from: "A fund",
    about: "A fund that trades like a share, holding a basket of others.",
  },
  {
    kind: "Company",
    label: "Other",
    from: "No sector given",
    about: "Yahoo Finance gives no sector for it.",
  },
];
