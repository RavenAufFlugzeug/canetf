import Link from "next/link";
import DeckBackPicker from "@/components/DeckBackPicker";
import { EmailMark, PasswordMark } from "@/components/TestMarks";
import { getAppDb } from "@/lib/appDb";
import { questions, type Answers } from "@/lib/questions";
import { requireUser } from "@/lib/session";
import { button, CARD, PAGE_TITLE, SECTION_TITLE } from "@/lib/ui";
import Page from "@/components/Page";

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
    <Page width="md">
      <div className={CARD}>
        <h1 className={PAGE_TITLE}>Your account</h1>
        <p className="mt-2 text-slate-600">{user.email}</p>
        <p className="text-sm text-slate-500">Member since {dateFormat.format(new Date(user.createdAt))}</p>

        {/* As the Sandbox's Reset is: the site's secondary buttons, each with its mark. */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/account/email" className={`group ${button("secondary")}`}>
            <EmailMark className="size-4" />
            Change email
          </Link>
          <Link href="/account/password" className={`group ${button("secondary")}`}>
            <PasswordMark className="size-4" />
            Change password
          </Link>
        </div>
      </div>

      <div className={CARD}>
        <h2 className={SECTION_TITLE}>Deck back</h2>
        <DeckBackPicker />
      </div>

      <div className={CARD}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={SECTION_TITLE}>Your investor profile</h2>
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

        <Link href="/onboarding" className={`mt-6 ${button("primary")}`}>
          {answers ? "Retake questionnaire" : "Build my portfolio"}
        </Link>
      </div>
    </Page>
  );
}
