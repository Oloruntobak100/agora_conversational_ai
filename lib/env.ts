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
    "Hello! I'm listening. How can I help you today?"
  );
}

/** Delay before the agent speaks its opening line after joining (ms). */
export function getAgentGreetingDelayMs(): number {
  const raw = process.env.NEXT_AGENT_GREETING_DELAY_MS?.trim();
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

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Enable Agora MCP tools (requires public MCP URL + n8n webhook for workflows). */
export function getAgoraEnableTools(): boolean {
  return parseBool(process.env.AGORA_ENABLE_TOOLS);
}

/** Public site URL for MCP (Agora cloud must reach this). */
export function getMcpPublicUrl(): string | undefined {
  const explicit =
    process.env.NEXORA_MCP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return undefined;
}

export function getMcpAuthToken(): string | undefined {
  return process.env.MCP_AUTH_TOKEN?.trim() || undefined;
}

export function getN8nToolWebhookUrl(): string | undefined {
  return process.env.N8N_TOOL_WEBHOOK_URL?.trim() || undefined;
}

export function getN8nWebhookSecret(): string | undefined {
  return (
    process.env.N8N_WEBHOOK_SECRET?.trim() ||
    process.env.N8N_TOOL_WEBHOOK_SECRET?.trim() ||
    undefined
  );
}

/** Optional map of tool name → n8n webhook URL (JSON object). */
export function getN8nToolRoutes(): Record<string, string> {
  const raw = process.env.N8N_TOOL_ROUTES_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function getSilenceTimeoutMs(): number {
  const raw = process.env.NEXORA_SILENCE_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.min(parsed, 60_000);
  }
  return 30_000;
}

export function getIdleTimeoutSec(): number {
  const raw = process.env.NEXORA_IDLE_TIMEOUT_SEC?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 120;
}

export function getVadSilenceDurationMs(): number {
  const raw = process.env.NEXORA_VAD_SILENCE_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 2000);
  }
  return 560;
}

export function getRtmSignalUid(): string {
  return (
    process.env.NEXORA_RTM_SIGNAL_UID?.trim() ||
    process.env.NEXT_PUBLIC_AGENT_UID?.trim() ||
    "123456"
  );
}

export function getAgoraWebhookSecret(): string | undefined {
  return process.env.AGORA_WEBHOOK_SECRET?.trim() || undefined;
}
