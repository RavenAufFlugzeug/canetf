"use client";

import { useState } from "react";
import { questions } from "@/lib/questions";

export default function OnboardingQuiz() {

    const [step, setStep] = useState(1);
    const [answers, setAnswers] = useState<Record<string, string>>({});


    const currentQuestion = questions[step - 1];
    const selectedAnswer = answers[currentQuestion.id];

    const progress = (step / questions.length) * 100;


    function selectAnswer(option: string) {
        setAnswers({
            ...answers,
            [currentQuestion.id]: option
        });
    }


    function nextQuestion() {

        if (!selectedAnswer) {
            return;
        }


        if (step === questions.length) {

            console.log("Final answers:", answers);

            return;

        }


        setStep(step + 1);

    }


    return (
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow">


            <h1 className="text-xl font-bold">
                Step {step} of {questions.length}
            </h1>


            <div className="mt-4 h-3 w-full rounded bg-gray-200">

                <div
                    className="h-3 rounded bg-blue-600"
                    style={{
                        width: `${progress}%`
                    }}
                />

            </div>


            <h2 className="mt-8 text-2xl font-bold">
                {currentQuestion.title}
            </h2>


            <div className="mt-6 space-y-3">

                {
                    currentQuestion.options.map((option) => (

                        <button
                            key={option}
                            onClick={() => selectAnswer(option)}
                            className={`
                block
                w-full
                rounded-lg
                border
                p-4
                text-left
                transition

                ${selectedAnswer === option
                                    ? "border-blue-600 bg-blue-100"
                                    : "hover:bg-blue-50"
                                }
            `}
                        >
                            {option}
                        </button>

                    ))
                }

            </div>

            <button
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
                className="
    mr-4
    rounded-lg
    border
    px-6
    py-3
  "
            >
                Back
            </button>

            <button
                onClick={nextQuestion}
                disabled={!selectedAnswer}
                className={`
    mt-8
    rounded-lg
    px-6
    py-3
    text-white

    ${selectedAnswer
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gray-400 cursor-not-allowed"
                    }
  `}
            >
                Next
            </button>


        </div>
    );
}