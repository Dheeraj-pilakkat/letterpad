"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { generateShareToken, appBaseUrl, portalExpiry } from "@/lib/share";
import { findPortalContact } from "@/lib/portal-token";
import { notifyWorkspace } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { VALID_TRANSITIONS } from "@/lib/constants";
import { sumPayments } from "@/lib/finance";
import {
  signatureMethodLabel,
  typedSignatureText,
  validateSignatureImage,
} from "@/lib/signature";
import type { Contact, LetterpadDoc, SignatureMethod, Workspace } from "@/lib/db/types";

export type ActionResult = {
  ok: boolean;
  error?: string;
  url?: string;
  /** ISO expiry of the portal link (§22 expiring URLs) */
  expiresAt?: string;
};

async function portalUrl(token: string): Promise<string> {
  return `${appBaseUrl()}/portal/${token}`;
}

/** Enable (or re-enable with a fresh token) the client portal for a contact. */
export async function enableContactPortal(contactId: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(contactId);
    if (!objectId) return { ok: false, error: "Invalid contact id" };

    const contact = await collections
      .contacts()
      .findOne({ _id: objectId, workspaceId: workspace._id });
    if (!contact) return { ok: false, error: "Contact not found" };

    const token = generateShareToken();
    const expiresAt = portalExpiry();
    await collections.contacts().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      {
        $set: {
          portalEnabled: true,
          portalToken: token,
          portalExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      },
    );
    revalidatePath("/app/contacts");
    return {
      ok: true,
      url: await portalUrl(token),
      expiresAt: expiresAt.toISOString(),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to enable portal",
    };
  }
}

export async function disableContactPortal(contactId: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(contactId);
    if (!objectId) return { ok: false, error: "Invalid contact id" };

    await collections.contacts().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      {
        $set: {
          portalEnabled: false,
          updatedAt: new Date(),
        },
        $unset: { portalToken: "", portalExpiresAt: "" },
      },
    );
    revalidatePath("/app/contacts");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to disable portal",
    };
  }
}

export interface PortalData {
  workspace: Workspace;
  contact: Contact;
  docs: LetterpadDoc[];
}

function validToken(token: string): boolean {
  return /^[a-z0-9]{16,64}$/.test(token);
}

/** Load a contact portal: workspace + contact + their live, non-draft documents. */
export async function getPortal(token: string): Promise<PortalData | null> {
  if (!validToken(token)) return null;
  const contact = await findPortalContact(token);
  if (!contact) return null;

  const workspace = await collections
    .workspaces()
    .findOne({ _id: contact.workspaceId });
  if (!workspace) return null;

  const docs = await collections
    .documents()
    .find({
      workspaceId: workspace._id,
      contactId: contact._id,
      deletedAt: null,
      status: { $ne: "draft" },
    })
    .sort({ issueDate: -1, createdAt: -1 })
    .limit(100)
    .toArray();

  return { workspace, contact, docs };
}

/** Load one document inside a contact portal (must belong to that contact). */
export async function getPortalDocument(
  token: string,
  documentId: string,
): Promise<{ workspace: Workspace; contact: Contact; doc: LetterpadDoc } | null> {
  if (!validToken(token)) return null;
  const objectId = toObjectId(documentId);
  if (!objectId) return null;

  const contact = await findPortalContact(token);
  if (!contact) return null;

  const workspace = await collections
    .workspaces()
    .findOne({ _id: contact.workspaceId });
  if (!workspace) return null;

  const doc = await collections
    .documents()
    .findOne({
      _id: objectId,
      workspaceId: workspace._id,
      contactId: contact._id,
      deletedAt: null,
      status: { $ne: "draft" },
    });
  if (!doc) return null;

  return { workspace, contact, doc };
}

/** Best-effort "viewed" activity when a contact opens a portal document. */
export async function recordPortalView(
  token: string,
  documentId: string,
): Promise<void> {
  if (!validToken(token)) return;
  const objectId = toObjectId(documentId);
  if (!objectId) return;
  try {
    const data = await getPortalDocument(token, documentId);
    if (!data) return;
    const { workspace, doc } = data;
    const { logActivity } = await import("@/lib/activity");
    await logActivity({
      workspaceId: workspace._id,
      documentId: doc._id,
      type: "viewed",
      message: "Document viewed via client portal",
      actor: "client",
    });
    if (doc.status === "sent") {
      const res = await collections.documents().updateOne(
        { _id: doc._id, status: "sent" },
        { $set: { status: "viewed", updatedAt: new Date() } },
      );
      if (res.modifiedCount > 0) {
        await notifyWorkspace({
          workspaceId: workspace._id,
          type: "document_viewed",
          title: "Document viewed",
          body: `${doc.number} was viewed by ${data.contact.name} via the client portal`,
          href: `/app/documents/${doc._id.toHexString()}`,
        });
      }
    }
  } catch {
    // best-effort
  }
}

/* ============================================================
   Online approvals & signatures (client-side, token-scoped)
   ============================================================ */

export type PortalDecision = "accepted" | "rejected";

