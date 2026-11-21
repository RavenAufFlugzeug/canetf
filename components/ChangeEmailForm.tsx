"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changeEmail } from "@/app/actions/auth";
import { button, field } from "@/lib/ui";

// The new email, and the current password to confirm it is the account's owner, as the
// Change password form has them.
export default function ChangeEmailForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(changeEmail, undefined);
  const emailError = state?.errors?.email;
  const passwordError = state?.errors?.currentPassword;

  return (
    <form action={action} className="mt-4 space-y-4" noValidate>
      <p className="text-sm text-slate-600">
        Your email is <span className="font-semibold text-slate-900">{state?.success ? state.email : current}</span>.
      </p>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          New email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state?.success ? "" : state?.email}
          aria-invalid={Boolean(emailError)}
          aria-describedby={emailError ? "email-note" : undefined}
          className={`mt-1 w-full ${field()}`}
        />
        {emailError && (
          <p id="email-note" className="mt-1 text-sm text-red-600">
            {emailError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? "currentPassword-note" : undefined}
          className={`mt-1 w-full ${field()}`}
        />
        {passwordError && (
          <p id="currentPassword-note" className="mt-1 text-sm text-red-600">
            {passwordError}
          </p>
        )}
      </div>

      {state?.success && (
        <p role="status" className="text-sm text-green-700">
          Email updated. Use your new email the next time you log in.
        </p>
      )}

      {/* Changing it, or cancelling (back to the account page). */}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} aria-busy={pending} className={button("primary", "lg")}>
          {pending ? "Updating…" : "Change email"}
        </button>
        <Link href="/account" className={button("secondary", "lg")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
