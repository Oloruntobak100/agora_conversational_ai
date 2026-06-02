export type ToolBranchEvent = {
  id: string;
  branch: string;
  label: string;
  icon: string;
  at: number;
};

const store = new Map<string, ToolBranchEvent[]>();
const TTL_MS = 60 * 60 * 1000;

function prune(channel: string): void {
  const list = store.get(channel);
  if (!list) return;
  const cutoff = Date.now() - TTL_MS;
  const kept = list.filter((e) => e.at >= cutoff);
  if (kept.length) store.set(channel, kept);
  else store.delete(channel);
}

export function pushToolBranchEvent(
  channel: string,
  event: Omit<ToolBranchEvent, "id" | "at"> & { id?: string; at?: number },
): ToolBranchEvent {
  const entry: ToolBranchEvent = {
    id: event.id ?? `${Date.now()}-${event.branch}`,
    branch: event.branch,
    label: event.label,
    icon: event.icon,
    at: event.at ?? Date.now(),
  };
  const list = store.get(channel) ?? [];
  list.push(entry);
  store.set(channel, list.slice(-30));
  return entry;
}

export function listToolBranchEvents(
  channel: string,
  sinceMs = 0,
): ToolBranchEvent[] {
  prune(channel);
  return (store.get(channel) ?? []).filter((e) => e.at > sinceMs);
}

export function clearToolBranchEvents(channel: string): void {
  store.delete(channel);
}
