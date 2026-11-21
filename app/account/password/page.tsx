import ChangePasswordForm from "@/components/ChangePasswordForm";
import { requireUser } from "@/lib/session";
import Page from "@/components/Page";
import { CARD } from "@/lib/ui";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <Page width="sm">
      <div className={CARD}>
        <h1 className="text-2xl font-bold text-slate-900">Change password</h1>
        <ChangePasswordForm />
      </div>
    </Page>
  );
}
