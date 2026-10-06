"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";

const fields = [
  { name: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { name: "newPassword", label: "New password", autoComplete: "new-password", hint: "At least 8 characters." },
  { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
] as const;

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="mt-4 space-y-4" noValidate>
      {fields.map((field) => {
        const error = state?.errors?.[field.name];
        const hint = "hint" in field ? field.hint : undefined;

        return (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete={field.autoComplete}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error || hint ? `${field.name}-note` : undefined}
              className="mt-1 w-full rounded-lg border p-3 text-slate-700"
            />
            {(error || hint) && (
              <p
                id={`${field.name}-note`}
                className={`mt-1 text-sm ${error ? "text-red-600" : "text-slate-500"}`}
              >
                {error ?? hint}
              </p>
            )}
          </div>
        );
      })}

      {state?.success && (
        <p role="status" className="text-sm text-green-700">
          Password updated. Any other devices signed in to your account have been logged out.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
