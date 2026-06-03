import { maskEmail } from "@/lib/email-utils";
import {
  isSessionFieldsSupabaseConfigured,
  supabaseDeleteSessionFields,
  supabaseGetSessionFields,
  supabaseUpsertSessionFields,
} from "@/lib/session-fields-supabase";
import type {
  SessionFieldsRecord,
  SessionFieldsStatus,
} from "@/lib/session-fields-types";

export type { SessionFieldsRecord, SessionFieldsStatus };

const TTL_MS = 60 * 60 * 1000;
const memoryStore = new Map<string, SessionFieldsRecord>();

function freshRecord(): SessionFieldsRecord {
  const now = Date.now();
  return {
    emailConfirmed: false,
    awaitingEmailCapture: false,
    contentConfirmed: false,
    updatedAt: now,
    expiresAt: now + TTL_MS,
  };
}

function isExpired(entry: SessionFieldsRecord): boolean {
  return entry.expiresAt < Date.now();
}

async function readFromSupabase(
  channel: string,
): Promise<SessionFieldsRecord | null> {
  const row = await supabaseGetSessionFields(channel);
  if (!row) return null;
  if (isExpired(row)) {
    await supabaseDeleteSessionFields(channel);
    memoryStore.delete(channel);
    return null;
  }
  memoryStore.set(channel, row);
  return row;
}

async function readEntry(channel: string): Promise<SessionFieldsRecord | null> {
  if (isSessionFieldsSupabaseConfigured()) {
    const fromDb = await readFromSupabase(channel);
    if (fromDb) return fromDb;
    return null;
  }

  const entry = memoryStore.get(channel);
  if (!entry) return null;
  if (isExpired(entry)) {
    memoryStore.delete(channel);
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

  if (isSessionFieldsSupabaseConfigured()) {
    await supabaseUpsertSessionFields(channel, entry);
  }
}

export async function getSessionFields(
  channel: string,
): Promise<SessionFieldsRecord | null> {
  return readEntry(channel);
}

/** Retry reads — helps right after form POST on another serverless instance. */
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
  if (entry.email && entry.emailConfirmed && entry.contentConfirmed) {
    return "content_confirmed";
  }
  if (
    entry.email &&
    entry.emailConfirmed &&
    entry.subject &&
    entry.body &&
    !entry.contentConfirmed
  ) {
    return "pending_content";
  }
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
  entry.subject = undefined;
  entry.body = undefined;
  entry.contentConfirmed = false;
  await writeEntry(channel, entry);
  return entry;
}

export async function setSessionEmailContent(
  channel: string,
  subject: string,
  body: string,
): Promise<SessionFieldsRecord | null> {
  const entry = await readEntry(channel);
  if (!entry?.emailConfirmed) return null;
  entry.subject = subject.trim();
  entry.body = body.trim();
  entry.contentConfirmed = false;
  await writeEntry(channel, entry);
  return entry;
}

export async function confirmSessionEmailContent(
  channel: string,
): Promise<boolean> {
  const entry = await readEntry(channel);
  if (!entry?.emailConfirmed || !entry.subject?.trim() || !entry.body?.trim()) {
    return false;
  }
  entry.contentConfirmed = true;
  await writeEntry(channel, entry);
  return true;
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
  if (isSessionFieldsSupabaseConfigured()) {
    await supabaseDeleteSessionFields(channel);
  }
}

export async function sessionFieldsPublicView(channel: string) {
  const entry = await readEntry(channel);
  const status = await getSessionFieldsStatus(channel);
  return {
    status,
    emailMasked: entry?.email ? maskEmail(entry.email) : undefined,
    emailConfirmed: entry?.emailConfirmed ?? false,
    awaitingEmailCapture: entry?.awaitingEmailCapture ?? false,
    hasContent: Boolean(entry?.subject && entry?.body),
    contentConfirmed: entry?.contentConfirmed ?? false,
    storage: isSessionFieldsSupabaseConfigured() ? "supabase" : "memory",
  };
}
