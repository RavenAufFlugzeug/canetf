"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { saveAnswers } from "@/app/actions/profile";
import { questions, type Answers } from "@/lib/questions";
import { button, field, LABEL, CARD, FOCUS_RING } from "@/lib/ui";

// A link in running text, as the site's others are: dark, with an underline that darkens
// when pointed at.
const LINK =
  "font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 transition hover:decoration-slate-900";

// Answers and the step reached are kept for this tab (sessionStorage), so they survive going
// off to log in and coming back.
const ANSWERS_KEY = "canetf_answers";
const STEP_KEY = "canetf_step";

// What was kept, read once as the quiz first renders in the browser (nothing, on the server).
function saved<T>(key: string, read: (text: string) => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const text = sessionStorage.getItem(key);
  return text ? read(text) : fallback;
}

// Whether this is the browser (true) rather than the server's render (false), without an
// effect: the quiz needs sessionStorage, so it shows nothing until then.
const noSubscribe = () => () => {};
const useInBrowser = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

export default function OnboardingQuiz() {
  const mounted = useInBrowser();

  const [step, setStep] = useState(() => saved(STEP_KEY, Number, 1));

  const [answers, setAnswers] = useState<Answers>(() => saved(ANSWERS_KEY, (t) => JSON.parse(t) as Answers, {}));
  const [showValidationError, setShowValidationError] = useState(false);
  const [finishStatus, setFinishStatus] = useState<
    "idle" | "saving" | "needsLogin" | "error"
  >("idle");
  const router = useRouter();

  useEffect(() => {
    if (!mounted) {
      return;
    }

    sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));

    sessionStorage.setItem(STEP_KEY, String(step));
  }, [answers, step, mounted]);

  if (!mounted) {
    return null;
  }

  const currentQuestion = questions[step - 1];

  const selectedAnswer = answers[currentQuestion.id];

  const progress = (step / questions.length) * 100;

  function getQuestionHint() {
    if (currentQuestion.type === "multi") {
      return "Select all that apply";
    }

    if (currentQuestion.type === "number") {
      return "Enter amount in CAD";
    }

    return "Select one option";
  }

  function selectAnswer(value: string) {
    setShowValidationError(false);
    if (currentQuestion.type === "multi") {
      const kept = answers[currentQuestion.id];
      const currentValues = Array.isArray(kept) ? kept : [];

      if (currentValues.includes(value)) {
        setAnswers({
          ...answers,
          [currentQuestion.id]: currentValues.filter((item) => item !== value),
        });
      } else {
        setAnswers({
          ...answers,
          [currentQuestion.id]: [...currentValues, value],
        });
      }

      return;
    }

    setAnswers({
      ...answers,
      [currentQuestion.id]: value,
    });
  }

  function updateNumber(value: string) {
    const numberValue = Number(value);

    setAnswers({
      ...answers,
      [currentQuestion.id]: value === "" ? "" : numberValue,
    });

    const valid =
      value !== "" && Number.isInteger(numberValue) && numberValue > 0;

    setShowValidationError(!valid);
  }

  function isCurrentAnswerValid() {
    if (
      selectedAnswer === undefined ||
      selectedAnswer === null ||
      selectedAnswer === ""
    ) {
      return false;
    }

    if (currentQuestion.type === "multi" && Array.isArray(selectedAnswer)) {
      return selectedAnswer.length > 0;
    }

    if (currentQuestion.type === "number") {
      return (
        typeof selectedAnswer === "number" &&
        Number.isInteger(selectedAnswer) &&
        selectedAnswer > 0
      );
    }

    return true;
  }

  async function finish() {
    setFinishStatus("saving");

    try {
      const result = await saveAnswers(answers);

      if (result.ok) {
        sessionStorage.removeItem(ANSWERS_KEY);
        sessionStorage.removeItem(STEP_KEY);
        router.push("/account");
        return;
      }

      // Not signed in: keep the answers in sessionStorage so they survive logging in.
      setFinishStatus(result.reason === "unauthenticated" ? "needsLogin" : "error");
    } catch {
      setFinishStatus("error");
    }
  }

  function nextQuestion() {
    if (!isCurrentAnswerValid()) {
      setShowValidationError(true);

      return;
    }

    setShowValidationError(false);

    if (step === questions.length) {
      finish();

      return;
    }

    setStep(step + 1);
  }

  function previousQuestion() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  const multi = currentQuestion.type === "multi";
  const last = step === questions.length;

  return (
    <div className={CARD}>
      {/* Where you are: the step, and a bar that fills as you go. */}
      <div className="flex items-center justify-between gap-4">
        <p className={LABEL}>
          Step {step} of {questions.length}
        </p>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={questions.length}
        aria-valuenow={step}
        aria-label="Questionnaire progress"
      >
        <div
          className="h-full rounded-full bg-slate-900 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Keyed by the step, so each question rises in as it comes. */}
      <div key={step} className="rise-in">
        <h1 className="mt-6 text-2xl font-bold text-slate-900">{currentQuestion.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{getQuestionHint()}</p>

        {currentQuestion.type === "number" && (
          <div className="mt-6">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              {/* A plain text field taking digits only (a number field would add the browser's
                  up and down arrows); phones show their number keypad for it. */}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={currentQuestion.title}
                aria-invalid={showValidationError}
                className={`w-full ${field()} pl-7 tabular-nums`}
                value={selectedAnswer ?? ""}
                onChange={(e) => updateNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
              />
            </div>
            {showValidationError &&
              !(typeof selectedAnswer === "number" && Number.isInteger(selectedAnswer) && selectedAnswer > 0) && (
                <p className="mt-2 text-sm text-red-600">Please enter a positive whole number greater than 0.</p>
              )}
          </div>
        )}

        {/* The options, as the site's choosable cards are: the chosen ones dark-edged and
            lifted, with a dark check or dot; the rest light, darkening when pointed at. */}
        {currentQuestion.options && (
          <div
            role={multi ? "group" : "radiogroup"}
            aria-label={currentQuestion.title}
            className="mt-6 space-y-2"
          >
            {currentQuestion.options.map((option) => {
              const selected = multi
                ? Array.isArray(selectedAnswer) && selectedAnswer.includes(option)
                : selectedAnswer === option;
              return (
                <button
                  key={option}
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={selected}
                  onClick={() => selectAnswer(option)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-slate-900 transition duration-200 ease-out ${FOCUS_RING} ${
                    selected
                      ? "border-slate-900 bg-white font-semibold shadow-md shadow-slate-900/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {multi ? (
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-200 ${
                        selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`size-3 transition duration-200 ${selected ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
                      >
                        <path d="M2.5 6.5 5 9l4.5-6" />
                      </svg>
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${
                        selected ? "border-slate-900" : "border-slate-300"
                      }`}
                    >
                      <span
                        className={`size-2.5 rounded-full bg-slate-900 transition duration-200 ${
                          selected ? "scale-100 opacity-100" : "scale-0 opacity-0"
                        }`}
                      />
                    </span>
                  )}
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={nextQuestion}
          disabled={!isCurrentAnswerValid() || finishStatus === "saving"}
          aria-busy={finishStatus === "saving"}
          className={button("primary", "lg")}
        >
          {last ? (finishStatus === "saving" ? "Saving…" : "Finish") : "Next"}
        </button>
        <button
          type="button"
          onClick={previousQuestion}
          disabled={step === 1}
          className={button("secondary", "lg")}
        >
          Back
        </button>
      </div>

      {finishStatus === "needsLogin" && (
        <p role="alert" className="mt-6 text-slate-600">
          <Link href="/signup?next=/onboarding" className={LINK}>
            Create an account
          </Link>{" "}
          or{" "}
          <Link href="/login?next=/onboarding" className={LINK}>
            log in
          </Link>{" "}
          to save your answers. They&apos;ll be waiting here when you come back.
        </p>
      )}

      {finishStatus === "error" && (
        <p role="alert" className="mt-6 text-red-600">
          Something went wrong saving your answers. Please try again.
        </p>
      )}
    </div>
  );
}
