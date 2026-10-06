"use server";

import { getAppDb } from "@/lib/appDb";
import { validateAnswers } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";

export type SaveAnswersResult = { ok: true } | { ok: false; reason: "unauthenticated" | "invalid" };

export async function saveAnswers(input: unknown): Promise<SaveAnswersResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const answers = validateAnswers(input);
  if (!answers) {
    return { ok: false, reason: "invalid" };
  }

  getAppDb()
    .prepare(
      `INSERT INTO profiles (user_id, answers, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, updated_at = excluded.updated_at`,
    )
    .run(user.id, JSON.stringify(answers), new Date().toISOString());

  return { ok: true };
}
