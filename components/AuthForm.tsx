"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup } from "@/app/actions/auth";

type Props = {
  mode: "login" | "signup";
  next?: string;
};

export default function AuthForm({ mode, next }: Props) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const isLogin = mode === "login";
  const otherHref = `${isLogin ? "/signup" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
      <h1 className="text-2xl font-bold text-slate-900">
        {isLogin ? "Log in" : "Create your account"}
      </h1>

      <form action={action} className="mt-6 space-y-5" noValidate>
        {next && <input type="hidden" name="next" value={next} />}

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-700">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={state?.username}
            aria-invalid={Boolean(state?.errors.username)}
            aria-describedby={
              state?.errors.username ? "username-error" : isLogin ? undefined : "username-hint"
            }
            className="mt-1 w-full rounded-lg border p-3 text-slate-700"
          />
          {state?.errors.username ? (
            <p id="username-error" className="mt-1 text-sm text-red-600">
              {state.errors.username}
            </p>
          ) : (
            !isLogin && (
              <p id="username-hint" className="mt-1 text-sm text-slate-500">
                3–20 characters: letters, numbers or _.
              </p>
            )
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            aria-invalid={Boolean(state?.errors.password)}
            aria-describedby={
              state?.errors.password ? "password-error" : isLogin ? undefined : "password-hint"
            }
            className="mt-1 w-full rounded-lg border p-3 text-slate-700"
          />
          {state?.errors.password ? (
            <p id="password-error" className="mt-1 text-sm text-red-600">
              {state.errors.password}
            </p>
          ) : (
            !isLogin && (
              <p id="password-hint" className="mt-1 text-sm text-slate-500">
                At least 8 characters.
              </p>
            )
          )}
        </div>

        {state?.errors.form && (
          <p role="alert" className="text-sm text-red-600">
            {state.errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {pending ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {isLogin ? "New to LitterBox? " : "Already have an account? "}
        <Link href={otherHref} className="font-medium text-blue-600 hover:underline">
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </div>
  );
}
