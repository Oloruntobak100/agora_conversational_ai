import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Optional bridge when Agora tools are routed through Vercel instead of direct MCP.
 * Enable by setting N8N_TOOL_WEBHOOK_URL and calling this route from your integration layer.
 */
const bodySchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
  turnId: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_TOOL_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error:
          "N8N_TOOL_WEBHOOK_URL is not configured. Use N8N MCP endpoint with AGORA_ENABLE_TOOLS=true instead.",
      },
      { status: 501 }
    );
  }

  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tool request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const secret = process.env.N8N_WEBHOOK_SECRET;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) {
      headers["X-Webhook-Secret"] = secret;
    }

    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(parsed.data),
    });

    const text = await n8nResponse.text();
    let result: unknown = { raw: text };
    if (text) {
      try {
        result = JSON.parse(text) as unknown;
      } catch {
        result = { message: text };
      }
    }

    if (!n8nResponse.ok) {
      return NextResponse.json(
        { error: "n8n workflow failed", details: result },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[tools]", error);
    const message =
      error instanceof Error ? error.message : "Tool bridge failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
