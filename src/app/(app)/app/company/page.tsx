import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { CompanyForm } from "@/components/workspace/company-form";

export const metadata: Metadata = { title: "Letterhead" };

export default async function CompanyPage() {
  const { workspace } = await requireWorkspace();

  const dto = {
    name: workspace.name,
    logo: workspace.logo,
    signature: workspace.signature,
    addressLine1: workspace.addressLine1,
    addressLine2: workspace.addressLine2,
    city: workspace.city,
    state: workspace.state,
    postalCode: workspace.postalCode,
    country: workspace.country,
    phone: workspace.phone,
    email: workspace.email,
    website: workspace.website,
    taxId: workspace.taxId,
    bankDetails: workspace.bankDetails,
    currency: workspace.currency,
    taxRate: workspace.taxRate,
    brandColor: workspace.brandColor,
    brandColors: workspace.brandColors,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Your letterhead</h1>
        <p className="mt-1 text-sm text-muted">
          The business details printed on every quotation, bill and letter.
        </p>
      </header>
      <div className="rounded-[4px] border border-line bg-white p-6">
        <CompanyForm workspace={dto} />
      </div>
    </div>
  );
}
