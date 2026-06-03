import { isSupabaseConfigured } from "@/lib/supabase-server";
import {
  supabaseClearToolEvents,
  supabaseInsertToolEvent,
  supabaseListToolEvents,
} from "@/lib/tool-events-supabase";

export type ToolBranchEvent = {
  id: string;
  branch: string;
  label: string;
  icon: string;
  at: number;
};

const memoryStore = new Map<string, ToolBranchEvent[]>();
const TTL_MS = 60 * 60 * 1000;

function prune(channel: string): void {
  const list = memoryStore.get(channel);
  if (!list) return;
  const cutoff = Date.now() - TTL_MS;
  const kept = list.filter((e) => e.at >= cutoff);
  if (kept.length) memoryStore.set(channel, kept);
  else memoryStore.delete(channel);
}

export async function pushToolBranchEvent(
  channel: string,
  event: Omit<ToolBranchEvent, "id" | "at"> & { id?: string; at?: number },
): Promise<ToolBranchEvent> {
  const entry: ToolBranchEvent = {
    id: event.id ?? `${Date.now()}-${event.branch}`,
    branch: event.branch,
    label: event.label,
    icon: event.icon,
    at: event.at ?? Date.now(),
  };

  const list = memoryStore.get(channel) ?? [];
  list.push(entry);
  memoryStore.set(channel, list.slice(-30));

  if (isSupabaseConfigured()) {
    await supabaseInsertToolEvent(channel, entry);
  }

  return entry;
}

export async function listToolBranchEvents(
  channel: string,
  sinceMs = 0,
): Promise<ToolBranchEvent[]> {
  if (isSupabaseConfigured()) {
    const fromDb = await supabaseListToolEvents(channel, sinceMs);
    if (fromDb.length > 0) return fromDb;
  }

  prune(channel);
  return (memoryStore.get(channel) ?? []).filter((e) => e.at > sinceMs);
}

export async function clearToolBranchEvents(channel: string): Promise<void> {
  memoryStore.delete(channel);
  if (isSupabaseConfigured()) {
    await supabaseClearToolEvents(channel);
  }
}
