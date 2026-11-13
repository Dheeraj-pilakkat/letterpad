import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { collections } from "@/lib/db/client";
import { resolveWorkspace, toObjectId } from "@/lib/auth/session";
import { balanceOf } from "@/lib/finance";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyIdFor,
  razorpaySecretFor,
  toMinorUnits,
} from "@/lib/razorpay";

/** Create a Razorpay order for the outstanding balance of a payable document. */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
  const objectId = body?.documentId ? toObjectId(body.documentId) : null;
  if (!objectId) {
    return NextResponse.json({ error: "Invalid document id" }, { status: 400 });
  }

  const resolved = await resolveWorkspace(session.user);
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const workspace = resolved.workspace;

  const doc = await collections
    .documents()
    .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!["invoice", "quote", "request"].includes(doc.type)) {
    return NextResponse.json({ error: "Online payments are only available on bills" }, { status: 400 });
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
      { error: "Razorpay is not configured — add your keys in Settings." },
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
    return NextResponse.json({ error: order.error ?? "Failed to create order" }, { status: 502 });
  }

  await collections
    .documents()
    .updateOne(
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
