import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth/config";
import { collections } from "@/lib/db/client";
import { toObjectId } from "@/lib/auth/session";
import { toPdfContact, toPdfDoc, toPdfWorkspace } from "@/lib/serialize";
import { DocumentPdf } from "@/pdf/DocumentPdf";
import { documentLabel } from "@/lib/templates/registry";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const objectId = toObjectId(id);
  if (!objectId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workspace = await collections
    .workspaces()
    .findOne({ ownerUserId: session.user.id });
  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await collections
    .documents()
    .findOne({ _id: objectId, workspaceId: workspace._id });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contact = doc.contactId
    ? await collections
        .contacts()
        .findOne({ _id: doc.contactId, workspaceId: workspace._id })
    : null;

  const buffer = await renderToBuffer(
    <DocumentPdf
      workspace={toPdfWorkspace(workspace)}
      doc={toPdfDoc(doc)}
      contact={contact ? toPdfContact(contact) : null}
    />,
  );

  const label = documentLabel(doc.type, doc.templateId).replace(/\s+/g, "-");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${label}-${doc.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
