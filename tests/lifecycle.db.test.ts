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
  profileCookie: "",
}));

// Server-only boundary marker — meaningless under Vitest (node env).
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: state.cookie }),
  cookies: async () => ({
    get: (name: string) => {
      if (name === "lp_ws" && state.wsCookie) {
        return { name, value: state.wsCookie };
      }
      if (name === "lp_profile" && state.profileCookie) {
        return { name, value: state.profileCookie };
      }
      return undefined;
    },
    set: (name: string, value: string) => {
      if (name === "lp_profile") state.profileCookie = value;
    },
    delete: (name: string) => {
      if (name === "lp_profile") state.profileCookie = "";
    },
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

describe.skipIf(!hasDb)("share & portal link expiry (DB)", () => {
  const stamp = Date.now();
  const email = `e2e-expiry-${stamp}@example.test`;
  const password = "Sup3rSecret!1";
  let userId = "";
  let workspaceId: ObjectId;
  let docId: ObjectId;
  let contactId: ObjectId;
  let shareToken = "";

  beforeAll(async () => {
    const { auth } = await import("@/lib/auth/config");
    const { collections, getDb } = await import("@/lib/db/client");
    await auth.api.signUpEmail({
      body: { email, password, name: "E2E Expiry" },
      headers: new Headers(ORIGIN),
    });
    state.cookie = await signInCookie(auth, email, password);

    const user = await getDb().collection("user").findOne({ email });
    userId = (user?._id as ObjectId).toHexString();

    const now = new Date();
    workspaceId = new ObjectId();
    await collections.workspaces().insertOne({
      _id: workspaceId,
      name: "E2E Expiry WS",
      slug: `e2e-expiry-${stamp}`,
      ownerUserId: userId,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [],
      createdAt: now,
      updatedAt: now,
    });

    contactId = new ObjectId();
    await collections.contacts().insertOne({
      _id: contactId,
      workspaceId,
      name: "E2E Client",
      email: `client-${stamp}@example.test`,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });

    docId = new ObjectId();
    await collections.documents().insertOne({
      _id: docId,
      workspaceId,
      type: "invoice",
      templateId: "minimal",
      number: `INV-EXP-${stamp}`,
      status: "draft",
      contactId,
      issueDate: "2026-06-15",
      currency: "USD",
      items: [],
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      content: { subject: "", body: "", terms: "" },
      layout: { accentColor: "#B4552D" },
      createdBy: userId,
      deletedAt: null,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    } as never);
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
      await collections.workspaces().deleteOne({ _id: workspaceId });
      await collections.documents().deleteOne({ _id: docId });
      await collections.contacts().deleteOne({ _id: contactId });
      await collections.activity().deleteMany({ workspaceId });
    } catch {
      /* best-effort cleanup */
    }
  });

  it("enableShare issues a link with a future expiry that resolves active", async () => {
    const { enableShare, getSharedDocument } = await import(
      "@/lib/actions/sharing"
    );
    const res = await enableShare(docId.toHexString());
    expect(res.ok).toBe(true);
    expect(res.url).toContain("/share/");
    expect(res.expiresAt).toBeTruthy();
    expect(new Date(res.expiresAt!).getTime()).toBeGreaterThan(Date.now());

    shareToken = res.url!.split("/share/")[1];
    const shared = await getSharedDocument(shareToken);
    expect(shared?.status).toBe("active");
    if (shared?.status === "active") {
      expect(shared.doc.number).toContain("INV-EXP-");
      expect(shared.contact?.name).toBe("E2E Client");
    }
  });

  it("an expired share link resolves as expired and is refreshed by documentLinkFor", async () => {
    const { collections } = await import("@/lib/db/client");
    const { getSharedDocument } = await import("@/lib/actions/sharing");
    const { documentLinkFor } = await import("@/lib/document-link");

    await collections
      .documents()
      .updateOne(
        { _id: docId },
        { $set: { shareExpiresAt: new Date(Date.now() - 1000) } },
      );

    const expired = await getSharedDocument(shareToken);
    expect(expired).toEqual({ status: "expired" });

    const oldUrl = `http://localhost:3000/share/${shareToken}`;
    const newUrl = await documentLinkFor(
      {
        _id: docId,
        shareEnabled: true,
        shareToken,
        shareExpiresAt: new Date(Date.now() - 1000),
      },
      null,
    );
    expect(newUrl).not.toBe(oldUrl);
    const newToken = newUrl.split("/share/")[1];
    const refreshed = await getSharedDocument(newToken);
    expect(refreshed?.status).toBe("active");

    shareToken = newToken;
  });

  it("portal links expire and slide forward on active use", async () => {
    const { enableContactPortal } = await import("@/lib/actions/portal");
    const { findPortalContact } = await import("@/lib/portal-token");
    const { collections } = await import("@/lib/db/client");

    const res = await enableContactPortal(contactId.toHexString());
    expect(res.ok).toBe(true);
    expect(res.expiresAt).toBeTruthy();
    expect(new Date(res.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    const token = res.url!.split("/portal/")[1];

    const found = await findPortalContact(token);
    expect(found?.name).toBe("E2E Client");

    // Force-expire → no longer resolves.
    await collections
      .contacts()
      .updateOne(
        { _id: contactId },
        { $set: { portalExpiresAt: new Date(Date.now() - 1000) } },
      );
    expect(await findPortalContact(token)).toBeNull();

    // Re-enable, then simulate a link inside the renewal window: access
    // slides the expiry out to the full portal TTL.
    const res2 = await enableContactPortal(contactId.toHexString());
    const token2 = res2.url!.split("/portal/")[1];
    await collections
      .contacts()
      .updateOne(
        { _id: contactId },
        { $set: { portalExpiresAt: new Date(Date.now() + 10 * 86_400_000) } },
      );
    expect(await findPortalContact(token2)).not.toBeNull();
    const row = await collections.contacts().findOne({ _id: contactId });
    expect(row?.portalExpiresAt?.getTime()).toBeGreaterThan(
      Date.now() + 170 * 86_400_000,
    );
  });
});

describe.skipIf(!hasDb)("in-app notifications (DB)", () => {
  const stamp = Date.now();
  const email = `e2e-notify-${stamp}@example.test`;
  const memberEmail = `e2e-notify-member-${stamp}@example.test`;
  const password = "Sup3rSecret!1";
  let userId = "";
  let memberId = "";
  let workspaceId: ObjectId;
  let docId: ObjectId;

  beforeAll(async () => {
    const { auth } = await import("@/lib/auth/config");
    const { collections, getDb } = await import("@/lib/db/client");
    await auth.api.signUpEmail({
      body: { email, password, name: "E2E Notify" },
      headers: new Headers(ORIGIN),
    });
    await auth.api.signUpEmail({
      body: { email: memberEmail, password, name: "E2E Notify Member" },
      headers: new Headers(ORIGIN),
    });
    state.cookie = await signInCookie(auth, email, password);

    const owner = await getDb().collection("user").findOne({ email });
    const member = await getDb().collection("user").findOne({ email: memberEmail });
    userId = (owner?._id as ObjectId).toHexString();
    memberId = (member?._id as ObjectId).toHexString();

    const now = new Date();
    workspaceId = new ObjectId();
    await collections.workspaces().insertOne({
      _id: workspaceId,
      name: "E2E Notify WS",
      slug: `e2e-notify-${stamp}`,
      ownerUserId: userId,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [{ userId: memberId, role: "member" }],
      createdAt: now,
      updatedAt: now,
    } as never);

    docId = new ObjectId();
    await collections.documents().insertOne({
      _id: docId,
      workspaceId,
      type: "invoice",
      templateId: "minimal",
      number: `INV-NTF-${stamp}`,
      status: "sent",
      issueDate: "2026-06-15",
      currency: "USD",
      items: [],
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      content: { subject: "", body: "", terms: "" },
      layout: { accentColor: "#B4552D" },
      createdBy: userId,
      deletedAt: null,
      shareEnabled: false,
      shareExpiresAt: new Date(Date.now() + 86_400_000),
      createdAt: now,
      updatedAt: now,
    } as never);
  });

  afterAll(async () => {
    state.cookie = "";
    if (!hasDb) return;
    const { collections, getDb } = await import("@/lib/db/client");
    try {
      const uid = new ObjectId(userId);
      const mid = new ObjectId(memberId);
      await getDb().collection("session").deleteMany({ userId: { $in: [uid, mid] } });
      await getDb().collection("account").deleteMany({ userId: { $in: [uid, mid] } });
      await getDb().collection("user").deleteMany({ _id: { $in: [uid, mid] } });
      await collections.workspaces().deleteOne({ _id: workspaceId });
      await collections.documents().deleteOne({ _id: docId });
      await collections
        .notifications()
        .deleteMany({ workspaceId });
      await collections.activity().deleteMany({ workspaceId });
    } catch {
      /* best-effort cleanup */
    }
  });

  it("notifyWorkspace notifies the owner and every member, once each", async () => {
    const { notifyWorkspace, listNotifications } = await import("@/lib/notify");
    await notifyWorkspace({
      workspaceId,
      type: "payment_received",
      title: "Payment of $10.00 received",
      body: "INV test via bank",
      href: `/app/documents/${docId.toHexString()}`,
    });

    const ownerList = await listNotifications(userId);
    expect(ownerList.unread).toBe(1);
    expect(ownerList.items[0]?.type).toBe("payment_received");
    expect(ownerList.items[0]?.href).toBe(
      `/app/documents/${docId.toHexString()}`,
    );

    const memberList = await listNotifications(memberId);
    expect(memberList.unread).toBe(1);
    expect(memberList.items[0]?.title).toContain("Payment of");
  });

  it("markNotificationRead only marks the caller's own notification", async () => {
    const { markNotificationRead } = await import(
      "@/lib/actions/notifications"
    );
    const { listNotifications } = await import("@/lib/notify");
    const ownerList = await listNotifications(userId);
    const memberList = await listNotifications(memberId);
    const ownerItemId = ownerList.items[0]!.id;
    const memberItemId = memberList.items[0]!.id;

    // Signed in as the owner — reading a member's notification must be a no-op.
    await markNotificationRead(memberItemId);
    expect((await listNotifications(memberId)).unread).toBe(1);

    await markNotificationRead(ownerItemId);
    expect((await listNotifications(userId)).unread).toBe(0);

    // Restore unread state for the cleanup assertions below.
    const { collections } = await import("@/lib/db/client");
    await collections
      .notifications()
      .updateMany({ workspaceId }, { $set: { readAt: null } });
    expect((await listNotifications(userId)).unread).toBeGreaterThan(0);
  });

  it("runShareExpiryNotifications fires once per expiring share link", async () => {
    const { runShareExpiryNotifications, listNotifications } = await import(
      "@/lib/notify"
    );
    const { collections } = await import("@/lib/db/client");

    // Share expires within the notice horizon.
    await collections
      .documents()
      .updateOne(
        { _id: docId },
        {
          $set: {
            shareEnabled: true,
            shareToken: `tok-${stamp}`,
            shareExpiresAt: new Date(Date.now() + 2 * 86_400_000),
          },
          $unset: { shareExpiryNotifiedAt: "" },
        },
      );

    const before = (await listNotifications(userId)).unread;
    const first = await runShareExpiryNotifications();
    expect(first).toBe(1);
    expect((await listNotifications(userId)).unread).toBe(before + 1);

    // Idempotent — the marker matches the expiry, so no second notification.
    const second = await runShareExpiryNotifications();
    expect(second).toBe(0);
    expect((await listNotifications(userId)).unread).toBe(before + 1);

    // An expired/quiet link (expires far out) is not picked up at all.
    await collections
      .documents()
      .updateOne(
        { _id: docId },
        {
          $set: { shareExpiresAt: new Date(Date.now() + 30 * 86_400_000) },
          $unset: { shareExpiryNotifiedAt: "" },
        },
      );
    expect(await runShareExpiryNotifications()).toBe(0);
  });
});

describe.skipIf(!hasDb)("business profiles (DB)", () => {
  const stamp = Date.now();
  const email = `e2e-profile-${stamp}@example.test`;
  const memberEmail = `e2e-profile-member-${stamp}@example.test`;
  const password = "Sup3rSecret!1";
  let ownerId = "";
  let memberId = "";
  let workspaceId: ObjectId;
  let profileId = "";
  let foreignProfileId = "";
  let docId: ObjectId | null = null;
  let ownerCookie = "";

  /** `redirect()` throws with a NEXT_REDIRECT digest — return its URL. */
  async function catchRedirect(fn: () => Promise<unknown>): Promise<string> {
    try {
      await fn();
      return "";
    } catch (e) {
      const digest = (e as { digest?: string }).digest ?? "";
      if (digest.startsWith("NEXT_REDIRECT")) {
        return digest.split(";")[2] ?? "";
      }
      throw e;
    }
  }

  beforeAll(async () => {
    const { auth } = await import("@/lib/auth/config");
    const { collections, getDb } = await import("@/lib/db/client");
    await auth.api.signUpEmail({
      body: { email, password, name: "E2E Profile" },
      headers: new Headers(ORIGIN),
    });
    await auth.api.signUpEmail({
      body: { email: memberEmail, password, name: "E2E Profile Member" },
      headers: new Headers(ORIGIN),
    });
    ownerCookie = await signInCookie(auth, email, password);
    state.cookie = ownerCookie;

    const owner = await getDb().collection("user").findOne({ email });
    const member = await getDb().collection("user").findOne({ email: memberEmail });
    ownerId = (owner?._id as ObjectId).toHexString();
    memberId = (member?._id as ObjectId).toHexString();

    const now = new Date();
    workspaceId = new ObjectId();
    await collections.workspaces().insertOne({
      _id: workspaceId,
      name: "E2E Profile WS",
      slug: `e2e-profile-${stamp}`,
      ownerUserId: ownerId,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      logo: "data:image/png;base64,wslogo",
      city: "Mumbai",
      members: [
        { userId: memberId, name: "E2E Profile Member", email: memberEmail, role: "member", addedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    } as never);
    state.wsCookie = workspaceId.toHexString();

    // A profile belonging to a different workspace (isolation fixture).
    foreignProfileId = new ObjectId().toHexString();
    await collections.businessProfiles().insertOne({
      _id: new ObjectId(foreignProfileId),
      workspaceId: new ObjectId(),
      name: "Foreign profile",
      currency: "EUR",
      taxRate: 20,
      brandColor: "#000000",
      createdBy: "someone-else",
      createdAt: now,
      updatedAt: now,
    } as never);
  });

  afterAll(async () => {
    state.cookie = "";
    state.wsCookie = "";
    state.profileCookie = "";
    if (!hasDb) return;
    const { collections, getDb } = await import("@/lib/db/client");
    try {
      const uid = new ObjectId(ownerId);
      const mid = new ObjectId(memberId);
      await getDb().collection("session").deleteMany({ userId: { $in: [uid, mid] } });
      await getDb().collection("account").deleteMany({ userId: { $in: [uid, mid] } });
      await getDb().collection("user").deleteMany({ _id: { $in: [uid, mid] } });
      await collections.workspaces().deleteOne({ _id: workspaceId });
      await collections.businessProfiles().deleteMany({ workspaceId });
      await collections
        .businessProfiles()
        .deleteOne({ _id: new ObjectId(foreignProfileId) });
      await collections
        .counters()
        .deleteMany({ _id: { $regex: `^${workspaceId.toHexString()}:` } });
      if (docId) await collections.documents().deleteOne({ _id: docId });
      await collections.activity().deleteMany({ workspaceId });
    } catch {
      /* best-effort cleanup */
    }
  });

  it("creates a profile that snapshots the workspace branding", async () => {
    const { createProfileAction } = await import("@/lib/actions/profiles");
    const { listProfiles } = await import("@/lib/profiles");
    const fd = new FormData();
    fd.set("name", "Acme US Inc");
    const res = await createProfileAction(fd);
    expect(res.ok).toBe(true);
    profileId = res.id ?? "";
    expect(profileId).toMatch(/^[0-9a-f]{24}$/);

    const [profile] = await listProfiles(workspaceId);
    expect(profile?.name).toBe("Acme US Inc");
    // Snapshotted from the workspace letterhead (copy-on-create).
    expect(profile?.currency).toBe("USD");
    expect(profile?.brandColor).toBe("#B4552D");
    expect(profile?.city).toBe("Mumbai");
    expect(profile?.logo).toBe("data:image/png;base64,wslogo");
  });

  it("denies profile management to members but lets them switch", async () => {
    const { createProfileAction, switchProfileAction, deleteProfileAction } =
      await import("@/lib/actions/profiles");
    const { auth } = await import("@/lib/auth/config");
    state.cookie = await signInCookie(auth, memberEmail, password);

    const fd = new FormData();
    fd.set("name", "Sneaky profile");
    const denied = await createProfileAction(fd);
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/owners and admins/i);
    const deniedDelete = await deleteProfileAction(profileId);
    expect(deniedDelete.ok).toBe(false);

    // Switching is allowed for any member.
    const switched = await switchProfileAction(profileId);
    expect(switched.ok).toBe(true);
    expect(state.profileCookie).toBe(profileId);
    const cleared = await switchProfileAction("");
    expect(cleared.ok).toBe(true);
    expect(state.profileCookie).toBe("");

    state.cookie = ownerCookie;
  });

  it("refuses to activate a profile from another workspace", async () => {
    const { switchProfileAction } = await import("@/lib/actions/profiles");
    const { getActiveProfile } = await import("@/lib/profiles");
    const res = await switchProfileAction(foreignProfileId);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
    expect(state.profileCookie).toBe("");

    // Even a forged cookie pointing at a foreign profile resolves to null.
    state.profileCookie = foreignProfileId;
    expect(await getActiveProfile(workspaceId)).toBeNull();
    state.profileCookie = "";
  });

  it("keeps a separate numbering sequence per profile", async () => {
    const { nextDocumentNumber } = await import("@/lib/counters");
    const wsHex = workspaceId.toHexString();

    const default1 = await nextDocumentNumber(wsHex, "invoice");
    const profile1 = await nextDocumentNumber(wsHex, "invoice", undefined, profileId);
    const default2 = await nextDocumentNumber(wsHex, "invoice");

    expect(default1).toBe("INV-0001");
    // The profile sequence starts from scratch, independent of the default.
    expect(profile1).toBe("INV-0001");
    expect(default2).toBe("INV-0002");
  });

  it("stamps new documents with the active profile", async () => {
    const { createDocumentAction } = await import("@/lib/actions/documents");
    const { collections } = await import("@/lib/db/client");
    state.profileCookie = profileId;

    const fd = new FormData();
    fd.set("type", "invoice");
    fd.set("templateId", "invoice-classic");
    const url = await catchRedirect(() => createDocumentAction(fd));
    expect(url).toMatch(/^\/app\/documents\/[0-9a-f]{24}$/);
    docId = new ObjectId(url.split("/").pop());

    const doc = await collections.documents().findOne({ _id: docId });
    expect(doc?.profileId?.toHexString()).toBe(profileId);
    // Profile sequence continues from the earlier nextDocumentNumber call.
    expect(doc?.number).toBe("INV-0002");

    state.profileCookie = "";
  });

  it("updates and deletes the profile", async () => {
    const { updateProfileAction, deleteProfileAction } = await import(
      "@/lib/actions/profiles"
    );
    const { listProfiles } = await import("@/lib/profiles");
    const { collections } = await import("@/lib/db/client");

    const fd = new FormData();
    fd.set("name", "Acme US Inc (renamed)");
    // The real edit form (CompanyForm) always submits these required fields.
    fd.set("currency", "USD");
    fd.set("taxRate", "0");
    fd.set("brandColor", "#B4552D");
    const updated = await updateProfileAction(profileId, fd);
    expect(updated.ok).toBe(true);
    const afterUpdate = await collections
      .businessProfiles()
      .findOne({ _id: new ObjectId(profileId) });
    expect(afterUpdate?.name).toBe("Acme US Inc (renamed)");

    // Deleting the active profile clears the cookie.
    state.profileCookie = profileId;
    const deleted = await deleteProfileAction(profileId);
    expect(deleted.ok).toBe(true);
    expect(state.profileCookie).toBe("");
    expect(
      await collections.businessProfiles().findOne({ _id: new ObjectId(profileId) }),
    ).toBeNull();
    expect(await listProfiles(workspaceId)).toHaveLength(0);
  });
});
