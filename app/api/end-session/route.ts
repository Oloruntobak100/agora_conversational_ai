import { NextResponse } from "next/server";
import { endConversationSession } from "@/lib/agent-tools/end-conversation";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agent_id?: string;
      channel_name?: string;
      requester_id?: string;
      reason?: string;
    };

    const { agent_id, channel_name, requester_id, reason } = body;

    if (!agent_id || !channel_name || !requester_id) {
      return NextResponse.json(
        {
          error: "agent_id, channel_name, and requester_id are required",
        },
        { status: 400 },
      );
    }

    const result = await endConversationSession({
      agentId: agent_id,
      channel: channel_name,
      requesterId: requester_id,
      reason: reason ?? "client end session",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[end-session]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to end session",
      },
      { status: 500 },
    );
  }
}
