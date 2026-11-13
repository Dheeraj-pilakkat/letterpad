import { collections } from "@/lib/db/client";
import { toObjectId } from "@/lib/auth/session";
import { isExpired, portalExpiry, PORTAL_RENEW_WINDOW_DAYS } from "@/lib/share";
import type { Contact, LetterpadDoc, Workspace } from "@/lib/db/types";

export const PORTAL_TOKEN_RE = /^[a-z0-9]{16,64}$/;

const DAY_MS = 86_400_000;

/**
 * Resolve a portal token to its contact, enforcing expiry (§22 expiring
 * URLs). Active portals slide their expiry forward when fewer than
 * PORTAL_RENEW_WINDOW_DAYS remain, so engaged clients keep access while
 * dormant links eventually stop resolving.
 */
export async function findPortalContact(
  token: string,
): Promise<Contact | null> {
  if (!PORTAL_TOKEN_RE.test(token)) return null;
  const contact = await collections
    .contacts()
    .findOne({ portalToken: token, portalEnabled: true });
  if (!contact) return null;
  if (isExpired(contact.portalExpiresAt)) return null;

  const now = new Date();
  const at = new Date(contact.portalExpiresAt as Date);
  if (at.getTime() - now.getTime() < PORTAL_RENEW_WINDOW_DAYS * DAY_MS) {
    const renewed = portalExpiry(now);
    await collections
      .contacts()
      .updateOne({ _id: contact._id }, { $set: { portalExpiresAt: renewed } });
    contact.portalExpiresAt = renewed;
  }
  return contact;
}

/** Resolve a portal token to its contact + workspace. */
export async function resolvePortal(
  token: string,
): Promise<{ contact: Contact; workspace: Workspace } | null> {
  const contact = await findPortalContact(token);
  if (!contact) return null;
  const workspace = await collections
    .workspaces()
    .findOne({ _id: contact.workspaceId });
  if (!workspace) return null;
  return { contact, workspace };
}

/** Resolve a portal token + document id to the contact-visible document. */
export async function portalDocument(
  token: string,
  documentId: string,
): Promise<{ contact: Contact; workspace: Workspace; doc: LetterpadDoc } | null> {
  const resolved = await resolvePortal(token);
  if (!resolved) return null;
  const objectId = toObjectId(documentId);
  if (!objectId) return null;
  const doc = await collections
    .documents()
    .findOne({
      _id: objectId,
      workspaceId: resolved.workspace._id,
      contactId: resolved.contact._id,
      deletedAt: null,
    });
  if (!doc) return null;
  return { ...resolved, doc };
}