/** Accept or reject a quotation from inside the client portal. */
export async function respondToDocumentAction(
  token: string,
  documentId: string,
  decision: PortalDecision,
): Promise<ActionResult> {
  try {
    const data = await getPortalDocument(token, documentId);
    if (!data) return { ok: false, error: "Document not found" };
    const { workspace, contact, doc } = data;

    if (doc.type !== "quote") {
      return { ok: false, error: "Only quotations can be accepted or rejected" };
    }
    if (!VALID_TRANSITIONS[doc.status]?.includes(decision)) {
      return {
        ok: false,
        error: `This quotation is already ${doc.status} and cannot be marked ${decision}`,
      };
    }

    const now = new Date();
    await collections.documents().updateOne(
      { _id: doc._id, workspaceId: workspace._id },
      { $set: { status: decision, updatedAt: now } },
    );
    await logActivity({
      workspaceId: workspace._id,
      documentId: doc._id,
      type: "status",
      message: `Quotation ${decision} via client portal by ${contact.name}`,
      actor: "client",
    });
    await notifyWorkspace({
      workspaceId: workspace._id,
      type: decision === "accepted" ? "quote_accepted" : "quote_rejected",
      title: `Quotation ${decision}`,
      body: `${doc.number} ${decision} by ${contact.name}`,
      href: `/app/documents/${documentId}`,
    });

    revalidatePath(`/portal/${token}/${documentId}`);
    revalidatePath(`/app/documents/${documentId}`);
    revalidatePath("/app/finance");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to respond to document",
    };
  }
}

export interface SignDocumentInput {
  signedBy: string;
  method: SignatureMethod;
  image?: string;
  text?: string;
}

/** Capture a client signature on a document that requested one. */
export async function signDocumentAction(
  token: string,
  documentId: string,
  input: SignDocumentInput,
): Promise<ActionResult> {
  try {
    const data = await getPortalDocument(token, documentId);
    if (!data) return { ok: false, error: "Document not found" };
    const { workspace, contact, doc } = data;

    if (!doc.signatureRequested) {
      return { ok: false, error: "This document has not been sent for signature" };
    }
    if (doc.signature) {
      return { ok: false, error: "This document has already been signed" };
    }

    const signedBy = typedSignatureText(input.signedBy) || contact.name;
    if (!signedBy) return { ok: false, error: "Enter the signatory name" };

    let image: string | undefined;
    let text: string | undefined;
    if (input.method === "typed") {
      text = typedSignatureText(input.text || signedBy);
      if (!text) return { ok: false, error: "Type a signature" };
    } else {
      if (!input.image) return { ok: false, error: "Provide a signature image" };
      const check = validateSignatureImage(input.image);
      if (!check.ok) return { ok: false, error: check.error };
      image = input.image;
    }

    const now = new Date();
    await collections.documents().updateOne(
      { _id: doc._id, workspaceId: workspace._id },
      {
        $set: {
          signature: {
            signedBy,
            method: input.method,
            ...(image ? { image } : {}),
            ...(text ? { text } : {}),
            signedAt: now,
          },
          updatedAt: now,
        },
      },
    );
    await logActivity({
      workspaceId: workspace._id,
      documentId: doc._id,
      type: "signed",
      message: `Signed by ${signedBy} (${signatureMethodLabel(input.method)})`,
      actor: "client",
    });
    await notifyWorkspace({
      workspaceId: workspace._id,
      type: "signature_completed",
      title: "Signature completed",
      body: `${doc.number} signed by ${signedBy}`,
      href: `/app/documents/${documentId}`,
    });

    revalidatePath(`/portal/${token}/${documentId}`);
    revalidatePath(`/app/documents/${documentId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to record signature",
    };
  }
}

/* ============================================================
   Payment history for the portal home
   ============================================================ */

export interface PortalPaymentRow {
  id: string;
  documentId: string;
  documentNumber: string;
  amount: number;
  currency: string;
  date: string;
  method: string;
  reference?: string;
  refunded: boolean;
}

/** Payments recorded against this contact's documents. */
export async function getPortalPayments(token: string): Promise<PortalPaymentRow[]> {
  if (!validToken(token)) return [];
  const contact = await findPortalContact(token);
  if (!contact) return [];

  const docs = await collections
    .documents()
    .find({
      workspaceId: contact.workspaceId,
      contactId: contact._id,
      deletedAt: null,
      type: { $in: ["invoice", "quote", "request"] },
    })
    .project<{ _id: LetterpadDoc["_id"]; number: string; currency: string }>({
      _id: 1,
      number: 1,
      currency: 1,
    })
    .toArray();
  if (docs.length === 0) return [];

  const payments = await collections
    .payments()
    .find({ documentId: { $in: docs.map((d) => d._id) } })
    .sort({ date: -1, createdAt: -1 })
    .limit(50)
    .toArray();

  const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  return payments.map((p) => {
    const doc = byId.get(p.documentId.toHexString());
    return {
      id: p._id.toHexString(),
      documentId: p.documentId.toHexString(),
      documentNumber: doc?.number ?? "—",
      amount: p.amount,
      currency: doc?.currency ?? "USD",
      date: p.date,
      method: p.method,
      reference: p.reference,
      refunded: p.refunded ?? false,
    };
  });
}

/** Outstanding balance for one document as seen from the portal. */
export async function getPortalBalance(
  token: string,
  documentId: string,
): Promise<{ total: number; paid: number; balance: number; currency: string } | null> {
  const data = await getPortalDocument(token, documentId);
  if (!data) return null;
  const payments = await collections
    .payments()
    .find({ documentId: data.doc._id })
    .toArray();
  const paid = sumPayments(payments);
  return {
    total: data.doc.total,
    paid,
    balance: Math.max(0, Math.round((data.doc.total - paid) * 100) / 100),
    currency: data.doc.currency,
  };
}
