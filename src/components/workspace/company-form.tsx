"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkspace } from "@/lib/actions/workspace";
import type { Workspace } from "@/lib/db/types";
import { BRAND_COLORS, CURRENCIES } from "@/lib/constants";
import { NUMBER_PREFIX, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

type WorkspaceDTO = Omit<Workspace, "_id" | "createdAt" | "updatedAt" | "ownerUserId" | "slug">;

function ImagePicker({
  label,
  hint,
  value,
  onPick,
}: {
  label: string;
  hint: string;
  value: string;
  onPick: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Must be a PNG or JPEG");
      return;
    }
    if (file.size > 700 * 1024) {
      setError("Must be under 700KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onPick(String(reader.result));
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-soft">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-paper">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted">EMPTY</span>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">{hint}</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              Upload
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onPick("")}>
                Remove
              </Button>
            ) : null}
          </div>
          {error ? <p className="mt-1 text-xs text-red">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function CompanyForm({ workspace }: { workspace: WorkspaceDTO }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();
  const [logo, setLogo] = useState(workspace.logo ?? "");
  const [signature, setSignature] = useState(workspace.signature ?? "");
  const [colors, setColors] = useState<string[]>(
    workspace.brandColors?.length
      ? workspace.brandColors
      : [workspace.brandColor],
  );

  const MAX_COLORS = 6;

  function toggleColor(c: string) {
    const hex = c.toUpperCase();
    setColors((prev) => {
      const exists = prev.some((x) => x.toUpperCase() === hex);
      if (exists) {
        const next = prev.filter((x) => x.toUpperCase() !== hex);
        return next.length > 0 ? next : prev; // palette must keep ≥ 1 colour
      }
      if (prev.length >= MAX_COLORS) return prev;
      return [...prev, hex];
    });
  }

  function addCustomColor(c: string) {
    const hex = c.toUpperCase();
    setColors((prev) =>
      prev.some((x) => x.toUpperCase() === hex) || prev.length >= MAX_COLORS
        ? prev
        : [...prev, hex],
    );
  }

  function makePrimary(index: number) {
    setColors((prev) =>
      index <= 0
        ? prev
        : [prev[index], ...prev.filter((_, i) => i !== index)],
    );
  }

  function removeColor(index: number) {
    setColors((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("logo", logo);
    fd.set("signature", signature);
    fd.set("brandColor", colors[0] ?? workspace.brandColor);
    fd.set("brandColors", JSON.stringify(colors));
    setError(null);
    setFlash(false);
    startTransition(async () => {
      const res = await updateWorkspace(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setFlash(true);
      router.refresh();
      setTimeout(() => setFlash(false), 2500);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" className="sm:col-span-2">
            <Input name="name" required defaultValue={workspace.name} />
          </Field>
          <ImagePicker
            label="Logo"
            hint="PNG or JPEG, under 700KB. Shown on the letterhead."
            value={logo}
            onPick={setLogo}
          />
          <ImagePicker
            label="Signature"
            hint="PNG or JPEG with transparent/white background."
            value={signature}
            onPick={setSignature}
          />
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-ink-soft">Brand colours</p>
            <p className="text-[11px] text-muted">
              {colors.length} of {MAX_COLORS} · click a colour to make it primary
            </p>
          </div>

          {/* selected palette */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {colors.map((c, i) => (
              <div key={c.toUpperCase()} className="relative">
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  aria-label={`${c}${i === 0 ? " (primary)" : " — make primary"}`}
                  aria-pressed={i === 0}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-transform hover:scale-105",
                    i === 0
                      ? "ring-2 ring-ink ring-offset-2"
                      : "ring-1 ring-line ring-offset-2",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {i === 0 ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-white drop-shadow">
                      Main
                    </span>
                  ) : null}
                </button>
                {colors.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    aria-label={`Remove colour ${c}`}
                    className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-line bg-white text-[10px] leading-none text-muted shadow-sm hover:text-red"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {colors.length >= MAX_COLORS ? (
              <span className="text-[11px] text-amber-ink">Max {MAX_COLORS} colours</span>
            ) : null}
          </div>

          {/* presets — click to add / remove from the palette */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted">Presets</span>
            {BRAND_COLORS.map((c) => {
              const selected = colors.some((x) => x.toUpperCase() === c.toUpperCase());
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleColor(c)}
                  aria-label={`${selected ? "Remove" : "Add"} preset colour ${c}`}
                  aria-pressed={selected}
                  className={cn(
                    "size-8 rounded-full border-2 transition-transform",
                    selected
                      ? "scale-110 border-ink"
                      : "border-transparent hover:scale-110",
                  )}
                  style={{ backgroundColor: c }}
                />
              );
            })}
          </div>

          {/* custom colour picker */}
          <div className="mt-3 flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] border border-line bg-white px-2.5 py-1.5 text-xs text-ink hover:border-ink/40">
              <input
                type="color"
                defaultValue={colors[colors.length - 1] ?? "#B4552D"}
                onChange={(e) => addCustomColor(e.target.value)}
                aria-label="Pick a custom colour to add"
                className="size-5 cursor-pointer appearance-none border-0 bg-transparent p-0"
              />
              Add custom colour
            </label>
            <span className="font-mono text-xs text-muted">
              {colors.join(" · ")}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            The first colour is used on new documents — each document can pick any
            of these as its accent.
          </p>
        </div>
      </section>

      {/* address */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" className="sm:col-span-2">
            <Input name="addressLine1" defaultValue={workspace.addressLine1} placeholder="14 Brigade Road" />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input name="addressLine2" defaultValue={workspace.addressLine2} />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={workspace.city} />
          </Field>
          <Field label="State / region">
            <Input name="state" defaultValue={workspace.state} />
          </Field>
          <Field label="Postal code">
            <Input name="postalCode" defaultValue={workspace.postalCode} />
          </Field>
          <Field label="Country">
            <Input name="country" defaultValue={workspace.country} />
          </Field>
        </div>
      </section>

      {/* contact */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input name="email" type="email" defaultValue={workspace.email} placeholder="hello@business.com" />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={workspace.phone} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <Input name="website" defaultValue={workspace.website} placeholder="business.com" />
          </Field>
        </div>
      </section>

      {/* finance */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Finance</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax ID / GSTIN">
            <Input name="taxId" defaultValue={workspace.taxId} />
          </Field>
          <Field label="PAN">
            <Input name="pan" defaultValue={workspace.pan} placeholder="ABCDE1234F" />
          </Field>
          <Field
            label="Tax label"
            hint="Printed on PDFs in place of “Tax” — GST, VAT, Sales Tax…"
          >
            <Input
              name="taxLabel"
              defaultValue={workspace.taxConfig?.label}
              placeholder="GST"
              maxLength={40}
            />
          </Field>
          <Field
            label="Tax jurisdiction"
            hint="Country or region the tax applies to"
          >
            <Input
              name="taxCountry"
              defaultValue={workspace.taxConfig?.country}
              placeholder="India"
              maxLength={64}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Currency">
              <Select name="currency" defaultValue={workspace.currency}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Default tax %">
              <Input
                name="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={workspace.taxRate}
              />
            </Field>
          </div>
          <Field label="UPI ID" hint="Shown in payment details on bills">
            <Input name="upiId" defaultValue={workspace.upiId} placeholder="business@okhdfcbank" />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer select-none items-start gap-2">
              <input
                type="checkbox"
                name="gstEnabled"
                defaultChecked={workspace.gstEnabled === true}
                className="mt-0.5 size-3.5 accent-royal"
              />
              <span>
                <span className="text-xs font-medium text-ink-soft">Enable GST</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Splits tax into CGST/SGST (same state) or IGST (inter-state) on documents.
                </span>
              </span>
            </label>
            <div className="mt-3">
              <Field label="Place of supply" hint="State used to decide intra-state vs inter-state GST">
                <Input
                  name="placeOfSupply"
                  defaultValue={workspace.placeOfSupply ?? workspace.state}
                  placeholder="Karnataka"
                  className="sm:max-w-64"
                />
              </Field>
            </div>
          </div>
          <Field label="Payment instructions" className="sm:col-span-2">
            <Textarea
              name="paymentInstructions"
              rows={2}
              defaultValue={workspace.paymentInstructions}
              placeholder="Pay within 7 days. Reference the invoice number when paying."
            />
          </Field>
          <Field label="Bank details" hint="Printed on bills and payment requests" className="sm:col-span-2">
            <Textarea
              name="bankDetails"
              rows={3}
              defaultValue={workspace.bankDetails}
              placeholder={"Bank: HDFC Bank · A/C 50200012345678\nIFSC HDFC0001234 · Branch: MG Road"}
            />
          </Field>
        </div>
      </section>

      {/* document numbering */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-ink">Document numbering</h2>
        <p className="text-xs text-muted">
          Customise the prefix, starting number and zero-pad for each document type.
          Existing counters keep their current sequence.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Prefix</th>
                <th className="py-2 pr-3">Start at</th>
                <th className="py-2">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {(
                [
                  ["invoice", "Bill"],
                  ["quote", "Quotation"],
                  ["receipt", "Receipt"],
                  ["request", "Request"],
                  ["letter", "Letter"],
                  ["creditNote", "Credit Note"],
                  ["debitNote", "Debit Note"],
                ] as const
              ).map(([type, label]) => {
                const prefix =
                  workspace.numberPrefixes?.[type] ?? NUMBER_PREFIX[type];
                const start = workspace.numberStarts?.[type] ?? 1;
                const pad = workspace.numberPad ?? 4;
                const example = `${prefix}-${String(start).padStart(pad, "0")}`;
                return (
                  <tr key={type}>
                    <td className="py-2 pr-3 text-ink">{label}</td>
                    <td className="py-2 pr-3">
                      <Input
                        name={`numberPrefix.${type}`}
                        defaultValue={workspace.numberPrefixes?.[type] ?? ""}
                        placeholder={prefix}
                        className="h-8 w-24 text-xs"
                        maxLength={8}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        name={`numberStart.${type}`}
                        type="number"
                        min={0}
                        defaultValue={workspace.numberStarts?.[type] ?? ""}
                        placeholder={String(start)}
                        className="h-8 w-24 text-xs"
                      />
                    </td>
                    <td className="py-2 font-mono text-xs text-muted">{example}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Field label="Zero-pad width" hint="Digits in the number segment (4 → 0001)">
          <Input
            name="numberPad"
            type="number"
            min={1}
            max={8}
            defaultValue={workspace.numberPad ?? 4}
            className="w-28"
          />
        </Field>
      </section>

      {error ? <p className="text-sm text-red" role="alert">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Save letterhead
        </Button>
        {flash ? <span className="text-sm text-forest">Saved — new documents use these details.</span> : null}
      </div>
    </form>
  );
}
