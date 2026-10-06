"use server";

import { redirect } from "next/navigation";
import { getAppDb } from "@/lib/appDb";
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteOtherSessions, deleteSession, getCurrentUser } from "@/lib/session";

export type AuthFormState =
  | {
      username: string;
      errors: { username?: string; password?: string; form?: string };
    }
  | undefined;

export type ChangePasswordState =
  | {
      success?: boolean;
      errors?: { currentPassword?: string; newPassword?: string; confirmPassword?: string; form?: string };
    }
  | undefined;

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

// Only allow redirects to pages on this site (blocks "//evil.com" and full URLs).
function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/account";
}

function readForm(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { username, password, next: safeNext(formData.get("next")) };
}

function passwordError(password: string) {
  if (password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (password.length > MAX_PASSWORD) {
    return `Password must be at most ${MAX_PASSWORD} characters.`;
  }
}

export async function signup(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { username, password, next } = readForm(formData);
  const errors: NonNullable<AuthFormState>["errors"] = {};

  if (!USERNAME_PATTERN.test(username)) {
    errors.username = "Username must be 3–20 characters: letters, numbers or _.";
  }
  errors.password = passwordError(password);
  if (errors.username || errors.password) {
    return { username, errors };
  }

  const db = getAppDb();
  // The username column is case-insensitive, so "Eric" and "eric" can't both exist.
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) {
    return { username, errors: { username: "That username is taken." } };
  }

  const passwordHash = await hashPassword(password);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(username, passwordHash, new Date().toISOString());

  await createSession(Number(lastInsertRowid));
  redirect(next);
}

export async function login(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { username, password, next } = readForm(formData);

  const user = getAppDb()
    .prepare("SELECT id, password_hash AS passwordHash FROM users WHERE username = ?")
    .get(username) as { id: number; passwordHash: string } | undefined;

  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await fakeVerify(password);

  if (!user || !valid) {
    // Same message either way, so the form doesn't reveal which usernames exist.
    return { username, errors: { form: "Incorrect username or password." } };
  }

  // Housekeeping: drop this user's expired sessions.
  getAppDb()
    .prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?")
    .run(user.id, new Date().toISOString());

  await createSession(user.id);
  redirect(next);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function changePassword(
  _state: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const errors: NonNullable<ChangePasswordState>["errors"] = {};
  errors.newPassword = passwordError(newPassword);
  if (!errors.newPassword && newPassword === currentPassword) {
    errors.newPassword = "New password must be different from your current one.";
  }
  if (confirmPassword !== newPassword) {
    errors.confirmPassword = "Passwords don't match.";
  }
  if (errors.newPassword || errors.confirmPassword) {
    return { errors };
  }

  const db = getAppDb();
  const { passwordHash } = db
    .prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?")
    .get(user.id) as { passwordHash: string };

  if (!(await verifyPassword(currentPassword, passwordHash))) {
    return { errors: { currentPassword: "Current password is incorrect." } };
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    await hashPassword(newPassword),
    user.id,
  );
  // Anyone else signed in with the old password is logged out; this browser stays signed in.
  await deleteOtherSessions(user.id);

  return { success: true };
}
