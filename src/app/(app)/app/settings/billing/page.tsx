import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/session";
import {
  PLANS,
  PLAN_IDS,
  currentPlanId,
  documentLimit,
  hasPlanFeature,
  planDef,
} from "@/lib/plans";
import { countDocumentsThisMonth } from "@/lib/documents-quota";
import { PlanCardButton } from "@/components/settings/plan-card-button";
import { WhiteLabelToggle } from "@/components/settings/white-label-toggle";

export const metadata: Metadata = { title: "Subscription & Billing" };

export default async function BillingPage() {
  const { workspace, role } = await requireWorkspace();
  const planId = currentPlanId(workspace);
  const plan = planDef(workspace);
  const limit = documentLimit(workspace);
  const createdThisMonth = await countDocumentsThisMonth(workspace._id);
  const premiumOk = hasPlanFeature(workspace, "premiumTemplates");
  const whiteLabelOk = hasPlanFeature(workspace, "whiteLabel");
  const owner = role === "owner";

  // Usage across plans: show the count against the current plan's cap.
  const usageLabel =
    limit === null
      ? `${createdThisMonth} created this month · unlimited`
      : `${createdThisMonth} / ${limit} documents this month`;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="mb-2 font-display text-sm tracking-wide text-royal">
          SUBSCRIPTION
        </p>
        <h1 className="font-display text-3xl text-ink">Subscription &amp; Billing</h1>
        <p className="mt-1 text-sm text-muted">
          Choose the plan that fits how much you invoice. Indicative pricing —
          billed monthly through Razorpay in INR.
        </p>
      </header>

      <section className="mb-8 rounded-[4px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Current plan</p>
            <p className="mt-1 flex items-center gap-2 font-display text-2xl text-ink">
              {plan.name}
              {planId !== "free" && workspace.subscription?.currentPeriodEnd ? (
                <span className="text-sm font-normal text-muted">
                  · renews {workspace.subscription.currentPeriodEnd}
                  {workspace.subscription.status === "past_due"
                    ? " (past due)"
                    : ""}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-muted">{usageLabel}</p>
          </div>
          {!owner ? (
            <p className="text-xs text-muted">Only the owner can change the plan.</p>
          ) : null}
        </div>
        {limit !== null && createdThisMonth >= limit ? (
          <p className="mt-3 rounded-[4px] border border-red/30 bg-red/5 px-3 py-2 text-sm text-red">
            Monthly limit reached — upgrade to keep creating documents.
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === planId;
          return (
            <div
              key={id}
              className={
                isCurrent
                  ? "flex flex-col rounded-[4px] border-2 border-royal bg-white p-5"
                  : "flex flex-col rounded-[4px] border border-line bg-white p-5"
              }
            >
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink">{p.name}</p>
                  {id === "professional" ? (
                    <span className="flex items-center gap-1 rounded-full bg-royal/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-royal">
                      <Sparkles size={10} /> Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-display text-2xl text-ink">{p.priceLabel}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{p.blurb}</p>
              </div>
              <ul className="mb-5 flex-1 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-1.5 text-xs text-ink">
                    <Check size={13} className="mt-0.5 shrink-0 text-forest" />
                    {f}
                  </li>
                ))}
              </ul>
              <PlanCardButton
                planId={id}
                planName={p.name}
                current={isCurrent}
                owner={owner}
                razorpayKeyId={
                  workspace.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null
                }
              />
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-[4px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-ink">White-label branding</h2>
            <p className="mt-1 max-w-xl text-xs text-muted">
              Remove the &quot;Powered by Letterpad&quot; footer from client-portal
              and share pages so clients only see your brand. Business plan.
            </p>
          </div>
          {whiteLabelOk ? (
            <WhiteLabelToggle enabled={workspace.whiteLabel === true} />
          ) : (
            <Link
              href="#"
              className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink"
              aria-disabled
            >
              Business plan
            </Link>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-[4px] border border-line bg-white p-5">
        <h2 className="text-sm font-medium text-ink">What&apos;s included</h2>
        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-medium text-ink">Premium templates</dt>
            <dd className="mt-0.5 text-muted">
              {premiumOk
                ? "Unlocked on your plan — see the Template gallery."
                : "Starter plan and above unlock premium letterhead styles."}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">AI writing assistant</dt>
            <dd className="mt-0.5 text-muted">
              Included with Professional and above (requires an AI API key).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Payment processing</dt>
            <dd className="mt-0.5 text-muted">
              Razorpay fees are passed through by Razorpay; Letterpad charges
              only the plan price.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Invoices for your subscription</dt>
            <dd className="mt-0.5 text-muted">
              Plan payments are processed by Razorpay — receipts are emailed by
              them.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
