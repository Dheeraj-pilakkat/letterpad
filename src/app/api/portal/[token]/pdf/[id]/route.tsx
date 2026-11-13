import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPortalDocument, recordPortalView } from "@/lib/actions/portal";
import { toPdfContact, toPdfDoc, toPdfWorkspace } from "@/lib/serialize";
import { DocumentPdf } from "@/pdf/DocumentPdf";
import { documentLabel } from "@/lib/templates/registry";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await ctx.params;
  const data = await getPortalDocument(token, id);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await recordPortalView(token, id);
  const { doc, workspace, contact } = data;

  const buffer = await renderToBuffer(
    <DocumentPdf
      workspace={toPdfWorkspace(workspace)}
      doc={toPdfDoc(doc)}
      contact={toPdfContact(contact)}
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
