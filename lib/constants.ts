export const DEFAULT_PRESET =
  "deepgram_nova_3,openai_gpt_5_mini,minimax_speech_2_6_turbo";

export const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful voice assistant. Keep responses concise and conversational, suitable for spoken dialogue. When you need to perform actions like booking appointments or sending email, use the available tools.";

export const DEFAULT_GREETING =
  "Hello! I'm listening. How can I help you today?";

export const RTC_TOKEN_TTL_SEC = 3600;

/** Mic level above this shows "Listening to you…" (higher = less sensitive on noisy phones). */
export const VOLUME_THRESHOLD = 0.14;

/** If no agent audio after this, show an error (ms). */
export const AGENT_JOIN_TIMEOUT_MS = 45_000;

/** Poll for agent remote audio while waiting to hear the assistant. */
export const AGENT_AUDIO_POLL_MS = 1_500;

export const GREETING_DELAY_MS = 800;

export const VOLUME_POLL_MS = 100;
