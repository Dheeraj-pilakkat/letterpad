import { collections } from "@/lib/db/client";
import { appBaseUrl, generateShareToken, isExpired, shareExpiry, shareUrl } from "@/lib/share";

interface LinkDoc {
  _id: { toHexString(): string };
  shareEnabled?: boolean;
  shareToken?: string;
  shareExpiresAt?: Date;
}

interface LinkContact {
  portalEnabled?: boolean;
  portalToken?: string;
}

/**
 * Best link for a client: their portal when enabled, otherwise a share link
 * (enabling sharing with a fresh token when needed — expired share tokens are
 * refreshed here too). Shared by the email, reminder, WhatsApp and
 * scheduled-delivery paths.
 */
export async function documentLinkFor(
  doc: LinkDoc,
  contact: LinkContact | null,
): Promise<string> {
  if (contact?.portalEnabled && contact.portalToken) {
    return `${appBaseUrl()}/portal/${contact.portalToken}/${doc._id.toHexString()}`;
  }
  if (doc.shareEnabled && doc.shareToken && !isExpired(doc.shareExpiresAt)) {
    return shareUrl(doc.shareToken);
  }
  const token = generateShareToken();
  const expiresAt = shareExpiry();
  await collections
    .documents()
    .updateOne(
      { _id: doc._id as never },
      {
        $set: {
          shareEnabled: true,
          shareToken: token,
          shareExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      },
    );
  return shareUrl(token);
}
