"use client";

import { useEffect, useState } from "react";
import type { PdfContact, PdfDoc, PdfWorkspace } from "@/pdf/DocumentPdf";
import { cn } from "@/lib/utils";

/**
 * Renders the real @react-pdf document in the browser and shows it in an
 * iframe — the preview is literally the file you download.
 */
export function PdfPreview({
  workspace,
  doc,
  contact,
  className,
  toolbar = false,
}: {
  workspace: PdfWorkspace;
  doc: PdfDoc;
  contact?: PdfContact | null;
  className?: string;
  toolbar?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const payload = JSON.stringify([workspace, doc, contact ?? null]);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [{ pdf }, { DocumentPdf }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/pdf/DocumentPdf"),
        ]);
        const [ws, dc, ct] = JSON.parse(payload) as [
          PdfWorkspace,
          PdfDoc,
          PdfContact | null,
        ];
        const blob = await pdf(
          <DocumentPdf workspace={ws} doc={dc} contact={ct} />,
        ).toBlob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        if (alive) {
          setUrl(objectUrl);
          setError(false);
        }
      } catch (err) {
        console.error("PDF preview failed", err);
        if (alive) setError(true);
      }
    }, 250);

    return () => {
      alive = false;
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payload]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-white text-sm text-red",
          className,
        )}
      >
        Preview failed — you can still download the PDF.
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-white",
          className,
        )}
      >
        <span className="animate-pulse text-xs text-muted">Rendering preview…</span>
      </div>
    );
  }

  return (
    <iframe
      src={`${url}#toolbar=${toolbar ? 1 : 0}&navpanes=0&scrollbar=1&view=FitH`}
      title="Document PDF preview"
      className={cn("border-0 bg-white", className)}
    />
  );
}
