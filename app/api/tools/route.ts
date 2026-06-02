import { NextResponse } from "next/server";
import { executeAgentTool, toolRequestSchema } from "@/lib/agent-tools";
import { getN8nToolWebhookUrl } from "@/lib/env";

export async function POST(request: Request) {
  if (!getN8nToolWebhookUrl()) {
    return NextResponse.json(
      {
        error:
          "N8N_TOOL_WEBHOOK_URL is not configured. Set AGORA_ENABLE_TOOLS=true and configure n8n for live agent tools.",
      },
      { status: 501 },
    );
  }

  try {
    const json: unknown = await request.json();
    const parsed = toolRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tool request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await executeAgentTool(parsed.data);
    const text = result.content[0]?.text ?? "";

    if (result.isError) {
      return NextResponse.json(
        { ok: false, error: text },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, result: { message: text } });
  } catch (error) {
    console.error("[tools]", error);
    const message =
      error instanceof Error ? error.message : "Tool bridge failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
