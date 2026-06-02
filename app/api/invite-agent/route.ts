import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { AgoraClient, Area, ExpiresIn } from "agora-agent-server-sdk";
import type { AgentResponse, ClientStartRequest } from "@/types/conversation";
import {
  getAgentGreetingDelayMs,
  getAgentUid,
  getAgoraAppCertificate,
  getAgoraAppId,
  getLlmApiKey,
} from "@/lib/env";
import { buildInviteAgentPipeline } from "@/lib/invite-agent-pipeline";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
    const agentUid = getAgentUid();

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: "channel_name and requester_id are required" },
        { status: 400 }
      );
    }

    const llmApiKey = getLlmApiKey();
    if (!llmApiKey) {
      console.warn(
        "[invite-agent] NEXT_LLM_API_KEY is not set. The cloud agent may return LLM 401 unless Agora Console reseller keys are configured."
      );
    }

    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    const agentName = `nexora-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const { agent, config } = buildInviteAgentPipeline(agentName);

    const session = agent.createSession(client, {
      channel: channel_name,
      agentUid,
      remoteUids: [requester_id],
      idleTimeout: 120,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    const agentId = await session.start();

    const { greeting } = config;
    if (greeting) {
      const delayMs = getAgentGreetingDelayMs();
      after(async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        try {
          await session.say(greeting);
        } catch (greetingError) {
          console.error("[invite-agent] delayed greeting failed:", greetingError);
        }
      });
    }

    console.info("[invite-agent]", {
      channel: channel_name,
      agentId,
      agentUid,
      requester_id,
      byok: config.byok,
      greetingDelayMs: greeting ? getAgentGreetingDelayMs() : 0,
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
