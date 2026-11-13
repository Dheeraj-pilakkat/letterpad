import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { ScheduleForm } from "@/components/documents/schedule-form";
import { ScheduleActions } from "@/components/documents/schedule-actions";
import { AutomationCard } from "@/components/app/automation-card";
import { EmptyState } from "@/components/ui/card";
import { toContactOption } from "@/lib/serialize";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import { intervalLabel, isDue, isPastEnd } from "@/lib/recurring";
import { autoRemindersEnabled } from "@/lib/automation";
import { TYPE_META, documentLabel } from "@/lib/templates/registry";
import type { ScheduleStatus } from "@/lib/db/types";

export const metadata: Metadata = { title: "Recurring" };

const statusTones: Record<ScheduleStatus, string> = {
  active: "bg-forest/15 text-forest",
  paused: "bg-amber/15 text-amber-ink",
  completed: "bg-paper-dim text-ink-soft",
};

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { workspace, user } = await requireWorkspace();
  const { created } = await searchParams;

  // Best-effort auto-run of due schedules when the page opens
  const { runDueSchedules } = await import("@/lib/actions/schedules");
  if (created !== "1") {
    await runDueSchedules().catch(() => ({ ran: 0 }));
  }

  const schedules = await collections
    .schedules()
    .find({ workspaceId: workspace._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const contacts = await collections
    .contacts()
    .find({ workspaceId: workspace._id, archived: false })
    .sort({ name: 1 })
    .limit(200)
    .toArray();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">Recurring</h1>
        <p className="mt-1 text-sm text-muted">
          Automatically generate draft bills, quotations and receipts on a schedule.
        </p>
      </header>

      <ScheduleForm contacts={contacts.map(toContactOption)} />

      <AutomationCard enabled={autoRemindersEnabled(workspace)} />

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink">Schedules</h2>
        {schedules.length === 0 ? (
          <EmptyState
            title="No schedules yet"
            description="Create a recurring schedule above to generate documents on a cadence."
          />
        ) : (
          <div className="divide-y divide-line rounded-[4px] border border-line bg-white">
            {schedules.map((s) => {
              const due = s.status === "active" && isDue(s.nextRunAt, today);
              const pastEnd = isPastEnd(s.endDate, today);
              const sampleTotal =
                s.items.reduce((sum, item) => sum + item.amount, 0) || 0;
              return (
                <div
                  key={s._id.toHexString()}
                  className="flex flex-wrap items-start justify-between gap-4 px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          statusTones[s.status],
                        )}
                      >
                        {s.status}
                      </span>
                      <span className="text-xs text-muted">
                        {TYPE_META[s.type].label} · {intervalLabel(s.interval)}
                      </span>
                      {due ? (
                        <span className="rounded-full bg-royal/10 px-2 py-0.5 text-[11px] font-medium text-royal">
                          Due now
                        </span>
                      ) : null}
                      {pastEnd && s.status === "active" ? (
                        <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] text-muted">
                          Past end date
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {s.title || documentLabel(s.type, s.templateId)} ·{" "}
                      <span className="font-normal text-muted">
                        {s.items.length} line{s.items.length === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Next: {formatDate(s.nextRunAt)}
                      {s.lastRunAt
                        ? ` · Last run ${formatDate(s.lastRunAt)}`
                        : " · Never run"}
                      {s.runCount ? ` · ${s.runCount} generated` : ""}
                      {sampleTotal > 0
                        ? ` · ~${formatMoney(sampleTotal, s.currency)}`
                        : ""}
                    </p>
                  </div>
                  <ScheduleActions
                    id={s._id.toHexString()}
                    status={s.status}
                    lastDocumentId={s.lastDocumentId?.toHexString()}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        Signed in as {user.email}. Due schedules run automatically when you open this page.
      </p>
    </div>
  );
}
