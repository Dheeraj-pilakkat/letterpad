"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { logActivity } from "@/lib/activity";
import { generateShareToken, sendEmail, shareUrl, mailtoHref } from "@/lib/share";
import { documentLinkFor } from "@/lib/document-link";
import { sendReminderCore } from "@/lib/reminders";
import { reviewRequestEmail } from "@/lib/signature";
import { documentLabel } from "@/lib/templates/registry";
import { balanceOf } from "@/lib/finance";
import { isValidPhone, normalizePhone, whatsappMessage, whatsappShareUrl } from "@/lib/whatsapp";
import type { ActionResult } from "@/lib/actions/documents";

export type ShareActionResult = ActionResult & {
  url?: string;
  /** "resend" | "mailto" | undefined */
  mode?: string;
  mailto?: string;
};

/** Enable (or re-enable with a fresh token) public sharing for a document. */
export async function enableShare(id: string): Promise<ShareActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!doc) return { ok: false, error: "Document not found" };

    const token = generateShareToken();
    await collections.documents().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      { $set: { shareEnabled: true, shareToken: token, updatedAt: new Date() } },
    );
    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "shared",
      message: "Share link enabled",
      actor: user.id,
    });
    revalidatePath(`/app/documents/${id}`);
    return { ok: true, url: shareUrl(token) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to enable sharing" };
  }
}

