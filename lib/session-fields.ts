import { maskEmail } from "@/lib/email-utils";
import {
  isSessionFieldsKvConfigured,
  kvDel,
  kvGetJson,
  kvSetJson,
} from "@/lib/session-fields-kv";

export type SessionFieldsStatus =
  | "none"
  | "awaiting_capture"
  | "pending_confirmation"
  | "confirmed";

export type SessionFieldsRecord = {
  email?: string;
  emailConfirmed: boolean;
  awaitingEmailCapture: boolean;
  subject?: string;
  updatedAt: number;
  expiresAt: number;
};

const TTL_MS = 60 * 60 * 1000;
const memoryStore = new Map<string, SessionFieldsRecord>();

function sessionKey(channel: string): string {
  return `nexora:session-fields:${channel}`;
}

function freshRecord(): SessionFieldsRecord {
  const now = Date.now();
  return {
    emailConfirmed: false,
    awaitingEmailCapture: false,
    updatedAt: now,
    expiresAt: now + TTL_MS,
  };
}

function isExpired(entry: SessionFieldsRecord): boolean {
  return entry.expiresAt < Date.now();
}

async function readEntry(channel: string): Promise<SessionFieldsRecord | null> {
  const fromKv = await kvGetJson<SessionFieldsRecord>(sessionKey(channel));
  if (fromKv && !isExpired(fromKv)) {
    memoryStore.set(channel, fromKv);
    return fromKv;
  }

  const entry = memoryStore.get(channel);
  if (!entry) return null;
  if (isExpired(entry)) {
    memoryStore.delete(channel);
    await kvDel(sessionKey(channel));
    return null;
  }
  return entry;
}

async function writeEntry(
  channel: string,
  entry: SessionFieldsRecord,
): Promise<void> {
  entry.updatedAt = Date.now();
  entry.expiresAt = Date.now() + TTL_MS;
  memoryStore.set(channel, entry);
  await kvSetJson(sessionKey(channel), entry);
}

export async function getSessionFields(
  channel: string,
): Promise<SessionFieldsRecord | null> {
  return readEntry(channel);
}

/** Retry reads — helps right after form POST on another instance once KV replicates. */
export async function getSessionFieldsWithRetry(
  channel: string,
  attempts = 4,
  delayMs = 350,
): Promise<SessionFieldsRecord | null> {
  for (let i = 0; i < attempts; i++) {
    const entry = await getSessionFields(channel);
    if (entry?.email) return entry;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return getSessionFields(channel);
}

export async function getSessionFieldsStatus(
  channel: string,
): Promise<SessionFieldsStatus> {
  const entry = await readEntry(channel);
  if (!entry) return "none";
  if (entry.email && entry.emailConfirmed) return "confirmed";
  if (entry.email && !entry.emailConfirmed) return "pending_confirmation";
  if (entry.awaitingEmailCapture) return "awaiting_capture";
  return "none";
}

export async function setAwaitingEmailCapture(channel: string): Promise<void> {
  const entry = (await readEntry(channel)) ?? freshRecord();
  entry.awaitingEmailCapture = true;
  await writeEntry(channel, entry);
}

export async function setSessionEmail(
  channel: string,
  email: string,
): Promise<SessionFieldsRecord> {
  const entry = (await readEntry(channel)) ?? freshRecord();
  entry.email = email.trim();
  entry.emailConfirmed = false;
  entry.awaitingEmailCapture = false;
  await writeEntry(channel, entry);
  return entry;
}

export async function confirmSessionEmail(channel: string): Promise<boolean> {
  const entry = await readEntry(channel);
  if (!entry?.email) return false;
  entry.emailConfirmed = true;
  entry.awaitingEmailCapture = false;
  await writeEntry(channel, entry);
  return true;
}

export async function clearSessionFields(channel: string): Promise<void> {
  memoryStore.delete(channel);
  await kvDel(sessionKey(channel));
}

export async function sessionFieldsPublicView(channel: string) {
  const entry = await readEntry(channel);
  const status = await getSessionFieldsStatus(channel);
  return {
    status,
    emailMasked: entry?.email ? maskEmail(entry.email) : undefined,
    emailConfirmed: entry?.emailConfirmed ?? false,
    awaitingEmailCapture: entry?.awaitingEmailCapture ?? false,
    kvConfigured: isSessionFieldsKvConfigured(),
  };
}
