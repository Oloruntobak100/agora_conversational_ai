import { NextResponse } from "next/server";

import { buildJoinPayload } from "@/lib/agora/join-payload";
import { joinConversationalAgent } from "@/lib/agora/rest";
import { buildRtcToken } from "@/lib/agora/rtc-token";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  generateAgentInstanceName,
  generateChannelName,
  generateUidPair,
} from "@/lib/session";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`session-start:${ip}`)) {
      return NextResponse.json(
        { error: "Too many session requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const env = getServerEnv();
    const channel = generateChannelName();
    const agentName = generateAgentInstanceName();
    const { userUid, agentUid } = generateUidPair();

    const userToken = buildRtcToken(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      channel,
      userUid
    );
    const agentToken = buildRtcToken(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      channel,
      agentUid
    );

    const joinBody = buildJoinPayload(env, {
      name: agentName,
      channel,
      agentToken,
      agentRtcUid: agentUid,
      userRtcUid: userUid,
      idleTimeoutSec: env.SESSION_IDLE_TIMEOUT_SEC,
    });

    const joinResult = await joinConversationalAgent(
      env.AGORA_CONVERSATIONAL_AI_BASE_URL,
      env.AGORA_APP_ID,
      env.AGORA_CUSTOMER_ID,
      env.AGORA_CUSTOMER_SECRET,
      joinBody
    );

    // Give the cloud agent time to enter the RTC channel before the client joins.
    if (joinResult.status === "STARTING") {
      await new Promise((r) => setTimeout(r, 2500));
    } else if (joinResult.status === "RUNNING") {
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.info("[session/start]", {
      channel,
      agentId: joinResult.agent_id,
      status: joinResult.status,
      userUid,
      agentUid,
    });

    return NextResponse.json({
      appId: env.AGORA_APP_ID,
      channel,
      uid: userUid,
      token: userToken,
      agentId: joinResult.agent_id,
      agentRtcUid: agentUid,
      agentStatus: joinResult.status,
      idleTimeoutSec: env.SESSION_IDLE_TIMEOUT_SEC,
      maxSessionMinutes: env.AGENT_SESSION_MAX_MINUTES,
    });
  } catch (error) {
    console.error("[session/start]", error);
    const message =
      error instanceof Error ? error.message : "Failed to start session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
