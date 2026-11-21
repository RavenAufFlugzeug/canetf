import ChangeEmailForm from "@/components/ChangeEmailForm";
import { requireUser } from "@/lib/session";
import Page from "@/components/Page";
import { CARD } from "@/lib/ui";

export default async function ChangeEmailPage() {
  const user = await requireUser();

  return (
    <Page width="sm">
      <div className={CARD}>
        <h1 className="text-2xl font-bold text-slate-900">Change email</h1>
        <ChangeEmailForm current={user.email} />
      </div>
    </Page>
  );
}
