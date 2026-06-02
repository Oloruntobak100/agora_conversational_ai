const ACTIVE_AGENT_KEY = 'nexora-active-agent-id';

export function getStoredAgentId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACTIVE_AGENT_KEY);
}

export function setStoredAgentId(agentId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ACTIVE_AGENT_KEY, agentId);
}

export function clearStoredAgentId(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ACTIVE_AGENT_KEY);
}

/** Stop a prior session's cloud agent (page refresh without End Conversation). */
export async function stopStoredAgentIfAny(): Promise<void> {
  const agentId = getStoredAgentId();
  if (!agentId) return;

  clearStoredAgentId();
  try {
    await fetch('/api/stop-conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId }),
    });
  } catch {
    // Best-effort — new session should still proceed.
  }
}
