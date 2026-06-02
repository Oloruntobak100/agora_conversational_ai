/**
 * Server-side Agora credentials with legacy Vercel env fallbacks.
 */
export function getAgoraAppId(): string {
  const id =
    process.env.NEXT_PUBLIC_AGORA_APP_ID?.trim() ||
    process.env.AGORA_APP_ID?.trim();
  if (!id) {
    throw new Error(
      "Missing Agora App ID. Set NEXT_PUBLIC_AGORA_APP_ID (or legacy AGORA_APP_ID)."
    );
  }
  return id;
}

export function getAgoraAppCertificate(): string {
  const cert =
    process.env.NEXT_AGORA_APP_CERTIFICATE?.trim() ||
    process.env.AGORA_APP_CERTIFICATE?.trim();
  if (!cert) {
    throw new Error(
      "Missing Agora App Certificate. Set NEXT_AGORA_APP_CERTIFICATE (or legacy AGORA_APP_CERTIFICATE)."
    );
  }
  return cert;
}

export function getAgentUid(): string {
  return (
    process.env.NEXT_PUBLIC_AGENT_UID?.trim() ||
    String(123456)
  );
}

export function getAgentGreeting(): string {
  return (
    process.env.NEXT_AGENT_GREETING?.trim() ||
    process.env.AGENT_GREETING_MESSAGE?.trim() ||
    "Hello! I'm listening. How can I help you today?"
  );
}

/** Delay before the agent speaks its opening line after joining (ms). */
export function getAgentGreetingDelayMs(): number {
  const raw =
    process.env.NEXT_AGENT_GREETING_DELAY_MS?.trim() ||
    process.env.AGENT_GREETING_DELAY_MS?.trim();
  if (!raw) return 5_000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 5_000;
  return Math.min(parsed, 60_000);
}

/** BYOK: OpenAI (or OpenAI-compatible) LLM — fixes cloud agent LLM 401 errors. */
export function getLlmApiKey(): string | undefined {
  return (
    process.env.NEXT_LLM_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    undefined
  );
}

export function getLlmUrl(): string | undefined {
  return (
    process.env.NEXT_LLM_URL?.trim() ||
    "https://api.openai.com/v1/chat/completions"
  );
}

/** BYOK: Deepgram STT */
export function getDeepgramApiKey(): string | undefined {
  return process.env.NEXT_DEEPGRAM_API_KEY?.trim() || undefined;
}

/** BYOK: MiniMax TTS */
export function getMiniMaxApiKey(): string | undefined {
  return (
    process.env.NEXT_MINIMAX_API_KEY?.trim() ||
    process.env.MINIMAX_API_KEY?.trim() ||
    undefined
  );
}

export function getMiniMaxGroupId(): string | undefined {
  return (
    process.env.NEXT_MINIMAX_GROUP_ID?.trim() ||
    process.env.MINIMAX_GROUP_ID?.trim() ||
    undefined
  );
}

export function getMiniMaxTtsUrl(): string {
  return (
    process.env.NEXT_MINIMAX_TTS_URL?.trim() ||
    "wss://api-uw.minimax.io/ws/v1/t2a_v2"
  );
}
