import { getSupabaseAdmin } from "@/lib/supabase-server";

const TABLE = "nexora_tool_events";

type ToolEventRecord = {
  id: string;
  branch: string;
  label: string;
  icon: string;
  at: number;
};

export async function supabaseInsertToolEvent(
  channel: string,
  event: ToolEventRecord,
): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const { error } = await client.from(TABLE).insert({
      id: event.id,
      channel,
      branch: event.branch,
      label: event.label,
      icon: event.icon,
      created_at: new Date(event.at).toISOString(),
    });
    if (error) {
      console.warn("[tool-events-supabase] insert", error.message);
    }
  } catch (error) {
    console.warn("[tool-events-supabase] insert", error);
  }
}

export async function supabaseListToolEvents(
  channel: string,
  sinceMs: number,
): Promise<ToolEventRecord[]> {
  const client = getSupabaseAdmin();
  if (!client) return [];

  try {
    const sinceIso = new Date(sinceMs).toISOString();
    const { data, error } = await client
      .from(TABLE)
      .select("id, branch, label, icon, created_at")
      .eq("channel", channel)
      .gt("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(30);

    if (error) {
      console.warn("[tool-events-supabase] list", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      branch: row.branch as string,
      label: row.label as string,
      icon: row.icon as string,
      at: new Date(row.created_at as string).getTime(),
    }));
  } catch (error) {
    console.warn("[tool-events-supabase] list", error);
    return [];
  }
}

export async function supabaseClearToolEvents(channel: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const { error } = await client.from(TABLE).delete().eq("channel", channel);
    if (error) {
      console.warn("[tool-events-supabase] delete", error.message);
    }
  } catch (error) {
    console.warn("[tool-events-supabase] delete", error);
  }
}
