"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth/config";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { workspaceSchema } from "@/lib/validation/schemas";
import { slugify } from "@/lib/utils";

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return session.user.id;
}

function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

/** Brand colours arrive as a JSON array in a hidden field. */
function parseBrandColors(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string")
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Numbering maps arrive as flat form fields:
 *   numberPrefix.invoice=INV  numberStarts.invoice=100
 */
function parseNumberMap(
  raw: unknown,
  numeric = false,
): Partial<Record<string, string | number>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const map = raw as Record<string, unknown>;
  const out: Partial<Record<string, string | number>> = {};
  const types = [
    "letter",
    "quote",
    "invoice",
    "receipt",
    "request",
    "creditNote",
    "debitNote",
  ] as const;
  for (const type of types) {
    const prefix = map[`numberPrefix.${type}`];
    const start = map[`numberStart.${type}`];
    if (numeric) {
      if (start !== undefined && start !== "") {
        const n = Number(start);
        if (Number.isFinite(n)) out[type] = n;
      }
    } else if (typeof prefix === "string" && prefix.trim()) {
      out[type] = prefix.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function createWorkspace(
  formData: FormData,
): Promise<{ error?: string }> {
  const userId = await requireUserId();

  const existing = await collections
    .workspaces()
    .findOne({ ownerUserId: userId });
  if (existing) {
    redirect("/app");
  }

  const raw = formDataToObject(formData);
  const parsed = workspaceSchema.safeParse({
    name: raw.name,
    logo: raw.logo || undefined,
    currency: raw.currency || "USD",
    taxRate: raw.taxRate === "" || raw.taxRate === undefined ? 0 : raw.taxRate,
    brandColor: raw.brandColor || "#B4552D",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const now = new Date();
  const slug = `${slugify(parsed.data.name) || "business"}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  await collections.workspaces().insertOne({
    _id: new ObjectId(),
    name: parsed.data.name,
    slug,
    ownerUserId: userId,
    logo: parsed.data.logo || undefined,
    currency: parsed.data.currency,
    taxRate: parsed.data.taxRate,
    brandColor: parsed.data.brandColor,
    brandColors: [parsed.data.brandColor],
    createdAt: now,
    updatedAt: now,
  });

  redirect("/app/company");
}

export async function updateWorkspace(
  formData: FormData,
): Promise<{ error?: string }> {
  const { workspace, role } = await requireWorkspace();
  if (role === "member") {
    return { error: "Only owners and admins can edit business details" };
  }

  const raw = formDataToObject(formData);
  const numberPrefixes = parseNumberMap(raw.numberPrefixes);
  const numberStarts = parseNumberMap(raw.numberStarts, true);
  const parsed = workspaceSchema.safeParse({
    name: raw.name,
    logo: raw.logo || undefined,
    signature: raw.signature || undefined,
    addressLine1: raw.addressLine1 || undefined,
    addressLine2: raw.addressLine2 || undefined,
    city: raw.city || undefined,
    state: raw.state || undefined,
    postalCode: raw.postalCode || undefined,
    country: raw.country || undefined,
    phone: raw.phone || undefined,
    email: raw.email || undefined,
    website: raw.website || undefined,
    taxId: raw.taxId || undefined,
    pan: raw.pan || undefined,
    upiId: raw.upiId || undefined,
    paymentInstructions: raw.paymentInstructions || undefined,
    bankDetails: raw.bankDetails || undefined,
    gstEnabled: raw.gstEnabled === "on" || raw.gstEnabled === true,
    placeOfSupply: raw.placeOfSupply || undefined,
    currency: raw.currency,
    taxRate: raw.taxRate,
    taxLabel: raw.taxLabel || undefined,
    taxCountry: raw.taxCountry || undefined,
    brandColor: raw.brandColor,
    brandColors: parseBrandColors(raw.brandColors),
    numberPrefixes,
    numberPad: raw.numberPad === "" || raw.numberPad === undefined ? undefined : raw.numberPad,
    numberStarts,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const d = parsed.data;
  const taxConfig =
    d.taxLabel || d.taxCountry
      ? {
          ...(d.taxLabel ? { label: d.taxLabel } : {}),
          ...(d.taxCountry ? { country: d.taxCountry } : {}),
        }
      : undefined;

  await collections.workspaces().updateOne(
    { _id: workspace._id },
    {
      $set: {
        name: d.name,
        logo: d.logo || undefined,
        signature: d.signature || undefined,
        addressLine1: d.addressLine1 || undefined,
        addressLine2: d.addressLine2 || undefined,
        city: d.city || undefined,
        state: d.state || undefined,
        postalCode: d.postalCode || undefined,
        country: d.country || undefined,
        phone: d.phone || undefined,
        email: d.email || undefined,
        website: d.website || undefined,
        taxId: d.taxId || undefined,
        pan: d.pan || undefined,
        upiId: d.upiId || undefined,
        paymentInstructions: d.paymentInstructions || undefined,
        bankDetails: d.bankDetails || undefined,
        gstEnabled: d.gstEnabled || undefined,
        placeOfSupply: d.placeOfSupply || undefined,
        currency: d.currency,
        taxRate: d.taxRate,
        brandColor: d.brandColors?.[0] ?? d.brandColor,
        brandColors: d.brandColors ?? [d.brandColor],
        numberPrefixes: d.numberPrefixes ?? undefined,
        numberPad: d.numberPad ?? undefined,
        numberStarts: d.numberStarts ?? undefined,
        ...(taxConfig ? { taxConfig } : {}),
        updatedAt: new Date(),
      },
      ...(taxConfig ? {} : { $unset: { taxConfig: "" } }),
    },
  );

  revalidatePath("/app/company");
  revalidatePath("/app");
  return {};
}

/** Save Razorpay Checkout credentials (key id + secret) for online payments. */
export async function saveRazorpaySettings(formData: FormData): Promise<{ error?: string }> {
  const { workspace, role } = await requireWorkspace();
  if (role === "member") {
    return { error: "Only owners and admins can change payment settings" };
  }

  const keyId = String(formData.get("razorpayKeyId") ?? "").trim();
  const keySecret = String(formData.get("razorpayKeySecret") ?? "").trim();

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  const $unset: Record<string, ""> = {};
  if (keyId) $set.razorpayKeyId = keyId;
  else $unset.razorpayKeyId = "";
  if (keySecret) $set.razorpayKeySecret = keySecret;
  else $unset.razorpayKeySecret = "";

  await collections
    .workspaces()
    .updateOne({ _id: workspace._id }, { $set, $unset });
  revalidatePath("/app/settings");
  return {};
}

