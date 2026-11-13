import { NextResponse } from "next/server";
import { getSession, resolveWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { buildExportPayload, exportFilename } from "@/lib/export";

export const dynamic = "force-dynamic";

/**
 * GET /api/export — download the active workspace's data as JSON.
 * Owner/admin only (members cannot export a workspace they do not manage).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const resolved = await resolveWorkspace(session.user);
  if (!resolved) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }
  const { workspace, role } = resolved;
  if (role === "member") {
    return NextResponse.json(
      { error: "Only owners and admins can export workspace data" },
      { status: 403 },
    );
  }

  const wsId = workspace._id;
  const filter = { workspaceId: wsId };
  const [contacts, documents, payments, expenses, products, projects, schedules, deliveries, activity, invites, counters] =
    await Promise.all([
      collections.contacts().find(filter).toArray(),
      collections.documents().find(filter).toArray(),
      collections.payments().find(filter).toArray(),
      collections.expenses().find(filter).toArray(),
      collections.products().find(filter).toArray(),
      collections.projects().find(filter).toArray(),
      collections.schedules().find(filter).toArray(),
      collections.deliveries().find(filter).toArray(),
      collections.activity().find(filter).toArray(),
      collections.invites().find(filter).toArray(),
      collections
        .counters()
        .find({ _id: { $regex: `^${wsId.toHexString()}:` } })
        .toArray(),
    ]);

  const payload = buildExportPayload({
    workspace: workspace as unknown as Record<string, unknown>,
    data: {
      contacts,
      documents,
      payments,
      expenses,
      products,
      projects,
      schedules,
      deliveries,
      activity,
      invites,
      counters,
    },
  });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(workspace.slug)}"`,
      "Cache-Control": "no-store",
    },
  });
}
