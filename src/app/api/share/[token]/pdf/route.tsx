import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSharedDocument, recordShareView } from "@/lib/actions/sharing";
import { toPdfContact, toPdfDoc, toPdfWorkspace } from "@/lib/serialize";
import { DocumentPdf } from "@/pdf/DocumentPdf";
import { documentLabel } from "@/lib/templates/registry";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const shared = await getSharedDocument(token);
  if (!shared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await recordShareView(token);
  const { doc, workspace, contact } = shared;

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
