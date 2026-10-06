export type Question =
  | { id: string; type: "single" | "multi"; title: string; options: string[] }
  | { id: string; type: "number"; title: string; options?: never };

export type Answers = Record<string, string | string[] | number>;

export const questions: Question[] = [
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

// Server-side check of a submitted quiz (same rules as the quiz UI).
// Returns only the known answers, or null if any answer is missing or invalid.
export function validateAnswers(input: unknown): Answers | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const answers: Answers = {};

  for (const question of questions) {
    const value = raw[question.id];

    if (question.type === "number") {
      if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        return null;
      }
    } else if (question.type === "single") {
      if (typeof value !== "string" || !question.options.includes(value)) {
        return null;
      }
    } else if (
      !Array.isArray(value) ||
      value.length === 0 ||
      new Set(value).size !== value.length ||
      !value.every((item) => question.options.includes(item))
    ) {
      return null;
    }

    answers[question.id] = value as string | string[] | number;
  }

  return answers;
}
