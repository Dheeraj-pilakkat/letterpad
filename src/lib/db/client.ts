import { MongoClient, type Db } from "mongodb";
import type {
  ActivityEvent,
  Contact,
  Counter,
  Expense,
  LetterpadDoc,
  Payment,
  Product,
  Project,
  RecurringSchedule,
  ScheduledDelivery,
  Workspace,
  WorkspaceInvite,
} from "./types";

/* ============================================================
   MongoDB singleton — one client per process, shared across
   dev hot reloads via globalThis.
   ============================================================ */

const globalWithMongo = globalThis as unknown as {
  _letterpadMongo?: { client: MongoClient; db: Db; indexed: Promise<void> };
};

function connectionString(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it to .env.local (see .env.example).",
    );
  }
  return uri;
}

export function getMongoClient(): MongoClient {
  const cached = globalWithMongo._letterpadMongo;
  // Recreate the client if its topology was closed (failed handshake, long
  // outage, hot reload) — otherwise every request would fail forever.
  if (cached && !isTopologyClosed(cached.client)) {
    return cached.client;
  }
  const client = new MongoClient(connectionString(), {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    ignoreUndefined: true,
  });
  // drop the cache the moment the topology closes so the next request reconnects
  client.on("close", () => {
    if (globalWithMongo._letterpadMongo?.client === client) {
      globalWithMongo._letterpadMongo = undefined;
    }
  });
  const db = client.db();
  globalWithMongo._letterpadMongo = {
    client,
    db,
    indexed: ensureIndexes(db),
  };
  return client;
}

function isTopologyClosed(client: MongoClient): boolean {
  try {
    const topology = (
      client as unknown as { topology?: { isClosed?: () => boolean } }
    ).topology;
    return topology?.isClosed?.() ?? false;
  } catch {
    return false;
  }
}

export function getDb(): Db {
  getMongoClient(); // ensure singleton exists
  return globalWithMongo._letterpadMongo!.db;
}

async function ensureIndexes(db: Db): Promise<void> {
  const docs = db.collection<LetterpadDoc>("documents");
  await Promise.all([
    docs.createIndex(
      { workspaceId: 1, number: 1 },
      { unique: true, name: "documents_workspace_number_unique" },
    ),
    docs.createIndex(
      { workspaceId: 1, createdAt: -1 },
      { name: "documents_workspace_created_idx" },
    ),
    docs.createIndex(
      { workspaceId: 1, type: 1 },
      { name: "documents_workspace_type_idx" },
    ),
    db
      .collection<Contact>("contacts")
      .createIndex({ workspaceId: 1, name: 1 }, { name: "contacts_workspace_idx" }),
    db
      .collection<ActivityEvent>("activity")
      .createIndex(
        { workspaceId: 1, documentId: 1, createdAt: -1 },
        { name: "activity_doc_idx" },
      ),
    db
      .collection<LetterpadDoc>("documents")
      .createIndex(
        { shareToken: 1 },
        { unique: true, partialFilterExpression: { shareToken: { $exists: true } }, name: "documents_share_token_unique" },
      ),
    db
      .collection<RecurringSchedule>("schedules")
      .createIndex(
        { workspaceId: 1, status: 1, nextRunAt: 1 },
        { name: "schedules_due_idx" },
      ),
    db
      .collection<Contact>("contacts")
      .createIndex(
        { portalToken: 1 },
        {
          unique: true,
          partialFilterExpression: { portalToken: { $exists: true } },
          name: "contacts_portal_token_unique",
        },
      ),
    db
      .collection<Payment>("payments")
      .createIndex(
        { workspaceId: 1, documentId: 1, date: -1 },
        { name: "payments_doc_idx" },
      ),
    db
      .collection<LetterpadDoc>("documents")
      .createIndex(
        { razorpayOrderId: 1 },
        {
          unique: true,
          partialFilterExpression: { razorpayOrderId: { $exists: true } },
          name: "documents_razorpay_order_idx",
        },
      )
      .catch(() => undefined),
    db
      .collection<Expense>("expenses")
      .createIndex(
        { workspaceId: 1, date: -1 },
        { name: "expenses_workspace_date_idx" },
      ),
    db
      .collection<Product>("products")
      .createIndex(
        { workspaceId: 1, name: 1 },
        { name: "products_workspace_idx" },
      ),
    db
      .collection<Project>("projects")
      .createIndex(
        { workspaceId: 1, createdAt: -1 },
        { name: "projects_workspace_idx" },
      ),
    db
      .collection<LetterpadDoc>("documents")
      .createIndex(
        { projectId: 1 },
        {
          partialFilterExpression: { projectId: { $exists: true } },
          name: "documents_project_idx",
        },
      )
      .catch(() => undefined),
    db
      .collection<WorkspaceInvite>("invites")
      .createIndex(
        { token: 1 },
        {
          unique: true,
          partialFilterExpression: { token: { $exists: true } },
          name: "invites_token_unique",
        },
      ),
    db
      .collection<ScheduledDelivery>("deliveries")
      .createIndex(
        { workspaceId: 1, status: 1, sendAt: 1 },
        { name: "deliveries_due_idx" },
      )
      .catch(() => undefined),
  ]);
}

/** Wait for index creation once per process (called from boot paths). */
export async function ensureDbReady(): Promise<void> {
  getMongoClient();
  await globalWithMongo._letterpadMongo!.indexed;
}

export const collections = {
  workspaces: () => getDb().collection<Workspace>("workspaces"),
  contacts: () => getDb().collection<Contact>("contacts"),
  documents: () => getDb().collection<LetterpadDoc>("documents"),
  counters: () => getDb().collection<Counter>("counters"),
  activity: () => getDb().collection<ActivityEvent>("activity"),
  schedules: () => getDb().collection<RecurringSchedule>("schedules"),
  payments: () => getDb().collection<Payment>("payments"),
  expenses: () => getDb().collection<Expense>("expenses"),
  products: () => getDb().collection<Product>("products"),
  projects: () => getDb().collection<Project>("projects"),
  invites: () => getDb().collection<WorkspaceInvite>("invites"),
  deliveries: () => getDb().collection<ScheduledDelivery>("deliveries"),
};

/** Live (non-trashed) documents filter. `{ deletedAt: null }` matches missing or null. */
export const liveDocuments = { deletedAt: null } as const;
