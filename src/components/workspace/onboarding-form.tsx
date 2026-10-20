"use client";

import { useRef, useState, useTransition } from "react";
import { createWorkspace } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";
import { CURRENCIES } from "@/lib/constants";

export function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState<string>("");
  const logoInput = useRef<HTMLInputElement>(null);

  function handleLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Logo must be a PNG or JPEG");
      return;
    }
    if (file.size > 700 * 1024) {
      setError("Logo must be under 700KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(String(reader.result));
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (logoPreview) fd.set("logo", logoPreview);
    setError(null);
    startTransition(async () => {
      const res = await createWorkspace(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Business name" hint="This appears on every letterhead">
        <Input name="name" required placeholder="Meridian Studio" />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-paper">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo preview" className="size-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted">LOGO</span>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-ink-soft">Logo (optional)</p>
          <p className="mb-1 text-xs text-muted">PNG or JPEG, under 700KB</p>
          <input
            ref={logoInput}
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => handleLogo(e.target.files?.[0])}
            className="text-xs text-muted file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Currency">
          <Select name="currency" defaultValue="USD">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Default tax rate (%)">
          <Input name="taxRate" type="number" min={0} max={100} step="0.01" defaultValue={0} />
        </Field>
      </div>

      <input type="hidden" name="brandColor" value="#B4552D" />

      {error ? <p className="text-sm text-red" role="alert">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        Create my letterhead
      </Button>
    </form>
  );
}
