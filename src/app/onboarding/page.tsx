import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { OnboardingForm } from "@/components/workspace/onboarding-form";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await collections
    .workspaces()
    .findOne({ ownerUserId: user.id });
  if (existing) redirect("/app");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-2 text-center font-display text-sm tracking-wide text-copper">
          STEP 1 OF 2
        </p>
        <h1 className="mb-1 text-center font-display text-3xl text-ink">
          Your business, on paper
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          These details become the letterhead on every quotation, bill and letter
          you send. You can refine them any time.
        </p>
        <div className="rounded-[4px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(28,37,54,0.05)]">
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
