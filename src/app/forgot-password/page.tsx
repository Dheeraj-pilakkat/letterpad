import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center font-display text-sm tracking-wide text-royal">
          LETTERPAD
        </p>
        <h1 className="mb-1 text-center font-display text-3xl text-ink">
          Forgot your password?
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          Enter your email and we&apos;ll send a reset link.
        </p>
        <div className="rounded-[4px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(28,37,54,0.05)]">
          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  );
}
