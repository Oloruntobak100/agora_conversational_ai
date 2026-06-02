/**
 * In-process session map for MCP tool handlers (channel → agent metadata).
 * Works on warm serverless instances; tools also accept explicit ids in arguments.
 */
export type SessionToolContext = {
  agentId: string;
  requesterId: string;
  channel: string;
  expiresAt: number;
};

const store = new Map<string, SessionToolContext>();

const TTL_MS = 60 * 60 * 1000;

export function setSessionToolContext(
  channel: string,
  agentId: string,
  requesterId: string,
): void {
  store.set(channel, {
    channel,
    agentId,
    requesterId,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function getSessionToolContext(
  channel: string,
): SessionToolContext | null {
  const entry = store.get(channel);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(channel);
    return null;
  }
  return entry;
}

export function clearSessionToolContext(channel: string): void {
  store.delete(channel);
}
