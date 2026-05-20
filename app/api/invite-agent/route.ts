import { NextRequest, NextResponse } from "next/server";
import {
  AgoraClient,
  Agent,
  Area,
  DeepgramSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from "agora-agent-server-sdk";
import type { AgentResponse, ClientStartRequest } from "@/types/conversation";
import {
  getAgentGreeting,
  getAgentUid,
  getAgoraAppCertificate,
  getAgoraAppId,
} from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const NEXORA_SYSTEM_PROMPT = `You are a helpful voice assistant for Nexora. Keep responses concise and conversational, suitable for spoken dialogue. Do not use bullet points or numbered lists unless the user explicitly asks. Ask at most one clarifying question per turn when needed.`;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`invite-agent:${ip}`)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as ClientStartRequest;
    const { requester_id, channel_name } = body;

    const appId = getAgoraAppId();
    const appCertificate = getAgoraAppCertificate();
    const greeting = getAgentGreeting();
    const agentUid = getAgentUid();

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: "channel_name and requester_id are required" },
        { status: 400 }
      );
    }

    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    const agent = new Agent({
      name: `nexora-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
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
      .withStt(
        new DeepgramSTT({
          model: "nova-3",
          language: "en",
        })
      )
      .withLlm(
        new OpenAI({
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
      )
      .withTts(
        new MiniMaxTTS({
          model: "speech_2_6_turbo",
          voiceId: "English_captivating_female1",
        })
      );

    const session = agent.createSession(client, {
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 120,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    const agentId = await session.start();

    console.info("[invite-agent]", {
      channel: channel_name,
      agentId,
      agentUid,
      requester_id,
    });

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: "RUNNING",
    } as AgentResponse);
  } catch (error) {
    console.error("[invite-agent]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start conversation",
      },
      { status: 500 }
    );
  }
}
