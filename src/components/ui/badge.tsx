import { cn } from "@/lib/utils";
import type { DocumentStatus, DocumentType } from "@/lib/db/types";

const statusTones: Record<DocumentStatus, string> = {
  draft: "bg-paper-dim text-ink-soft",
  sent: "bg-ink/10 text-ink",
  paid: "bg-forest/15 text-forest",
  accepted: "bg-forest/15 text-forest",
  void: "bg-red/10 text-red",
};

const typeTones: Record<DocumentType, string> = {
  quote: "bg-copper/10 text-copper",
  invoice: "bg-ink/10 text-ink",
  request: "bg-forest/10 text-forest",
  receipt: "bg-amber/15 text-amber-ink",
  letter: "bg-paper-dim text-ink-soft",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        statusTones[status],
      )}
    >
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: DocumentType }) {
  const labels: Record<DocumentType, string> = {
    quote: "Quotation",
    invoice: "Bill",
    request: "Request",
    receipt: "Receipt",
    letter: "Letter",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        typeTones[type],
      )}
    >
      {labels[type]}
    </span>
  );
}
