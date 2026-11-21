import ChangeEmailForm from "@/components/ChangeEmailForm";
import { requireUser } from "@/lib/session";
import Page from "@/components/Page";
import { CARD, PAGE_TITLE } from "@/lib/ui";

export default async function ChangeEmailPage() {
  const user = await requireUser();

  return (
    <Page width="sm">
      <div className={CARD}>
        <h1 className={PAGE_TITLE}>Change email</h1>
        <ChangeEmailForm current={user.email} />
      </div>
    </Page>
  );
}
