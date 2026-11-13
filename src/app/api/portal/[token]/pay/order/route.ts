import { NextResponse, type NextRequest } from "next/server";
import { collections } from "@/lib/db/client";
import { balanceOf } from "@/lib/finance";
import { portalDocument } from "@/lib/portal-token";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyIdFor,
  razorpaySecretFor,
  toMinorUnits,
} from "@/lib/razorpay";

/** Create a Razorpay order for a document the portal contact can see. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
  if (!body?.documentId) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const resolved = await portalDocument(token, body.documentId);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { workspace, doc } = resolved;

  if (!["invoice", "quote", "request"].includes(doc.type)) {
    return NextResponse.json(
      { error: "Online payments are only available on bills" },
      { status: 400 },
    );
  }

  const payments = await collections.payments().find({ documentId: doc._id }).toArray();
  const balance = balanceOf(doc.total, payments);
  if (balance <= 0) {
    return NextResponse.json({ error: "This document is fully paid" }, { status: 400 });
  }

  const keyId = razorpayKeyIdFor(workspace);
  const secret = razorpaySecretFor(workspace);
  if (!keyId || !secret || !isRazorpayConfigured(workspace)) {
    return NextResponse.json(
      { error: "Online payment is not available for this account" },
      { status: 400 },
    );
  }

  const order = await createRazorpayOrder({
    keyId,
    secret,
    amountMinor: toMinorUnits(balance),
    currency: doc.currency,
    receipt: `${doc.number}-${Date.now()}`.replace(/[^\w.-]/g, "-"),
    notes: { documentId: doc._id.toHexString(), number: doc.number },
  });
  if (!order.ok || !order.orderId) {
    return NextResponse.json(
      { error: order.error ?? "Failed to create order" },
      { status: 502 },
    );
  }

  await collections.documents().updateOne(
    { _id: doc._id, workspaceId: workspace._id },
    { $set: { razorpayOrderId: order.orderId, updatedAt: new Date() } },
  );

  return NextResponse.json({
    orderId: order.orderId,
    keyId,
    amount: toMinorUnits(balance),
    currency: doc.currency,
    docNumber: doc.number,
  });
}
