import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center font-display text-sm tracking-wide text-royal">
          LETTERPAD
        </p>
        <h1 className="mb-1 text-center font-display text-3xl text-ink">
          Choose a new password
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          Pick something you haven&apos;t used before (8+ characters).
        </p>
        <div className="rounded-[4px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(28,37,54,0.05)]">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
