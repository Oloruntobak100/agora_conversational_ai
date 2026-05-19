import {
  DEFAULT_GREETING,
  DEFAULT_PRESET,
  DEFAULT_SYSTEM_PROMPT,
} from "@/lib/constants";
import type { ServerEnv } from "@/lib/env";
import type { AgoraJoinRequest } from "@/types/agent";

export interface JoinPayloadInput {
  name: string;
  channel: string;
  agentToken: string;
  agentRtcUid: number;
  userRtcUid: number;
  idleTimeoutSec: number;
}

export function buildJoinPayload(
  env: ServerEnv,
  input: JoinPayloadInput
): AgoraJoinRequest {
  const preset = env.AGORA_AGENT_PRESET ?? DEFAULT_PRESET;
  const systemPrompt = env.AGENT_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
  const greeting = env.AGENT_GREETING_MESSAGE ?? DEFAULT_GREETING;

  const llm: Record<string, unknown> = {
    system_messages: [{ role: "system", content: systemPrompt }],
    greeting_message: greeting,
    max_history: 32,
  };

  if (env.OPENAI_API_KEY && env.AGENT_LLM_MODEL) {
    llm.url = "https://api.openai.com/v1/chat/completions";
    llm.api_key = env.OPENAI_API_KEY;
    llm.params = { model: env.AGENT_LLM_MODEL };
  }

  const properties: Record<string, unknown> = {
    channel: input.channel,
    token: input.agentToken,
    agent_rtc_uid: String(input.agentRtcUid),
    remote_rtc_uids: [String(input.userRtcUid)],
    idle_timeout: input.idleTimeoutSec,
    enable_string_uid: false,
    llm,
    parameters: {
      audio_scenario: "aiserver",
    },
    interruption: {
      enable: true,
      mode: "start_of_speech",
    },
  };

  if (env.AGORA_ENABLE_TOOLS && env.N8N_MCP_ENDPOINT) {
    properties.advanced_features = {
      enable_tools: true,
    };
    llm.mcp_servers = [
      {
        name: env.N8N_MCP_SERVER_NAME ?? "n8n",
        transport: "streamable_http",
        endpoint: env.N8N_MCP_ENDPOINT,
        allowed_tools: ["*"],
        timeout_ms: 30_000,
      },
    ];
  }

  return {
    name: input.name,
    preset,
    properties,
  };
}
