"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { profileSchema } from "@/lib/validation/schemas";
import {
  formDataToObject,
  parseBrandColors,
  parseNumberMap,
} from "@/lib/form-parsers";
import {
  getActiveProfileCookie,
  setActiveProfileCookie,
} from "@/lib/profiles";
import type { Workspace } from "@/lib/db/types";

export type ActionResult = { ok: boolean; error?: string; id?: string };

/**
 * Parse a profile form. `defaults` (the workspace branding) fills every field
 * the form didn't submit — create uses it to snapshot the workspace identity
 * into the new profile; update passes nothing so blank fields clear.
 */
function buildProfileData(raw: Record<string, unknown>, defaults?: Workspace) {
  const numberPrefixes =
    parseNumberMap(raw.numberPrefixes) ?? defaults?.numberPrefixes;
  const numberStarts =
    parseNumberMap(raw.numberStarts, true) ?? defaults?.numberStarts;
  const gstEnabled =
    raw.gstEnabled !== undefined
      ? raw.gstEnabled === "on" || raw.gstEnabled === true
      : defaults?.gstEnabled;
  return profileSchema.safeParse({
    name: raw.name,
    logo: (raw.logo as string) || defaults?.logo || undefined,
    signature: (raw.signature as string) || defaults?.signature || undefined,
    addressLine1: (raw.addressLine1 as string) || defaults?.addressLine1 || undefined,
    addressLine2: (raw.addressLine2 as string) || defaults?.addressLine2 || undefined,
    city: (raw.city as string) || defaults?.city || undefined,
    state: (raw.state as string) || defaults?.state || undefined,
    postalCode: (raw.postalCode as string) || defaults?.postalCode || undefined,
    country: (raw.country as string) || defaults?.country || undefined,
    phone: (raw.phone as string) || defaults?.phone || undefined,
    email: (raw.email as string) || defaults?.email || undefined,
    website: (raw.website as string) || defaults?.website || undefined,
    taxId: (raw.taxId as string) || defaults?.taxId || undefined,
    pan: (raw.pan as string) || defaults?.pan || undefined,
    upiId: (raw.upiId as string) || defaults?.upiId || undefined,
    paymentInstructions:
      (raw.paymentInstructions as string) || defaults?.paymentInstructions || undefined,
    bankDetails: (raw.bankDetails as string) || defaults?.bankDetails || undefined,
    gstEnabled,
    placeOfSupply:
      (raw.placeOfSupply as string) || defaults?.placeOfSupply || undefined,
    currency: (raw.currency as string) || defaults?.currency,
    taxRate: (raw.taxRate as string) || defaults?.taxRate,
    taxLabel:
      (raw.taxLabel as string) || defaults?.taxConfig?.label || undefined,
    taxCountry:
      (raw.taxCountry as string) || defaults?.taxConfig?.country || undefined,
    brandColor: (raw.brandColor as string) || defaults?.brandColor,
    brandColors:
      parseBrandColors(raw.brandColors) ?? defaults?.brandColors,
    numberPrefixes,
    numberPad:
      raw.numberPad === "" || raw.numberPad === undefined
        ? defaults?.numberPad
        : raw.numberPad,
    numberStarts,
  });
}

/** Create a business profile (owner/admin only) — snapshots the workspace branding. */
export async function createProfileAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { workspace, user, role } = await requireWorkspace();
    if (role === "member") {
      return { ok: false, error: "Only owners and admins can manage profiles" };
    }
    const raw = formDataToObject(formData);
    const parsed = buildProfileData(raw, workspace);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid profile",
      };
    }
    const d = parsed.data;
    const taxConfig =
      d.taxLabel || d.taxCountry
        ? {
            ...(d.taxLabel ? { label: d.taxLabel } : {}),
            ...(d.taxCountry ? { country: d.taxCountry } : {}),
          }
        : undefined;

    const now = new Date();
    const result = await collections.businessProfiles().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
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
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/app/settings/profiles");
    revalidatePath("/app", "layout");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create profile",
    };
  }
}

/** Update a business profile (owner/admin only). */
export async function updateProfileAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const { workspace, role } = await requireWorkspace();
    if (role === "member") {
      return { ok: false, error: "Only owners and admins can manage profiles" };
    }
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid profile id" };

    const raw = formDataToObject(formData);
    const parsed = buildProfileData(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid profile",
      };
    }
    const d = parsed.data;
    const taxConfig =
      d.taxLabel || d.taxCountry
        ? {
            ...(d.taxLabel ? { label: d.taxLabel } : {}),
            ...(d.taxCountry ? { country: d.taxCountry } : {}),
          }
        : undefined;

    const result = await collections.businessProfiles().updateOne(
      { _id: objectId, workspaceId: workspace._id },
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
    if (!result.matchedCount) return { ok: false, error: "Profile not found" };

    revalidatePath("/app/settings/profiles");
    revalidatePath("/app", "layout");
    return { ok: true, id: objectId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update profile",
    };
  }
}

/**
 * Delete a profile (owner/admin only). Documents keep their `profileId`
 * (dangling) — rendering falls back to workspace branding; the switcher
 * simply no longer offers it.
 */
export async function deleteProfileAction(id: string): Promise<ActionResult> {
  try {
    const { workspace, role } = await requireWorkspace();
    if (role === "member") {
      return { ok: false, error: "Only owners and admins can manage profiles" };
    }
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid profile id" };

    const result = await collections
      .businessProfiles()
      .deleteOne({ _id: objectId, workspaceId: workspace._id });
    if (!result.deletedCount) return { ok: false, error: "Profile not found" };

    // Clear the active cookie if it pointed at the deleted profile.
    if ((await getActiveProfileCookie()) === objectId.toHexString()) {
      await setActiveProfileCookie(null);
    }

    revalidatePath("/app/settings/profiles");
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete profile",
    };
  }
}

/**
 * Switch the active business profile (any workspace member may switch —
 * it only affects what they create and see next). Pass "" to return to
 * the workspace default branding.
 */
export async function switchProfileAction(id: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    if (!id) {
      await setActiveProfileCookie(null);
      revalidatePath("/app", "layout");
      return { ok: true };
    }
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid profile id" };

    const profile = await collections
      .businessProfiles()
      .findOne({ _id: objectId, workspaceId: workspace._id });
    if (!profile) return { ok: false, error: "Profile not found" };

    await setActiveProfileCookie(objectId.toHexString());
    revalidatePath("/app", "layout");
    return { ok: true, id: objectId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to switch profile",
    };
  }
}
