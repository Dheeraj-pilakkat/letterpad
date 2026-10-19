import { MongoClient, type Db } from "mongodb";
import type { Contact, Counter, LetterpadDoc, Workspace } from "./types";

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
};
