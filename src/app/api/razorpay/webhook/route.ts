import { NextResponse, type NextRequest } from "next/server";
import { collections } from "@/lib/db/client";
import { balanceOf } from "@/lib/finance";
import { recordPaymentForDocument } from "@/lib/payments-core";
import { toObjectId } from "@/lib/auth/session";
import { isPlanId } from "@/lib/plans";
import { activatePlan } from "@/lib/subscription";
import {
  razorpaySecretFor,
  verifyWebhookSignature,
  type RazorpayWebhookEvent,
} from "@/lib/razorpay";
import { todayIsoDate } from "@/lib/utils";

/**
 * Razorpay webhook — records captured online payments server-side even if
 * the browser never called /api/razorpay/verify. Signature: HMAC-SHA256 of
 * the raw body with the key secret.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(raw) as RazorpayWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id;
  if (!orderId) {
    // Nothing we can act on (e.g. payment.authorized without order context).
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Resolve the workspace through the document that owns this order.
  const doc = await collections
    .documents()
    .findOne({ razorpayOrderId: orderId, deletedAt: null });

  if (!doc) {
    // Not a document payment — maybe a plan checkout (§20): the order's
    // notes carry workspaceId + plan, copied onto the payment entity.
    const notes = paymentEntity?.notes;
    const wsObjectId = notes?.workspaceId ? toObjectId(notes.workspaceId) : null;
    if (notes?.kind === "subscription" && wsObjectId && isPlanId(notes.plan)) {
      const subWorkspace = await collections
        .workspaces()
        .findOne({ _id: wsObjectId });
      const subSecret = subWorkspace ? razorpaySecretFor(subWorkspace) : null;
      if (subWorkspace && subSecret && verifyWebhookSignature(raw, signature, subSecret)) {
        if (
          event.event === "payment.captured" &&
          subWorkspace.pendingPlanOrder === orderId &&
          subWorkspace.pendingPlan === notes.plan
        ) {
          await activatePlan({
            workspaceId: subWorkspace._id,
            plan: notes.plan,
            provider: "razorpay",
            referenceId: orderId,
          });
        }
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ ok: true, ignored: true });
  }

  const workspace = await collections.workspaces().findOne({ _id: doc.workspaceId });
  if (!workspace) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const secret = razorpaySecretFor(workspace);
  if (!secret || !verifyWebhookSignature(raw, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.event !== "payment.captured") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const paymentId = paymentEntity?.id;
  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Idempotent: skip if the verify route (or an earlier webhook) recorded it.
  const already = await collections
    .payments()
    .findOne({ workspaceId: workspace._id, reference: paymentId });
  if (already) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const payments = await collections.payments().find({ documentId: doc._id }).toArray();
  const balance = balanceOf(doc.total, payments);
  if (balance <= 0) {
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  const res = await recordPaymentForDocument({
    workspace,
    userId: "razorpay-webhook",
    documentId: doc._id.toHexString(),
    input: {
      amount: balance,
      date: todayIsoDate(),
      method: "online",
      reference: paymentId,
      notes: `Razorpay webhook ${event.event} · order ${orderId}`,
    },
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? "Failed to record payment" }, { status: 500 });
  }

  await collections
    .documents()
    .updateOne(
      { _id: doc._id, workspaceId: workspace._id },
      { $unset: { razorpayOrderId: "" }, $set: { updatedAt: new Date() } },
    );

  return NextResponse.json({ ok: true });
}
