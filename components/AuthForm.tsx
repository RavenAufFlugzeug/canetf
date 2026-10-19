"use client";

import { useActionState, useLayoutEffect, useRef, useState, ViewTransition } from "react";
import { login, signup } from "@/app/actions/auth";
import DiamondLoader from "@/components/DiamondLoader";

type Mode = "login" | "signup";

type Props = {
  mode: Mode;
  next?: string;
};

// How long the card takes to ease to its new height when switched.
const RESIZE_MS = 450;

// The login and sign-up card. The line at its bottom ("New to LitterBox? Create an account",
// "Already have an account? Log in") moves between logging in and creating an account, in
// place: the card eases to its new height while the new form glides and fades in from the
// side (from the right for creating an account, from the left for logging in) and the line
// at the bottom fades to its new words; the address becomes /login or /signup (so a reload
// or a shared link opens the same one). The /login and /signup pages both show this card,
// starting on their own mode.
export default function AuthForm({ mode: initial, next }: Props) {
  const [mode, setMode] = useState<Mode>(initial);
  // Whether it has been switched yet: the form only slides in after a switch.
  const [switched, setSwitched] = useState(false);
  const isLogin = mode === "login";
  const card = useRef<HTMLDivElement>(null);
  // The card's height just before a switch, to ease from.
  const from = useRef<number | null>(null);

  // Once the new form is in, ease the card from its old height to its new one.
  useLayoutEffect(() => {
    const el = card.current;
    const start = from.current;
    from.current = null;
    if (!el || start === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = el.offsetHeight;
    if (Math.abs(end - start) < 1) return;
    el.style.height = `${start}px`;
    el.style.overflow = "hidden";
    el.getBoundingClientRect(); // apply the starting height before easing to the new one
    el.style.transition = `height ${RESIZE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    el.style.height = `${end}px`;
    const done = window.setTimeout(() => {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
    }, RESIZE_MS);
    return () => window.clearTimeout(done);
  }, [mode]);

  function choose(m: Mode) {
    if (m === mode) return;
    from.current = card.current?.offsetHeight ?? null;
    setMode(m);
    setSwitched(true);
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    window.history.replaceState(null, "", `/${m}${query}`);
  }

  return (
    // Named "auth-card", like the home page's create-account panel, so following its links
    // the panel morphs into this card (and back on the way home).
    <ViewTransition name="auth-card" share="auth-morph">
      <div ref={card} className="w-full max-w-md rounded-2xl bg-white p-8 shadow">
        {/* Keyed by the mode, so a switch starts the form afresh and slides it in. */}
        <div
          key={`form-${mode}`}
          className={switched ? (isLogin ? "auth-swap-from-left" : "auth-swap-from-right") : undefined}
        >
          <h1 className="text-2xl font-bold text-slate-900">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLogin
              ? "Log in to your watch list and investor profile."
              : "Save a watch list of companies and ETFs, and build your investor profile."}
          </p>
          <Fields mode={mode} next={next} />
        </div>

        <p
          key={`switch-${mode}`}
          className={`mt-6 text-center text-sm text-slate-600 ${switched ? "auth-fade" : ""}`}
        >
          {isLogin ? "New to LitterBox? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => choose(isLogin ? "signup" : "login")}
            className="rounded font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            {isLogin ? "Create an account" : "Log in"}
          </button>
        </p>
      </div>
    </ViewTransition>
  );
}

// The form itself, for one mode (so each keeps its own answer from the server). Its fields'
// labels darken while being typed in, the password can be shown, the sign-up hints rise in,
// an error gives a little shake as it appears, and the button lifts with its arrow sliding
// on, showing the loading diamonds while it works.
function Fields({ mode, next }: { mode: Mode; next?: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const isLogin = mode === "login";

  const field =
    "mt-1 w-full rounded-lg border border-slate-300 p-3 text-slate-900 transition-[border-color,box-shadow] duration-200 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
  const label =
    "block text-sm font-medium text-slate-600 transition-colors group-focus-within/field:text-slate-900";

  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <div className="group/field">
        <label htmlFor="username" className={label}>
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
          aria-describedby={state?.errors.username ? "username-error" : isLogin ? undefined : "username-hint"}
          className={field}
        />
        {state?.errors.username ? (
          <p key={state.errors.username} id="username-error" className="shake mt-1 text-sm text-red-600">
            {state.errors.username}
          </p>
        ) : (
          !isLogin && (
            <p
              id="username-hint"
              className="rise-in mt-1 text-sm text-slate-500"
              style={{ animationDelay: "120ms" }}
            >
              3–20 characters: letters, numbers or _.
            </p>
          )
        )}
      </div>

      <div className="group/field">
        <label htmlFor="password" className={label}>
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            aria-invalid={Boolean(state?.errors.password)}
            aria-describedby={
              state?.errors.password ? "password-error" : isLogin ? undefined : "password-hint"
            }
            className={`${field} pr-12`}
          />
          {/* Show or hide the password: an eye, struck through while the password is hidden,
              and open while it is shown. */}
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-2 mt-0.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-slate-400"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4.5"
            >
              <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
              <circle cx="12" cy="12" r="3" />
              <path
                d="M4 20 20 4"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={showPassword ? 1 : 0}
                className="transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </svg>
          </button>
        </div>
        {state?.errors.password ? (
          <p key={state.errors.password} id="password-error" className="shake mt-1 text-sm text-red-600">
            {state.errors.password}
          </p>
        ) : (
          !isLogin && (
            <p
              id="password-hint"
              className="rise-in mt-1 text-sm text-slate-500"
              style={{ animationDelay: "180ms" }}
            >
              At least 8 characters.
            </p>
          )
        )}
      </div>

      {state?.errors.form && (
        <p key={state.errors.form} role="alert" className="shake text-sm text-red-600">
          {state.errors.form}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group/submit flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white shadow-sm transition duration-300 ease-out hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 active:translate-y-0 active:shadow-sm disabled:cursor-not-allowed disabled:bg-slate-500 motion-safe:hover:-translate-y-0.5 disabled:motion-safe:hover:translate-y-0"
      >
        {pending ? (
          <>
            <DiamondLoader className="size-4" />
            {isLogin ? "Logging in…" : "Creating your account…"}
          </>
        ) : (
          <>
            {isLogin ? "Log in" : "Create account"}
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 transition-transform duration-300 ease-out motion-safe:group-hover/submit:translate-x-1"
            >
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