export async function disableShare(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id });
    if (!doc) return { ok: false, error: "Document not found" };

    await collections.documents().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      {
        $set: {
          shareEnabled: false,
          shareToken: undefined,
          updatedAt: new Date(),
        },
        $unset: { shareToken: "" },
      },
    );
    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "shared",
      message: "Share link disabled",
      actor: user.id,
    });
    revalidatePath(`/app/documents/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to disable sharing" };
  }
}

export interface EmailDocumentInput {
  id: string;
  to: string;
  subject?: string;
  message?: string;
}

/**
 * Email a document. Uses Resend when RESEND_API_KEY is set;
 * otherwise returns a mailto: draft for the browser to open.
 */
export async function emailDocument(
  input: EmailDocumentInput,
): Promise<ShareActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(input.id);
    if (!objectId) return { ok: false, error: "Invalid document id" };
    const to = input.to.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { ok: false, error: "Enter a valid recipient email" };
    }

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!doc) return { ok: false, error: "Document not found" };

    let url = "";
    if (doc.shareEnabled && doc.shareToken) {
      url = shareUrl(doc.shareToken);
    } else {
      const token = generateShareToken();
      await collections.documents().updateOne(
        { _id: objectId, workspaceId: workspace._id },
        { $set: { shareEnabled: true, shareToken: token, updatedAt: new Date() } },
      );
      url = shareUrl(token);
    }

    const subject =
      input.subject?.trim() ||
      `${doc.number} from ${workspace.name}`;
    const text =
      input.message?.trim() ||
      `Hello,\n\nPlease find ${doc.number} from ${workspace.name}.\n\nView online: ${url}\n\nThank you.`;

    const result = await sendEmail({ to, subject, text });

    if (result.ok) {
      await logActivity({
        workspaceId: workspace._id,
        documentId: objectId,
        type: "emailed",
        message:
          result.mode === "resend"
            ? `Emailed to ${to}`
            : `Opened email draft for ${to}`,
        actor: user.id,
      });
      revalidatePath(`/app/documents/${input.id}`);
      return {
        ok: true,
        url,
        mode: result.mode,
        mailto: mailtoHref({ to, subject, text }),
      };
    }
    return { ok: false, error: result.error ?? "Failed to send email" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to email document" };
  }
}

/** Called by the public share page when a recipient opens a document. */
export async function recordShareView(token: string): Promise<void> {
  if (!token || token.length < 16) return;
  try {
    const doc = await collections
      .documents()
      .findOne({ shareToken: token, shareEnabled: true });
    if (!doc || doc.deletedAt) return;
    await collections.documents().updateOne(
      { _id: doc._id },
      { $set: { updatedAt: new Date() } },
    );
    await logActivity({
      workspaceId: doc.workspaceId,
      documentId: doc._id,
      type: "viewed",
      message: "Document viewed via share link",
      actor: "client",
    });
    // Only bump to "viewed" from sent — never clobber paid/accepted/etc.
    if (doc.status === "sent") {
      await collections
        .documents()
        .updateOne(
          { _id: doc._id, status: "sent" },
          { $set: { status: "viewed", updatedAt: new Date() } },
        );
    }
    revalidatePath(`/share/${token}`);
  } catch {
    // best-effort
  }
}

export async function getSharedDocument(token: string) {
  if (!token || !/^[a-z0-9]{16,64}$/.test(token)) return null;
  const doc = await collections
    .documents()
    .findOne({ shareToken: token, shareEnabled: true, deletedAt: null });
  if (!doc) return null;
  const workspace = await collections
    .workspaces()
    .findOne({ _id: doc.workspaceId });
  if (!workspace) return null;
  const contact = doc.contactId
    ? await collections
        .contacts()
        .findOne({ _id: doc.contactId, workspaceId: workspace._id })
    : null;
  return { doc, workspace, contact };
}

/* ============================================================
   Phase 3 — review requests and payment reminders
   ============================================================ */

/**
 * Email the client an approval or signature request for a document.
 * For signature requests the document is flagged so the portal shows the
 * signing panel. Falls back to a mailto draft when Resend is not configured.
 */
export async function sendReviewRequestAction(
  id: string,
  kind: "approval" | "signature",
): Promise<ShareActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!doc) return { ok: false, error: "Document not found" };

    const contact = doc.contactId
      ? await collections
          .contacts()
          .findOne({ _id: doc.contactId, workspaceId: workspace._id })
      : null;
    const to = contact?.email?.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return {
        ok: false,
        error: "This document has no contact email — add one to the client first",
      };
    }

    if (kind === "signature") {
      await collections.documents().updateOne(
        { _id: doc._id, workspaceId: workspace._id },
        { $set: { signatureRequested: true, updatedAt: new Date() } },
      );
    }

    const url = await documentLinkFor(doc, contact);
    const { subject, text } = reviewRequestEmail({
      workspaceName: workspace.name,
      docNumber: doc.number,
      label: documentLabel(doc.type, doc.templateId),
      url,
      kind,
      clientName: contact?.name,
    });

    const result = await sendEmail({ to, subject, text });
    if (!result.ok) {
      await logActivity({
        workspaceId: workspace._id,
        documentId: doc._id,
        type: "emailed",
        message: `${kind === "signature" ? "Signature" : "Approval"} request failed: ${result.error ?? "email error"}`,
        actor: user.id,
      });
      return { ok: false, error: result.error ?? "Failed to send email" };
    }

    await logActivity({
      workspaceId: workspace._id,
      documentId: doc._id,
      type: kind === "signature" ? "shared" : "emailed",
      message:
        kind === "signature"
          ? `Signature requested from ${contact?.name ?? to}`
          : `Approval requested from ${contact?.name ?? to}`,
      actor: user.id,
    });
    if (result.mode === "resend") {
      await logActivity({
        workspaceId: workspace._id,
        documentId: doc._id,
        type: "emailed",
        message: `${kind === "signature" ? "Signature" : "Approval"} request emailed to ${to}`,
        actor: user.id,
      });
    }

    revalidatePath(`/app/documents/${id}`);
    return {
      ok: true,
      url,
      mode: result.mode,
      mailto: mailtoHref({ to, subject, text }),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send request",
    };
  }
}

/** Email a payment reminder for one outstanding document. */
export async function sendPaymentReminderAction(
  id: string,
): Promise<ShareActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const res = await sendReminderCore(workspace, objectId, user.id);
    if (!res.ok) return { ok: false, error: res.error };

    revalidatePath(`/app/documents/${id}`);
    revalidatePath("/app/finance");
    return {
      ok: true,
      url: res.url,
      mode: res.mode,
      mailto: res.mailto,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send reminder",
    };
  }
}

export interface RemindAllResult {
  ok: boolean;
  sent?: number;
  skipped?: number;
  error?: string;
}

/** Send reminders for every overdue bill that still has a balance. Capped at 25. */
export async function remindAllOverdueAction(): Promise<RemindAllResult> {
  try {
    const { workspace, user } = await requireWorkspace();

    const overdue = await collections
      .documents()
      .find({
        workspaceId: workspace._id,
        deletedAt: null,
        type: "invoice",
        status: "overdue",
      })
      .limit(100)
      .toArray();

    let sent = 0;
    let skipped = 0;
    for (const doc of overdue) {
      if (sent >= 25) break;
      const res = await sendPaymentReminderAction(doc._id.toHexString());
      if (res.ok) sent += 1;
      else skipped += 1;
    }

    if (sent > 0) {
      await logActivity({
        workspaceId: workspace._id,
        documentId: overdue[0]._id,
        type: "reminder",
        message: `Bulk reminders: ${sent} sent, ${skipped} skipped`,
        actor: user.id,
      });
    }
    revalidatePath("/app/finance");
    return { ok: true, sent, skipped };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send reminders",
    };
  }
}

export interface WhatsAppShareResult {
  ok: boolean;
  /** Ready-to-open wa.me URL with the message prefilled */
  url?: string;
  error?: string;
}

/**
 * §11.2 WhatsApp integration — build a click-to-chat link for this document.
 * Uses the client's phone from their contact record; the message includes the
 * secure document (or payment) link. The user presses send in WhatsApp.
 */
export async function whatsappShareAction(
  id: string,
  kind: "share" | "payment" | "reminder" = "share",
): Promise<WhatsAppShareResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!doc) return { ok: false, error: "Document not found" };

    const contact = doc.contactId
      ? await collections
          .contacts()
          .findOne({ _id: doc.contactId, workspaceId: workspace._id })
      : null;
    if (!contact || !isValidPhone(contact.phone)) {
      return {
        ok: false,
        error: "Add a phone number (with country code) to this client first",
      };
    }
    const phone = contact.phone ?? "";

    const url = await documentLinkFor(doc, contact);

    let balance: number | undefined;
    if (kind !== "share") {
      const payments = await collections.payments().find({ documentId: doc._id }).toArray();
      balance = balanceOf(doc.total, payments);
      if (balance <= 0) return { ok: false, error: "This document is fully paid" };
    }

    const message = whatsappMessage({
      workspaceName: workspace.name,
      docNumber: doc.number,
      label: documentLabel(doc.type, doc.templateId),
      url,
      kind,
      balance,
      currency: doc.currency,
      contactName: contact.name,
    });
    const waUrl = whatsappShareUrl(phone, message);
    if (!waUrl) return { ok: false, error: "Invalid phone number" };

    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "shared",
      message: `WhatsApp link prepared for ${contact.name} (${normalizePhone(phone)})`,
      actor: user.id,
    });
    revalidatePath(`/app/documents/${id}`);

    return { ok: true, url: waUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to prepare WhatsApp message",
    };
  }
}
