"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppDb } from "@/lib/appDb";
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteOtherSessions, deleteSession, getCurrentUser } from "@/lib/session";

export type AuthFormState =
  | {
      email: string;
      errors: { email?: string; password?: string; form?: string };
    }
  | undefined;

export type ChangeEmailState =
  | {
      email?: string;
      success?: boolean;
      errors?: { email?: string; currentPassword?: string; form?: string };
    }
  | undefined;

export type ChangePasswordState =
  | {
      success?: boolean;
      errors?: { currentPassword?: string; newPassword?: string; confirmPassword?: string; form?: string };
    }
  | undefined;

// Something@something.something, with no spaces: enough to catch typos, without rejecting
// unusual but valid addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

// Only allow redirects to pages on this site (blocks "//evil.com" and full URLs).
function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/account";
}

function readForm(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password, next: safeNext(formData.get("next")) };
}

function emailError(email: string) {
  if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address, like name@example.com.";
  }
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
  const { email, password, next } = readForm(formData);
  const errors: NonNullable<AuthFormState>["errors"] = {};

  errors.email = emailError(email);
  errors.password = passwordError(password);
  if (errors.email || errors.password) {
    return { email, errors };
  }

  const db = getAppDb();
  // The email column is case-insensitive, so "Eric@x.com" and "eric@x.com" are one account.
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    return { email, errors: { email: "An account with that email already exists. Log in instead?" } };
  }

  const passwordHash = await hashPassword(password);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .run(email, passwordHash, new Date().toISOString());

  await createSession(Number(lastInsertRowid));
  redirect(next);
}

export async function login(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password, next } = readForm(formData);

  const user = getAppDb()
    .prepare("SELECT id, password_hash AS passwordHash FROM users WHERE email = ?")
    .get(email) as { id: number; passwordHash: string } | undefined;

  const valid = user
    ? await verifyPassword(password, user.passwordHash)
    : await fakeVerify(password);

  if (!user || !valid) {
    // Same message either way, so the form doesn't reveal which emails have accounts.
    return { email, errors: { form: "Incorrect email or password." } };
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

// A new email for the signed-in account, confirmed with its current password.
export async function changeEmail(_state: ChangeEmailState, formData: FormData): Promise<ChangeEmailState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const email = String(formData.get("email") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");

  const invalid = emailError(email);
  if (invalid) {
    return { email, errors: { email: invalid } };
  }
  // Compared as the column does, ignoring case.
  if (email.toLowerCase() === user.email.toLowerCase()) {
    return { email, errors: { email: "That's already your email." } };
  }

  const db = getAppDb();
  const { passwordHash } = db
    .prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?")
    .get(user.id) as { passwordHash: string };
  if (!(await verifyPassword(currentPassword, passwordHash))) {
    return { email, errors: { currentPassword: "Current password is incorrect." } };
  }

  if (db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(email, user.id)) {
    return { email, errors: { email: "Another account already uses that email." } };
  }

  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, user.id);
  // The navbar and the account page show it.
  revalidatePath("/", "layout");
  return { email, success: true };
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
