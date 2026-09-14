import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { debates, InsertDebate, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db || !user.openId) return;
  const values: InsertUser = { openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: new Date() };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn } });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listPersistedDebates(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(debates).orderBy(desc(debates.createdAt)).limit(limit);
}

export async function getPersistedDebate(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(debates).where(eq(debates.id, id)).limit(1);
  return rows[0];
}

export async function insertDebate(input: InsertDebate) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(debates).values(input);
  return input;
}

export function parsePayload(row: { payload: string }) {
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}
