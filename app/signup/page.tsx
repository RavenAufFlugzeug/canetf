import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";

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
    <main className="flex-1 bg-slate-50">
      <section className="flex justify-center px-6 py-12">
        <AuthForm mode="signup" next={typeof next === "string" ? next : undefined} />
      </section>
    </main>
  );
}
