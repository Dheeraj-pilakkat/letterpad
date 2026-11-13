import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { ensureDbReady } from "@/lib/db/client";
import { runAllDueSchedules } from "@/lib/recurring-runner";
import { runAutoReminders } from "@/lib/reminders";
import { runDueDeliveries } from "@/lib/deliveries";
import { runWorkflowMaintenance } from "@/lib/workflows-runner";

/**
 * Cron endpoint for recurring documents + Phase 5 automation.
 *
 * POST /api/cron/schedules
 * Headers: Authorization: Bearer <CRON_SECRET>  (or x-cron-secret: <CRON_SECRET>)
 *
 * Runs, across ALL workspaces:
 *   1. due recurring schedules  → generates the next draft document
 *   2. workflow maintenance     → expires quotations, marks invoices overdue
 *   3. automatic payment reminders (needs RESEND_API_KEY to actually send)
 *   4. scheduled document deliveries (same email requirement)
 *
 * Safe to call repeatedly — every step is idempotent per record. Schedule a
 * job (Vercel Cron, GitHub Actions, cron job) to hit this at least daily;
 * hourly gives reminders and deliveries tighter timing.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  if (!secureEquals(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDbReady();

    const schedules = await runAllDueSchedules();
    const workflows = await runWorkflowMaintenance();
    const reminders = await runAutoReminders();
    const deliveries = await runDueDeliveries();

    return NextResponse.json({
      ok: true,
      // `ran`/`failed` kept for backward compatibility with older monitors
      ran: schedules.ran,
      failed: schedules.failed,
      schedules,
      workflows,
      reminders,
      deliveries,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Cron run failed" },
      { status: 500 },
    );
  }
}

/** Length-safe constant-time string comparison. */
function secureEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
