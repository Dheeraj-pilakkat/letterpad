import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import type { auth } from "@/lib/auth/config";

/**
 * Integration tests for data export + account deletion (§22).
 * Opt-in: TEST_DB=1 npm test (needs MongoDB — MONGODB_URI or .env.local).
 * Skipped by default so the normal suite stays hermetic.
 */

const state = vi.hoisted(() => ({
  cookie: "",
  wsCookie: "",
}));

// Server-only boundary marker — meaningless under Vitest (node env).
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: state.cookie }),
  cookies: async () => ({
    get: (name: string) =>
      name === "lp_ws" && state.wsCookie ? { name, value: state.wsCookie } : undefined,
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

if (!process.env.MONGODB_URI) {
  try {
    const env = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^MONGODB_URI=(.*)$/m);
    if (m) process.env.MONGODB_URI = m[1].trim();
  } catch {
    /* no .env.local */
  }
}

const hasDb =
  process.env.TEST_DB === "1" && Boolean(process.env.MONGODB_URI);
const ORIGIN = { origin: "http://localhost:3000" };

/**
 * Sign in through better-auth and return the raw `cookie` header pair.
 * Session cookies are HMAC-signed, so we reuse the set-cookie value
 * instead of hand-assembling the token.
 */
async function signInCookie(
  authInstance: typeof auth,
  email: string,
  password: string,
): Promise<string> {
  const res = (await authInstance.api.signInEmail({
    body: { email, password },
    headers: new Headers(ORIGIN),
    returnHeaders: true,
  })) as unknown as { headers: Headers };
  const pair = res.headers
    .getSetCookie()
    .find((c) => c.startsWith("better-auth.session_token="));
  if (!pair) throw new Error("sign-in did not set a session cookie");
  return pair.split(";")[0];
}

describe.skipIf(!hasDb)("data export (DB)", () => {
  const stamp = Date.now();
  const email = `e2e-export-${stamp}@example.test`;
  const password = "Sup3rSecret!1";
  let cookieHeader = "";
  let ownedSlug = "";
  let ownedId: ObjectId;
  let memberWsId = "";
  let otherOwnerId = "";

  beforeAll(async () => {
    const { auth } = await import("@/lib/auth/config");
    const { collections } = await import("@/lib/db/client");

    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: "E2E Export" },
      headers: new Headers(ORIGIN),
    });
    cookieHeader = await signInCookie(auth, email, password);
    state.cookie = cookieHeader;

    const now = new Date();
    ownedSlug = `e2e-export-${stamp}`;
    ownedId = new ObjectId();
    await collections.workspaces().insertOne({
      _id: ownedId,
      name: "E2E Export WS",
      slug: ownedSlug,
      ownerUserId: signUp.user.id,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [],
      createdAt: now,
      updatedAt: now,
    });
    await collections.counters().insertOne({
      _id: `${ownedId.toHexString()}:document`,
      seq: 7,
    });

    otherOwnerId = `e2e-other-${stamp}`;
    memberWsId = new ObjectId().toHexString();
    await collections.workspaces().insertOne({
      _id: new ObjectId(memberWsId),
      name: "E2E Member WS",
      slug: `e2e-member-${stamp}`,
      ownerUserId: otherOwnerId,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [
        {
          userId: signUp.user.id,
          name: "E2E Export",
          email,
          role: "member",
          addedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    state.cookie = "";
    state.wsCookie = "";
    if (!hasDb) return;
    const { collections, getDb } = await import("@/lib/db/client");
    try {
      const user = await getDb()
        .collection<{ _id: ObjectId }>("user")
        .findOne({ email });
      if (user) {
        await getDb().collection("session").deleteMany({ userId: user._id });
        await getDb().collection("account").deleteMany({ userId: user._id });
        await getDb().collection("user").deleteOne({ _id: user._id });
      }
      await collections.workspaces().deleteMany({ ownerUserId: otherOwnerId });
      if (ownedId) {
        await collections.workspaces().deleteOne({ _id: ownedId });
        await collections
          .counters()
          .deleteMany({ _id: { $regex: `^${ownedId.toHexString()}:` } });
      }
    } catch {
      /* best-effort cleanup */
    }
  });

  it("rejects unauthenticated export", async () => {
    state.cookie = "";
    const { GET } = await import("@/app/api/export/route");
    const res = await GET();
    expect(res.status).toBe(401);
    state.cookie = cookieHeader;
  });

  it("rejects members exporting a workspace they do not manage", async () => {
    state.wsCookie = memberWsId;
    const { GET } = await import("@/app/api/export/route");
    const res = await GET();
    expect(res.status).toBe(403);
    state.wsCookie = "";
  });

  it("downloads the owned workspace as a JSON attachment", async () => {
    state.cookie = cookieHeader;
    const { GET } = await import("@/app/api/export/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(
      `letterpad-export-${ownedSlug}-`,
    );
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as {
      app: string;
      formatVersion: number;
      workspace: { slug: string };
      data: { counters: unknown[]; contacts: unknown[] };
    };
    expect(body.app).toBe("letterpad");
    expect(body.formatVersion).toBe(1);
    expect(body.workspace.slug).toBe(ownedSlug);
    expect(body.data.counters).toHaveLength(1);
    expect(Array.isArray(body.data.contacts)).toBe(true);
  });
});

describe.skipIf(!hasDb)("account deletion (DB)", () => {
  const stamp = Date.now();
  const email = `e2e-delete-${stamp}@example.test`;
  const password = "Sup3rSecret!1";
  let userId = "";
  let cookieHeader = "";
  let ownedId: ObjectId;
  let memberWsId: ObjectId;
  let otherOwnerId = "";

  beforeAll(async () => {
    const { auth } = await import("@/lib/auth/config");
    const { collections } = await import("@/lib/db/client");

    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: "E2E Delete" },
      headers: new Headers(ORIGIN),
    });
    userId = signUp.user.id;
    cookieHeader = await signInCookie(auth, email, password);
    state.cookie = cookieHeader;

    const now = new Date();
    ownedId = new ObjectId();
    await collections.workspaces().insertOne({
      _id: ownedId,
      name: "E2E Delete WS",
      slug: `e2e-delete-${stamp}`,
      ownerUserId: userId,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [],
      createdAt: now,
      updatedAt: now,
    });
    await collections.counters().insertOne({
      _id: `${ownedId.toHexString()}:document`,
      seq: 3,
    });

    otherOwnerId = `e2e-other-del-${stamp}`;
    memberWsId = new ObjectId();
    await collections.workspaces().insertOne({
      _id: memberWsId,
      name: "E2E Other WS",
      slug: `e2e-other-del-${stamp}`,
      ownerUserId: otherOwnerId,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [
        { userId, name: "E2E Delete", email, role: "admin", addedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    });
    await collections.invites().insertOne({
      _id: new ObjectId(),
      workspaceId: memberWsId,
      email,
      role: "admin",
      token: `tok-${stamp}`,
      invitedBy: otherOwnerId,
      invitedByName: "Other",
      status: "pending",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: now,
    });
  });

  afterAll(async () => {
    state.cookie = "";
    if (!hasDb) return;
    const { collections, getDb } = await import("@/lib/db/client");
    try {
      const uid = new ObjectId(userId);
      await getDb().collection("session").deleteMany({ userId: uid });
      await getDb().collection("account").deleteMany({ userId: uid });
      await getDb().collection("user").deleteOne({ _id: uid });
      await collections.workspaces().deleteMany({ ownerUserId: otherOwnerId });
      await collections.workspaces().deleteMany({ ownerUserId: userId });
      await collections.invites().deleteMany({ email });
      await collections.counters().deleteMany({
        _id: { $regex: `^${ownedId?.toHexString() ?? "none"}:` },
      });
    } catch {
      /* best-effort cleanup */
    }
  });

  it("rejects a wrong password and keeps the account", async () => {
    const { deleteAccountAction } = await import("@/lib/actions/account");
    const res = await deleteAccountAction("not-the-password");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Incorrect password");

    const { getDb } = await import("@/lib/db/client");
    const user = await getDb()
      .collection("user")
      .findOne({ _id: new ObjectId(userId) });
    expect(user).not.toBeNull();
    const ws = await import("@/lib/db/client").then((m) =>
      m.collections.workspaces().findOne({ _id: ownedId }),
    );
    expect(ws).not.toBeNull();
  });

  it("deletes the account, owned workspaces, counters and memberships", async () => {
    const { deleteAccountAction } = await import("@/lib/actions/account");
    const res = await deleteAccountAction(password);
    expect(res).toEqual({ ok: true });

    const { getDb, collections } = await import("@/lib/db/client");
    const db = getDb();
    const uid = new ObjectId(userId);
    await expect(
      db.collection("user").findOne({ _id: uid }),
    ).resolves.toBeNull();
    await expect(
      db.collection("session").find({ userId: uid }).toArray(),
    ).resolves.toHaveLength(0);
    await expect(
      db.collection("account").find({ userId: uid }).toArray(),
    ).resolves.toHaveLength(0);

    await expect(
      collections.workspaces().findOne({ _id: ownedId }),
    ).resolves.toBeNull();
    await expect(
      collections
        .counters()
        .find({ _id: { $regex: `^${ownedId.toHexString()}:` } })
        .toArray(),
    ).resolves.toHaveLength(0);

    const memberWs = await collections
      .workspaces()
      .findOne({ _id: memberWsId });
    expect(memberWs).not.toBeNull();
    expect(memberWs?.members ?? []).toHaveLength(0);

    await expect(
      collections.invites().findOne({ email }),
    ).resolves.toBeNull();
  });

  it("requires a session", async () => {
    state.cookie = "";
    const { deleteAccountAction } = await import("@/lib/actions/account");
    const res = await deleteAccountAction(password);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("You are signed out");
  });
});
