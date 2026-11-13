"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { financeCsv } from "@/lib/finance";

/** Client-side CSV export of the finance ledger rows passed from the server. */
export function ExportCsvButton({
  rows,
  filename = `letterpad-finance-${new Date().toISOString().slice(0, 10)}.csv`,
  label = "Export CSV",
}: {
  rows: Array<Record<string, string | number>>;
  filename?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  function exportCsv() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const csv = financeCsv(rows);
      const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={busy || rows.length === 0}
      className="inline-flex h-10 items-center gap-1.5 rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40 disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label}
    </button>
  );
}
