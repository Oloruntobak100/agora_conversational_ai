import {
  Agent,
  DeepgramSTT,
  MiniMaxTTS,
  OpenAI,
} from "agora-agent-server-sdk";
import { getSilenceWrapUpContent } from "@/lib/conversation-end";
import {
  getAgentGreeting,
  getAgoraEnableTools,
  getDeepgramApiKey,
  getLlmApiKey,
  getLlmUrl,
  getMcpAuthToken,
  getMcpPublicUrl,
  getMiniMaxApiKey,
  getMiniMaxGroupId,
  getMiniMaxTtsUrl,
  getSilenceTimeoutMs,
  getVadSilenceDurationMs,
} from "@/lib/env";

const NEXORA_SYSTEM_PROMPT = `You are Nexora, a helpful voice assistant. Keep every reply concise and natural for spoken dialogue — no bullet points or numbered lists unless the user explicitly asks. Ask at most one clarifying question per turn when needed.

Session context: channel {{channel_name}}, user id {{requester_id}}.

When the user needs live data, lookups, or actions (orders, bookings, CRM, etc.), call the invoke_workflow tool with channel_name, requester_id, and a clear description in args.

Do not end the call just because the user paused briefly. Normal pauses while thinking are fine.

When the user clearly ends the conversation (goodbye, bye, "that's all", "I'm done", "hang up", "end call"):
- Respond with ONE short spoken goodbye only (under 12 words), e.g. "Goodbye, take care!" or "Bye, have a great day!"
- Do NOT say "one moment", "let me think", "just a second", or ask another question.
- Then immediately call end_conversation with channel_name and requester_id. Never speak again after that tool call.

If you checked whether they are still there and they confirm they are done: one brief goodbye, then end_conversation once. Do not repeat goodbyes.`;

export type InviteSessionMeta = {
  channel: string;
  requesterId: string;
};

export type InviteAgentPipelineConfig = {
  name: string;
  greeting: string;
  byok: { llm: boolean; stt: boolean; tts: boolean };
  toolsEnabled: boolean;
};

function buildMcpServers():
  | { name: string; endpoint: string; transport: "streamable_http"; headers?: Record<string, string> }[]
  | undefined {
  if (!getAgoraEnableTools()) return undefined;

  const base = getMcpPublicUrl();
  if (!base) {
    console.warn(
      "[invite-agent-pipeline] AGORA_ENABLE_TOOLS is true but NEXORA_MCP_PUBLIC_URL / VERCEL_URL is unset",
    );
    return undefined;
  }

  const token = getMcpAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return [
    {
      name: "nexora",
      endpoint: `${base}/api/mcp`,
      transport: "streamable_http",
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    },
  ];
}

export function buildInviteAgentPipeline(
  name: string,
  sessionMeta: InviteSessionMeta,
): { agent: Agent; config: InviteAgentPipelineConfig } {
  const greeting = getAgentGreeting();
  const llmApiKey = getLlmApiKey();
  const deepgramApiKey = getDeepgramApiKey();
  const miniMaxApiKey = getMiniMaxApiKey();
  const miniMaxGroupId = getMiniMaxGroupId();
  const mcpServers = buildMcpServers();
  const toolsEnabled = Boolean(mcpServers?.length);

  const config: InviteAgentPipelineConfig = {
    name,
    greeting,
    byok: {
      llm: !!llmApiKey,
      stt: !!deepgramApiKey,
      tts: !!(miniMaxApiKey && miniMaxGroupId),
    },
    toolsEnabled,
  };

  const llmBase = {
    failureMessage: "Please wait a moment.",
    maxHistory: 15,
    templateVariables: {
      channel_name: sessionMeta.channel,
      requester_id: sessionMeta.requesterId,
    },
    ...(mcpServers ? { mcpServers } : {}),
    params: {
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.95,
    },
  };

  const stt = deepgramApiKey
    ? new DeepgramSTT({
        apiKey: deepgramApiKey,
        model: "nova-3",
        language: "en",
      })
    : new DeepgramSTT({
        model: "nova-3",
        language: "en",
      });

  const llm = llmApiKey
    ? new OpenAI({
        apiKey: llmApiKey,
        url: getLlmUrl(),
        model: "gpt-4o-mini",
        ...llmBase,
      })
    : new OpenAI({
        model: "gpt-4o-mini",
        ...llmBase,
      });

  const tts =
    miniMaxApiKey && miniMaxGroupId
      ? new MiniMaxTTS({
          key: miniMaxApiKey,
          groupId: miniMaxGroupId,
          url: getMiniMaxTtsUrl(),
          model: "speech_2_6_turbo",
          voiceId: "English_captivating_female1",
        })
      : new MiniMaxTTS({
          model: "speech_2_6_turbo",
          voiceId: "English_captivating_female1",
        });

  const silenceMs = getSilenceTimeoutMs();

  let agent = new Agent({
    name,
    instructions: NEXORA_SYSTEM_PROMPT,
    failureMessage: "Please wait a moment.",
    maxHistory: 32,
    turnDetection: {
      config: {
        speech_threshold: 0.5,
        start_of_speech: {
          mode: "vad",
          vad_config: {
            interrupt_duration_ms: 160,
            prefix_padding_ms: 300,
          },
        },
        end_of_speech: {
          mode: "vad",
          vad_config: {
            silence_duration_ms: getVadSilenceDurationMs(),
          },
        },
      },
    },
    advancedFeatures: {
      enable_rtm: true,
      enable_tools: toolsEnabled,
    },
    parameters: {
      data_channel: "rtm",
      enable_error_message: true,
      enable_metrics: true,
      silence_config:
        silenceMs > 0
          ? {
              timeout_ms: silenceMs,
              action: "think",
              content: getSilenceWrapUpContent(),
            }
          : undefined,
      farewell_config: {
        graceful_enabled: true,
        graceful_timeout_seconds: 15,
      },
    },
  })
    .withStt(stt)
    .withLlm(llm)
    .withTts(tts)
    .withLabels({
      app: "nexora",
      channel: sessionMeta.channel,
      requester_id: sessionMeta.requesterId,
    })
    .withFillerWords({
      enable: true,
      trigger: {
        mode: "fixed_time",
        fixed_time_config: { response_wait_ms: 1_400 },
      },
      content: {
        mode: "static",
        static_config: {
          phrases: ["One moment."],
          selection_rule: "shuffle",
        },
      },
    });

  return { agent, config };
}
