"use client";

import { useEffect, useState } from "react";
import { questions } from "@/lib/questions";

export default function OnboardingQuiz() {
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState(1);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showValidationError, setShowValidationError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const savedAnswers = sessionStorage.getItem("canetf_answers");
    const savedStep = sessionStorage.getItem("canetf_step");

    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }

    if (savedStep) {
      setStep(Number(savedStep));
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    sessionStorage.setItem("canetf_answers", JSON.stringify(answers));

    sessionStorage.setItem("canetf_step", String(step));
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

  function selectAnswer(value: any) {
    setShowValidationError(false);
    if (currentQuestion.type === "multi") {
      const currentValues = answers[currentQuestion.id] || [];

      if (currentValues.includes(value)) {
        setAnswers({
          ...answers,
          [currentQuestion.id]: currentValues.filter(
            (item: string) => item !== value,
          ),
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

  function nextQuestion() {
    if (!isCurrentAnswerValid()) {
      setShowValidationError(true);

      return;
    }

    setShowValidationError(false);

    if (step === questions.length) {
      console.log("Final answers:", answers);

      sessionStorage.removeItem("canetf_answers");
      sessionStorage.removeItem("canetf_step");

      return;
    }

    setStep(step + 1);
  }

  function previousQuestion() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow">
      <h1 className="text-xl font-bold text-slate-600">
        Step {step} of {questions.length}
      </h1>

      <div className="mt-4 h-3 w-full rounded bg-gray-200">
        <div
          className="h-3 rounded bg-blue-600"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <h2 className="mt-8 text-2xl font-bold text-slate-600">
        {currentQuestion.title}
      </h2>

      <p className="mt-2 text-sm text-slate-500">{getQuestionHint()}</p>

      {currentQuestion.type === "number" && (
        <div className="relative mt-6">
          <span className="absolute left-4 top-4 text-slate-500">$</span>

          <input
            type="number"
            min="1"
            step="1"
            className="
            w-full
            rounded-lg
            border
            p-4
            pl-8
            text-slate-700
        "
            value={selectedAnswer ?? ""}
            onChange={(e) => updateNumber(e.target.value)}
            placeholder="0"
          />

          {showValidationError &&
            currentQuestion.type === "number" &&
            (!selectedAnswer ||
              !Number.isInteger(selectedAnswer) ||
              selectedAnswer <= 0) && (
              <p className="mt-2 text-sm text-red-600">
                Please enter a positive whole number greater than 0.
              </p>
            )}
        </div>
      )}

      {currentQuestion.options && (
        <div className="mt-6 space-y-3 text-slate-600">
          {currentQuestion.options.map((option) => {
            const selected =
              currentQuestion.type === "multi"
                ? selectedAnswer?.includes(option)
                : selectedAnswer === option;

            return (
              <button
                key={option}
                onClick={() => selectAnswer(option)}
                className={`
                    flex
                    w-full
                    items-center
                    rounded-lg
                    border
                    p-4
                    text-left
                    transition

                    ${
                      selected
                        ? "border-blue-600 bg-blue-100"
                        : "hover:bg-blue-50"
                    }
                `}
              >
                {currentQuestion.type === "multi" ? (
                  <span
                    className={`
                        mr-3
                        flex
                        h-5
                        w-5
                        items-center
                        justify-center
                        rounded
                        border

                        ${
                          selected
                            ? "border-blue-600 bg-blue-600"
                            : "border-gray-400"
                        }
                    `}
                  >
                    {selected && <span className="text-xs text-white">✓</span>}
                  </span>
                ) : (
                  <span
                    className={`
                        mr-3
                        h-5
                        w-5
                        rounded-full
                        border

                        ${
                          selected
                            ? "border-blue-600 bg-blue-600"
                            : "border-gray-400"
                        }
                    `}
                  />
                )}

                {option}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={previousQuestion}
          disabled={step === 1}
          className="
                mr-4
                rounded-lg
                border
                px-6
                py-3
                text-slate-600
            "
        >
          Back
        </button>

        <button
          onClick={nextQuestion}
          disabled={!isCurrentAnswerValid()}
          className={`
            rounded-lg
            px-6
            py-3
            text-white

            ${
              isCurrentAnswerValid()
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }
        `}
        >
          {step === questions.length ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
