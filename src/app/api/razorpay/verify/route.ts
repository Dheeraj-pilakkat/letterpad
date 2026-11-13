import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { collections } from "@/lib/db/client";
import { resolveWorkspace, toObjectId } from "@/lib/auth/session";
import { balanceOf } from "@/lib/finance";
import { recordPaymentForDocument } from "@/lib/payments-core";
import { razorpaySecretFor, verifyCheckoutSignature } from "@/lib/razorpay";
import { isPlanId } from "@/lib/plans";
import { activatePlan } from "@/lib/subscription";
import { todayIsoDate } from "@/lib/utils";

interface VerifyBody {
  documentId?: string;
  /** Plan checkout confirmation (§20) */
  plan?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

/** Confirm a Razorpay Checkout payment (document payment or plan upgrade). */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as VerifyBody | null;
  const { documentId, plan, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment verification data" }, { status: 400 });
  }

  const resolved = await resolveWorkspace(session.user);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const workspace = resolved.workspace;

  const secret = razorpaySecretFor(workspace);
  if (!secret) {
    return NextResponse.json({ error: "Razorpay is not configured" }, { status: 400 });
  }

  const valid = verifyCheckoutSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    secret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  // ---- Plan checkout (§20 subscription billing) ----
  if (plan && !documentId) {
    if (!isPlanId(plan) || plan === "free") {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    // The order must be the one this workspace started checkout with.
    if (workspace.pendingPlanOrder !== razorpay_order_id) {
      return NextResponse.json({ error: "Order does not match this workspace" }, { status: 400 });
    }
    if (workspace.pendingPlan !== plan) {
      return NextResponse.json({ error: "Order does not match this plan" }, { status: 400 });
    }
    await activatePlan({
      workspaceId: workspace._id,
      plan,
      provider: "razorpay",
      referenceId: razorpay_order_id,
    });
    revalidatePath("/app/settings/billing");
    return NextResponse.json({ ok: true, plan });
  }

  const objectId = documentId ? toObjectId(documentId) : null;
  if (!objectId) {
    return NextResponse.json({ error: "Missing payment verification data" }, { status: 400 });
  }

  const doc = await collections
    .documents()
    .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (doc.razorpayOrderId && doc.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Order does not match this document" }, { status: 400 });
  }

  // Idempotency: the webhook may have recorded this payment already.
  const already = await collections
    .payments()
    .findOne({ workspaceId: workspace._id, reference: razorpay_payment_id });
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
    userId: session.user.id,
    documentId: doc._id.toHexString(),
    input: {
      amount: balance,
      date: todayIsoDate(),
      method: "online",
      reference: razorpay_payment_id,
      notes: `Razorpay order ${razorpay_order_id}`,
    },
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? "Failed to record payment" }, { status: 400 });
  }

  await collections
    .documents()
    .updateOne(
      { _id: doc._id, workspaceId: workspace._id },
      { $unset: { razorpayOrderId: "" }, $set: { updatedAt: new Date() } },
    );

  return NextResponse.json({ ok: true, status: "paid" });
}
