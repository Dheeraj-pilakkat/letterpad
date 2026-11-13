import { NextResponse } from "next/server";
import { authenticateApiKey, apiError } from "@/lib/api-auth";
import { currentPlanId, documentLimit, planDef } from "@/lib/plans";
import { countDocumentsThisMonth } from "@/lib/documents-quota";

/** GET /api/v1/me — the authenticated workspace, plan and usage. */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request as unknown as Parameters<typeof authenticateApiKey>[0]);
  if (!auth.ok) return apiError(auth.status, auth.error);

  const { workspace } = auth;
  const planId = currentPlanId(workspace);
  const limit = documentLimit(workspace);
  const createdThisMonth = await countDocumentsThisMonth(workspace._id);
  const plan = planDef(workspace);

  return NextResponse.json({
    workspace: {
      id: workspace._id.toHexString(),
      name: workspace.name,
      slug: workspace.slug,
      currency: workspace.currency,
    },
    plan: {
      id: planId,
      name: plan.name,
      priceInr: plan.priceInr,
      documentLimit: limit,
      documentsCreatedThisMonth: createdThisMonth,
      apiRatePerMin: plan.apiRatePerMin,
      features: plan.features,
    },
  });
}
