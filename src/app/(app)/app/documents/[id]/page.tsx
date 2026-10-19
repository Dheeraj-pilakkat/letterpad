import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { toContactOption, toEditorDoc, toPdfWorkspace } from "@/lib/serialize";
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
    .findOne({ _id: objectId, workspaceId: workspace._id });
  if (!doc) notFound();

  const contacts = await collections
    .contacts()
    .find({ workspaceId: workspace._id, archived: false })
    .sort({ name: 1 })
    .toArray();

  return (
    <DocumentEditor
      workspace={toPdfWorkspace(workspace)}
      doc={toEditorDoc(doc)}
      contacts={contacts.map(toContactOption)}
    />
  );
}
