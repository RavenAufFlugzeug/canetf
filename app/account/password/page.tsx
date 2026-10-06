import Link from "next/link";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import Navbar from "@/components/Navbar";
import { requireUser } from "@/lib/session";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-md px-6 pb-12">
        <div className="rounded-2xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold text-slate-900">Change password</h1>
          <ChangePasswordForm />
        </div>

        <Link href="/account" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          ← Back to account
        </Link>
      </section>
    </main>
  );
}
