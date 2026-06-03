import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-server";
import type { SessionFieldsRecord } from "@/lib/session-fields-types";

const TABLE = "nexora_session_fields";

export function isSessionFieldsSupabaseConfigured(): boolean {
  return isSupabaseConfigured();
}

type SessionFieldsRow = {
  channel: string;
  email: string | null;
  email_confirmed: boolean;
  awaiting_email_capture: boolean;
  subject: string | null;
  email_body: string | null;
  content_confirmed: boolean;
  updated_at: string;
  expires_at: string;
};

function rowToRecord(row: SessionFieldsRow): SessionFieldsRecord {
  return {
    email: row.email ?? undefined,
    emailConfirmed: row.email_confirmed,
    awaitingEmailCapture: row.awaiting_email_capture,
    subject: row.subject ?? undefined,
    body: row.email_body ?? undefined,
    contentConfirmed: row.content_confirmed ?? false,
    updatedAt: new Date(row.updated_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

function recordToRow(
  channel: string,
  entry: SessionFieldsRecord,
): SessionFieldsRow {
  return {
    channel,
    email: entry.email ?? null,
    email_confirmed: entry.emailConfirmed,
    awaiting_email_capture: entry.awaitingEmailCapture,
    subject: entry.subject ?? null,
    email_body: entry.body ?? null,
    content_confirmed: entry.contentConfirmed,
    updated_at: new Date(entry.updatedAt).toISOString(),
    expires_at: new Date(entry.expiresAt).toISOString(),
  };
}

export async function supabaseGetSessionFields(
  channel: string,
): Promise<SessionFieldsRecord | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .eq("channel", channel)
      .maybeSingle();

    if (error) {
      console.warn("[session-fields-supabase] get", error.message);
      return null;
    }
    if (!data) return null;
    return rowToRecord(data as SessionFieldsRow);
  } catch (error) {
    console.warn("[session-fields-supabase] get", error);
    return null;
  }
}

export async function supabaseUpsertSessionFields(
  channel: string,
  entry: SessionFieldsRecord,
): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  const { error } = await client.from(TABLE).upsert(recordToRow(channel, entry), {
    onConflict: "channel",
  });
  if (error) {
    throw new Error(`[session-fields-supabase] upsert: ${error.message}`);
  }
}

export async function supabaseDeleteSessionFields(
  channel: string,
): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const { error } = await client.from(TABLE).delete().eq("channel", channel);
    if (error) {
      console.warn("[session-fields-supabase] delete", error.message);
    }
  } catch (error) {
    console.warn("[session-fields-supabase] delete", error);
  }
}
