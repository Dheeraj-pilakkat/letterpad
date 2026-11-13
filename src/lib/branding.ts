import type { BusinessProfile, Workspace } from "@/lib/db/types";

/**
 * Merge a business profile (§6) over workspace branding. Profile fields win
 * when set; everything else falls back to the workspace. Returns the
 * workspace itself when no profile is given, so callers can treat it as
 * the default identity.
 *
 * Pure — safe to import from client-adjacent code and tests.
 */
export function overlayBranding(
  ws: Workspace,
  profile?: BusinessProfile | null,
): Workspace {
  if (!profile) return ws;
  return {
    ...ws,
    name: profile.name,
    logo: profile.logo ?? ws.logo,
    signature: profile.signature ?? ws.signature,
    addressLine1: profile.addressLine1 ?? ws.addressLine1,
    addressLine2: profile.addressLine2 ?? ws.addressLine2,
    city: profile.city ?? ws.city,
    state: profile.state ?? ws.state,
    postalCode: profile.postalCode ?? ws.postalCode,
    country: profile.country ?? ws.country,
    phone: profile.phone ?? ws.phone,
    email: profile.email ?? ws.email,
    website: profile.website ?? ws.website,
    taxId: profile.taxId ?? ws.taxId,
    pan: profile.pan ?? ws.pan,
    upiId: profile.upiId ?? ws.upiId,
    paymentInstructions: profile.paymentInstructions ?? ws.paymentInstructions,
    bankDetails: profile.bankDetails ?? ws.bankDetails,
    gstEnabled: profile.gstEnabled ?? ws.gstEnabled,
    placeOfSupply: profile.placeOfSupply ?? ws.placeOfSupply,
    currency: profile.currency,
    taxRate: profile.taxRate,
    taxConfig: profile.taxConfig ?? ws.taxConfig,
    brandColor: profile.brandColor,
    brandColors: profile.brandColors ?? ws.brandColors,
    numberPrefixes: profile.numberPrefixes ?? ws.numberPrefixes,
    numberPad: profile.numberPad ?? ws.numberPad,
    numberStarts: profile.numberStarts ?? ws.numberStarts,
  };
}
