import { collections } from "@/lib/db/client";
import { appBaseUrl, generateShareToken, shareUrl } from "@/lib/share";

interface LinkDoc {
  _id: { toHexString(): string };
  shareEnabled?: boolean;
  shareToken?: string;
}

interface LinkContact {
  portalEnabled?: boolean;
  portalToken?: string;
}

/**
 * Best link for a client: their portal when enabled, otherwise a share link
 * (enabling sharing with a fresh token when needed). Shared by the email,
 * reminder, WhatsApp and scheduled-delivery paths.
 */
export async function documentLinkFor(
  doc: LinkDoc,
  contact: LinkContact | null,
): Promise<string> {
  if (contact?.portalEnabled && contact.portalToken) {
    return `${appBaseUrl()}/portal/${contact.portalToken}/${doc._id.toHexString()}`;
  }
  if (doc.shareEnabled && doc.shareToken) return shareUrl(doc.shareToken);
  const token = generateShareToken();
  await collections
    .documents()
    .updateOne(
      { _id: doc._id as never },
      { $set: { shareEnabled: true, shareToken: token, updatedAt: new Date() } },
    );
  return shareUrl(token);
}
