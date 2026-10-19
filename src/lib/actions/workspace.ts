"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth/config";
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
  const userId = await requireUserId();
  const workspace = await collections
    .workspaces()
    .findOne({ ownerUserId: userId });
  if (!workspace) redirect("/onboarding");

  const raw = formDataToObject(formData);
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
    bankDetails: raw.bankDetails || undefined,
    currency: raw.currency,
    taxRate: raw.taxRate,
    brandColor: raw.brandColor,
    brandColors: parseBrandColors(raw.brandColors),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const d = parsed.data;
  await collections.workspaces().updateOne(
    { _id: workspace._id, ownerUserId: userId },
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
        bankDetails: d.bankDetails || undefined,
        currency: d.currency,
        taxRate: d.taxRate,
        brandColor: d.brandColors?.[0] ?? d.brandColor,
        brandColors: d.brandColors ?? [d.brandColor],
        updatedAt: new Date(),
      },
    },
  );

  revalidatePath("/app/company");
  revalidatePath("/app");
  return {};
}

export async function switchWorkspace(): Promise<void> {
  // MVP: one workspace per account — no-op kept for future multi-workspace.
  redirect("/app");
}

