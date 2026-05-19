/**
 * Generate a channel name valid for Agora RTC (alphanumeric, < 64 chars).
 */
export function generateChannelName(): string {
  return `voice${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function generateAgentInstanceName(): string {
  return `agent-${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Random numeric UID in a safe range for Conversational AI (string in API).
 */
export function generateNumericUid(): number {
  return Math.floor(100_000 + Math.random() * 8_900_000);
}

export function generateUidPair(): { userUid: number; agentUid: number } {
  let userUid = generateNumericUid();
  let agentUid = generateNumericUid();
  while (agentUid === userUid) {
    agentUid = generateNumericUid();
  }
  return { userUid, agentUid };
}
