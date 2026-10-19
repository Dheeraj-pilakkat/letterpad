"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveContact,
  createContact,
  updateContact,
} from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export interface ContactRow {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

const FIELDS = [
  ["name", "Contact name", "text", true],
  ["companyName", "Company", "text", false],
  ["email", "Email", "email", false],
  ["phone", "Phone", "text", false],
  ["addressLine1", "Address line 1", "text", false],
  ["addressLine2", "Address line 2", "text", false],
  ["city", "City", "text", false],
  ["state", "State / region", "text", false],
  ["postalCode", "Postal code", "text", false],
  ["country", "Country", "text", false],
] as const;

export function ContactDialog({
  contact,
  triggerLabel = "+ New contact",
}: {
  contact?: ContactRow;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""]),
    );
    setError(null);
    startTransition(async () => {
      const res = contact
        ? await updateContact(contact.id, input)
        : await createContact(input);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function archive() {
    if (!contact || !confirm(`Archive ${contact.name}?`)) return;
    startTransition(async () => {
      await archiveContact(contact.id);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          contact
            ? "text-sm text-copper hover:underline"
            : "inline-flex h-10 items-center rounded-[3px] bg-copper px-4 text-sm font-medium text-white hover:bg-copper-soft"
        }
      >
        {contact ? contact.name : triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[4px] border border-line bg-white p-6">
            <h2 className="mb-4 font-display text-xl text-ink">
              {contact ? "Edit contact" : "New contact"}
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map(([name, label, type, required]) => (
                  <Field
                    key={name}
                    label={label}
                    className={name === "name" || name === "companyName" ? "sm:col-span-2" : ""}
                  >
                    <Input
                      name={name}
                      type={type}
                      required={required}
                      defaultValue={contact?.[name] ?? ""}
                      placeholder={label}
                    />
                  </Field>
                ))}
              </div>
              <Field label="Notes">
                <Textarea
                  name="notes"
                  rows={2}
                  defaultValue={contact?.notes ?? ""}
                  placeholder="Preferred contact time, GST details, …"
                />
              </Field>
              {error ? (
                <p className="text-sm text-red" role="alert">{error}</p>
              ) : null}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {contact ? (
                    <button
                      type="button"
                      onClick={archive}
                      className="text-sm text-red hover:underline"
                    >
                      Archive contact
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Spinner /> : null}
                    Save contact
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
