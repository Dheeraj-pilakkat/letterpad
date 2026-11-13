import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { listDocumentActivity } from "@/lib/activity";
import { aiConfigured } from "@/lib/ai";
import { hasPlanFeature } from "@/lib/plans";
import { toContactOption, toEditorDoc, toPaymentDTO, toPdfWorkspace } from "@/lib/serialize";
import { loadProfileForDoc } from "@/lib/profiles";
import { razorpayKeyIdFor } from "@/lib/razorpay";
import { DocumentEditor } from "@/components/documents/document-editor";

export const metadata: Metadata = { title: "Edit document" };

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const objectId = toObjectId(id);
  if (!objectId) notFound();

  const doc = await collections
    .documents()
    .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
  if (!doc) notFound();

  const [contacts, events, payments, deliveries] = await Promise.all([
    collections
      .contacts()
      .find({ workspaceId: workspace._id, archived: false })
      .sort({ name: 1 })
      .toArray(),
    listDocumentActivity(workspace._id, objectId),
    collections
      .payments()
      .find({ documentId: objectId })
      .sort({ date: -1, createdAt: -1 })
      .toArray(),
    collections
      .deliveries()
      .find({ documentId: objectId })
      .sort({ sendAt: -1 })
      .limit(10)
      .toArray(),
  ]);

  return (
    <DocumentEditor
      workspace={toPdfWorkspace(workspace, await loadProfileForDoc(doc))}
      doc={toEditorDoc(doc)}
      contacts={contacts.map(toContactOption)}
      payments={payments.map(toPaymentDTO)}
      razorpayKeyId={razorpayKeyIdFor(workspace)}
      aiEnabled={aiConfigured() && hasPlanFeature(workspace, "ai")}
      deliveries={deliveries.map((d) => ({
        id: d._id.toHexString(),
        sendAt: d.sendAt,
        to: d.to,
        status: d.status,
        error: d.error,
      }))}
      activity={events.map((e) => ({
        id: e._id.toHexString(),
        type: e.type,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
