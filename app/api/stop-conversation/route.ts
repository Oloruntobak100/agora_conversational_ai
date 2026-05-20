import { NextResponse } from "next/server";
import { AgoraClient, Area } from "agora-agent-server-sdk";
import type { StopConversationRequest } from "@/types/conversation";
import { getAgoraAppCertificate, getAgoraAppId } from "@/lib/env";

function isAgentAlreadyStoppingOrStopped(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeErr = error as {
    statusCode?: number;
    body?: { detail?: string; reason?: string };
    message?: string;
  };

  const statusCode = maybeErr.statusCode;
  const reason = maybeErr.body?.reason?.toLowerCase();
  const detail =
    maybeErr.body?.detail?.toLowerCase() ??
    maybeErr.message?.toLowerCase() ??
    "";

  if (statusCode === 404) return true;
  if (
    reason === "invalidrequest" &&
    detail.includes("already in the process of shutting down")
  ) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StopConversationRequest;
    const { agent_id } = body;

    if (!agent_id) {
      return NextResponse.json(
        { error: "agent_id is required" },
        { status: 400 }
      );
    }

    const client = new AgoraClient({
      area: Area.US,
      appId: getAgoraAppId(),
      appCertificate: getAgoraAppCertificate(),
    });

    try {
      await client.stopAgent(agent_id);
    } catch (error) {
      if (isAgentAlreadyStoppingOrStopped(error)) {
        return NextResponse.json({ success: true, state: "already-stopping" });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[stop-conversation]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to stop conversation",
      },
      { status: 500 }
    );
  }
}
