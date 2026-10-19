import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center font-display text-2xl text-ink">
          Letter<span className="text-copper">pad</span>
        </Link>
        <div className="rounded-[4px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(28,37,54,0.05)]">
          <h1 className="mb-1 font-display text-xl text-ink">Welcome back</h1>
          <p className="mb-5 text-sm text-muted">Sign in to your letterhead desk.</p>
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
