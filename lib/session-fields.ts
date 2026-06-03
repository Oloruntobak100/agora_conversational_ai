import { maskEmail } from "@/lib/email-utils";

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
const store = new Map<string, SessionFieldsRecord>();

function freshRecord(): SessionFieldsRecord {
  const now = Date.now();
  return {
    emailConfirmed: false,
    awaitingEmailCapture: false,
    updatedAt: now,
    expiresAt: now + TTL_MS,
  };
}

function getEntry(channel: string): SessionFieldsRecord | null {
  const entry = store.get(channel);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(channel);
    return null;
  }
  return entry;
}

export function getSessionFields(channel: string): SessionFieldsRecord | null {
  return getEntry(channel);
}

export function getSessionFieldsStatus(
  channel: string,
): SessionFieldsStatus {
  const entry = getEntry(channel);
  if (!entry) return "none";
  if (entry.email && entry.emailConfirmed) return "confirmed";
  if (entry.email && !entry.emailConfirmed) return "pending_confirmation";
  if (entry.awaitingEmailCapture) return "awaiting_capture";
  return "none";
}

export function setAwaitingEmailCapture(channel: string): void {
  const entry = getEntry(channel) ?? freshRecord();
  entry.awaitingEmailCapture = true;
  entry.updatedAt = Date.now();
  entry.expiresAt = Date.now() + TTL_MS;
  store.set(channel, entry);
}

export function setSessionEmail(
  channel: string,
  email: string,
): SessionFieldsRecord {
  const entry = getEntry(channel) ?? freshRecord();
  entry.email = email.trim();
  entry.emailConfirmed = false;
  entry.awaitingEmailCapture = false;
  entry.updatedAt = Date.now();
  entry.expiresAt = Date.now() + TTL_MS;
  store.set(channel, entry);
  return entry;
}

export function confirmSessionEmail(channel: string): boolean {
  const entry = getEntry(channel);
  if (!entry?.email) return false;
  entry.emailConfirmed = true;
  entry.awaitingEmailCapture = false;
  entry.updatedAt = Date.now();
  store.set(channel, entry);
  return true;
}

export function clearSessionFields(channel: string): void {
  store.delete(channel);
}

export function sessionFieldsPublicView(channel: string) {
  const entry = getEntry(channel);
  const status = getSessionFieldsStatus(channel);
  return {
    status,
    emailMasked: entry?.email ? maskEmail(entry.email) : undefined,
    emailConfirmed: entry?.emailConfirmed ?? false,
    awaitingEmailCapture: entry?.awaitingEmailCapture ?? false,
  };
}
