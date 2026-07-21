export const questions = [
  {
    id: "accounts",
    type: "multi",
    title: "What accounts are you investing in?",
    options: [
      "TFSA",
      "RRSP",
      "FHSA",
      "Non-Registered"
    ]
  },

  {
    id: "initialInvestment",
    type: "number",
    title: "How much are you investing today?"
  },

  {
    id: "monthlyContribution",
    type: "number",
    title: "How much will you contribute each month?"
  },

  {
    id: "horizon",
    type: "single",
    title: "How long will you invest?",
    options: [
      "Short term",
      "Medium term",
      "Long term"
    ]
  },

  {
    id: "risk",
    type: "single",
    title: "What is your risk tolerance?",
    options: [
      "Conservative",
      "Balanced",
      "Growth",
      "Aggressive"
    ]
  },

  {
    id: "preferences",
    type: "multi",
    title: "Do you have any investment preferences?",
    options: [
      "Exclude Fossil Fuels",
      "ESG",
      "High Dividend Yield"
    ]
  }
];
