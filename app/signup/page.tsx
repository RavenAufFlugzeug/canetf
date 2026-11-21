import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";
import Page from "@/components/Page";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (await getCurrentUser()) {
    redirect("/account");
  }

  const { next } = await searchParams;

  return (
    <Page width="sm">
      <AuthForm mode="signup" next={typeof next === "string" ? next : undefined} />
    </Page>
  );
}
