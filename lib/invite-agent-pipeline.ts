import {
  Agent,
  DeepgramSTT,
  MiniMaxTTS,
  OpenAI,
} from "agora-agent-server-sdk";
import {
  getAgentGreeting,
  getDeepgramApiKey,
  getLlmApiKey,
  getLlmUrl,
  getMiniMaxApiKey,
  getMiniMaxGroupId,
  getMiniMaxTtsUrl,
} from "@/lib/env";

const NEXORA_SYSTEM_PROMPT = `You are a helpful voice assistant for Nexora. Keep responses concise and conversational, suitable for spoken dialogue. Do not use bullet points or numbered lists unless the user explicitly asks. Ask at most one clarifying question per turn when needed.`;

export type InviteAgentPipelineConfig = {
  name: string;
  greeting: string;
  byok: { llm: boolean; stt: boolean; tts: boolean };
};

export function buildInviteAgentPipeline(
  name: string,
): { agent: Agent; config: InviteAgentPipelineConfig } {
  const greeting = getAgentGreeting();
  const llmApiKey = getLlmApiKey();
  const deepgramApiKey = getDeepgramApiKey();
  const miniMaxApiKey = getMiniMaxApiKey();
  const miniMaxGroupId = getMiniMaxGroupId();

  const config: InviteAgentPipelineConfig = {
    name,
    greeting,
    byok: {
      llm: !!llmApiKey,
      stt: !!deepgramApiKey,
      tts: !!(miniMaxApiKey && miniMaxGroupId),
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
        greetingMessage: greeting,
        failureMessage: "Please wait a moment.",
        maxHistory: 15,
        params: {
          max_tokens: 1024,
          temperature: 0.7,
          top_p: 0.95,
        },
      })
    : new OpenAI({
        model: "gpt-4o-mini",
        greetingMessage: greeting,
        failureMessage: "Please wait a moment.",
        maxHistory: 15,
        params: {
          max_tokens: 1024,
          temperature: 0.7,
          top_p: 0.95,
        },
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

  const agent = new Agent({
    name,
    instructions: NEXORA_SYSTEM_PROMPT,
    greeting,
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
            silence_duration_ms: 480,
          },
        },
      },
    },
    advancedFeatures: { enable_rtm: true, enable_tools: false },
    parameters: {
      data_channel: "rtm",
      enable_error_message: true,
      enable_metrics: true,
    },
  })
    .withStt(stt)
    .withLlm(llm)
    .withTts(tts);

  return { agent, config };
}
