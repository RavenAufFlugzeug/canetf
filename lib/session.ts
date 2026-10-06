import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAppDb } from "@/lib/appDb";

const COOKIE_NAME = "session";
const SESSION_DAYS = 7;

export type CurrentUser = { id: number; username: string; createdAt: string };

// The database only stores a hash, so a leaked app.db can't be used to log in.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  getAppDb()
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), userId, expiresAt.toISOString());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    getAppDb().prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
  }
  cookieStore.delete(COOKIE_NAME);
}

// Signs the user out everywhere except this browser (used after a password change).
export async function deleteOtherSessions(userId: number) {
  const token = (await cookies()).get(COOKIE_NAME)?.value ?? "";
  getAppDb()
    .prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?")
    .run(userId, hashToken(token));
}

// The signed-in user, or null. Checked against the database on every request
// (cached for the duration of one render).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const row = getAppDb()
    .prepare(
      `SELECT u.id, u.username, u.created_at AS createdAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), new Date().toISOString());

  return (row as CurrentUser | undefined) ?? null;
});

// For pages that require login.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
