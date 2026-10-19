import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center font-display text-2xl text-ink">
          Letter<span className="text-copper">pad</span>
        </Link>
        <div className="rounded-[4px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(28,37,54,0.05)]">
          <h1 className="mb-1 font-display text-xl text-ink">Create your account</h1>
          <p className="mb-5 text-sm text-muted">
            One account, one business letterhead desk.
          </p>
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}
