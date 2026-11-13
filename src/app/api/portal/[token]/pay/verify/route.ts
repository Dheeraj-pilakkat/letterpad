import { NextResponse, type NextRequest } from "next/server";
import { collections } from "@/lib/db/client";
import { balanceOf } from "@/lib/finance";
import { portalDocument } from "@/lib/portal-token";
import { recordPaymentForDocument } from "@/lib/payments-core";
import { razorpaySecretFor, verifyCheckoutSignature } from "@/lib/razorpay";
import { todayIsoDate } from "@/lib/utils";

interface VerifyBody {
  documentId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

/** Confirm a Razorpay Checkout payment made from the client portal. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as VerifyBody | null;
  const { documentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
  if (!documentId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment verification data" }, { status: 400 });
  }

  const resolved = await portalDocument(token, documentId);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { workspace, doc } = resolved;

  const secret = razorpaySecretFor(workspace);
  if (!secret) {
    return NextResponse.json({ error: "Online payment is not available" }, { status: 400 });
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
    userId: "client",
    documentId: doc._id.toHexString(),
    input: {
      amount: balance,
      date: todayIsoDate(),
      method: "online",
      reference: razorpay_payment_id,
      notes: `Razorpay order ${razorpay_order_id} (client portal)`,
    },
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? "Failed to record payment" }, { status: 400 });
  }

  await collections.documents().updateOne(
    { _id: doc._id, workspaceId: workspace._id },
    { $unset: { razorpayOrderId: "" }, $set: { updatedAt: new Date() } },
  );

  return NextResponse.json({ ok: true, status: "paid" });
}
