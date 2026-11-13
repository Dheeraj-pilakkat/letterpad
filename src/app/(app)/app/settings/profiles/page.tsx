import type { Metadata } from "next";
import { requireManager } from "@/lib/auth/session";
import { getActiveProfile, listProfiles } from "@/lib/profiles";
import { ProfilesPanel } from "@/components/settings/profiles-panel";

export const metadata: Metadata = { title: "Business profiles" };

export default async function ProfilesSettingsPage() {
  const { workspace } = await requireManager();
  const [profiles, active] = await Promise.all([
    listProfiles(workspace._id),
    getActiveProfile(workspace._id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink">Business profiles</h1>
        <p className="mt-1 text-sm text-muted">
          Issue documents under more than one identity — separate letterhead,
          tax details, payment instructions and numbering — without creating a
          second workspace.
        </p>
      </header>

      <ProfilesPanel
        activeId={active?._id.toHexString() ?? ""}
        profiles={profiles.map((p) => ({
          id: p._id.toHexString(),
          name: p.name,
          currency: p.currency,
          profile: {
            name: p.name,
            logo: p.logo,
            signature: p.signature,
            addressLine1: p.addressLine1,
            addressLine2: p.addressLine2,
            city: p.city,
            state: p.state,
            postalCode: p.postalCode,
            country: p.country,
            phone: p.phone,
            email: p.email,
            website: p.website,
            taxId: p.taxId,
            pan: p.pan,
            upiId: p.upiId,
            paymentInstructions: p.paymentInstructions,
            bankDetails: p.bankDetails,
            gstEnabled: p.gstEnabled,
            placeOfSupply: p.placeOfSupply,
            currency: p.currency,
            taxRate: p.taxRate,
            taxConfig: p.taxConfig,
            brandColor: p.brandColor,
            brandColors: p.brandColors,
            numberPrefixes: p.numberPrefixes,
            numberPad: p.numberPad,
            numberStarts: p.numberStarts,
          },
        }))}
      />
    </div>
  );
}
