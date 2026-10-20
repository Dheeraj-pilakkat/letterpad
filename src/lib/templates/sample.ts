import type { Contact, LetterpadDoc, Workspace } from "@/lib/db/types";
import type { ObjectId } from "mongodb";
import { todayIsoDate } from "@/lib/utils";

/**
 * Sample workspace/document used by the template gallery thumbnails and
 * the landing page. Never touches the database.
 *
 * Ids are plain hex strings cast to ObjectId — these objects are passed from
 * Server Components into the client PdfPreview, and real ObjectId instances
 * carry a toJSON method that React's RSC serialization rejects.
 */

export const sampleWorkspace: Workspace = {
  _id: "000000000000000000000001" as unknown as ObjectId,
  name: "Meridian Studio",
  slug: "meridian-studio",
  ownerUserId: "sample",
  addressLine1: "14 Brigade Road",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
  country: "India",
  phone: "+91 98450 12345",
  email: "hello@meridian.studio",
  website: "meridian.studio",
  taxId: "GSTIN 29ABCDE1234F1Z5",
  bankDetails:
    "Bank: HDFC Bank · A/C 50200012345678 · IFSC HDFC0001234 · Branch: MG Road",
  currency: "INR",
  taxRate: 18,
  brandColor: "#B4552D",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const sampleContact: Contact = {
  _id: "000000000000000000000002" as unknown as ObjectId,
  workspaceId: sampleWorkspace._id,
  name: "Ananya Sharma",
  companyName: "Blue Fern Interiors",
  email: "ananya@bluefern.in",
  phone: "+91 99000 88776",
  addressLine1: "22 Richmond Road",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560025",
  country: "India",
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function sampleDocument(
  type: LetterpadDoc["type"],
  templateId: string,
  layout: LetterpadDoc["layout"],
): LetterpadDoc {
  const itemized =
    templateId.includes("quote") ||
    templateId.includes("invoice") ||
    templateId === "request-payment" ||
    templateId.includes("receipt");

  const items = itemized
    ? [
        {
          description: "Brand identity design",
          quantity: 1,
          unitPrice: 45000,
          taxRate: 18,
          amount: 45000,
        },
        {
          description: "Stationery set (letterhead, card, invoice)",
          quantity: 1,
          unitPrice: 18000,
          taxRate: 18,
          amount: 18000,
        },
        {
          description: "Print supervision",
          quantity: 3,
          unitPrice: 3500,
          taxRate: 18,
          amount: 10500,
        },
      ]
    : [];

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxTotal = Math.round(
    (items.reduce((s, i) => s + (i.amount * i.taxRate) / 100, 0) + Number.EPSILON) * 100,
  ) / 100;

  return {
    _id: "000000000000000000000003" as unknown as ObjectId,
    workspaceId: sampleWorkspace._id,
    type,
    templateId,
    number: "QTN-0042",
    status: "draft",
    title: "Brand identity for Blue Fern Interiors",
    contactId: sampleContact._id,
    issueDate: todayIsoDate(),
    dueDate: undefined,
    currency: "INR",
    items,
    subtotal,
    taxTotal,
    total: Math.round((subtotal + taxTotal + Number.EPSILON) * 100) / 100,
    content: {
      subject: itemized
        ? "Proposal for brand identity work"
        : "Request for site access next week",
      body: itemized
        ? "Dear Ananya,\n\nThank you for the opportunity to work with Blue Fern. Below is our quotation for the identity project, valid for 30 days from the date of issue.\n\nWe look forward to hearing from you."
        : "Dear Ananya,\n\nI am writing to request temporary access to the Brigade Road site between the 12th and 16th of this month, so our print team can supervise the installation of the new signage.\n\nCould you please confirm the site supervisor's contact details and the gate timings? We will ensure the work is completed within the window.\n\nThank you for your help.",
      terms: itemized
        ? "Quotation valid for 30 days. 50% advance to begin work. Prices include GST at the rates shown."
        : "This letter is issued on the letterhead of the business named above.",
    },
    layout,
    createdBy: "sample",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
