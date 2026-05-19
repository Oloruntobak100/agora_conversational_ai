import { NextResponse } from "next/server";
import { z } from "zod";

import { leaveConversationalAgent } from "@/lib/agora/rest";
import { getServerEnv } from "@/lib/env";

const bodySchema = z.object({
  agentId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    let agentId: string;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json: unknown = await request.json();
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "agentId is required" },
          { status: 400 }
        );
      }
      agentId = parsed.data.agentId;
    } else {
      // sendBeacon may post as text/plain
      const text = await request.text();
      try {
        const json = JSON.parse(text) as unknown;
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "agentId is required" },
            { status: 400 }
          );
        }
        agentId = parsed.data.agentId;
      } catch {
        return NextResponse.json(
          { error: "Invalid request body" },
          { status: 400 }
        );
      }
    }

    const env = getServerEnv();

    await leaveConversationalAgent(
      env.AGORA_CONVERSATIONAL_AI_BASE_URL,
      env.AGORA_APP_ID,
      env.AGORA_CUSTOMER_ID,
      env.AGORA_CUSTOMER_SECRET,
      agentId
    );

    console.info("[session/stop]", { agentId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[session/stop]", error);
    const message =
      error instanceof Error ? error.message : "Failed to stop session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
