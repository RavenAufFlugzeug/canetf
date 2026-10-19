import Link from "next/link";
import { getAppDb } from "@/lib/appDb";
import { questions, type Answers } from "@/lib/questions";
import { requireUser } from "@/lib/session";

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

function formatAnswer(value: Answers[string] | undefined, type: string) {
  if (value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (type === "number") {
    return Number(value).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  }
  return String(value);
}

export default async function AccountPage() {
  const user = await requireUser();

  const profile = getAppDb()
    .prepare("SELECT answers, updated_at AS updatedAt FROM profiles WHERE user_id = ?")
    .get(user.id) as { answers: string; updatedAt: string } | undefined;
  const answers: Answers | null = profile ? JSON.parse(profile.answers) : null;

  return (
    <main className="flex-1 bg-slate-50">
      <section className="mx-auto max-w-2xl space-y-6 px-6 pt-10 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Your account</h1>
          <p className="mt-2 text-slate-600">{user.username}</p>
          <p className="text-sm text-slate-500">
            Member since {dateFormat.format(new Date(user.createdAt))}
          </p>

          <Link
            href="/account/password"
            className="mt-6 inline-block rounded-lg border px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Change password
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900">Your investor profile</h2>
            {profile && (
              <span className="text-sm text-slate-500">
                Saved {dateFormat.format(new Date(profile.updatedAt))}
              </span>
            )}
          </div>

          {answers ? (
            <dl className="mt-4 divide-y">
              {questions.map((q) => (
                <div key={q.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <dt className="text-slate-600">{q.title}</dt>
                  <dd className="font-medium text-slate-900">{formatAnswer(answers[q.id], q.type)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-slate-600">You haven&apos;t completed the questionnaire yet.</p>
          )}

          <Link
            href="/onboarding"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            {answers ? "Retake questionnaire" : "Build my portfolio"}
          </Link>
        </div>
      </section>
    </main>
  );
}
