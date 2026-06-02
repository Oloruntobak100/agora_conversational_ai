import {
  getN8nToolRoutes,
  getN8nToolWebhookUrl,
  getN8nWebhookSecret,
} from "@/lib/env";
import { parseN8nToolResponse } from "./n8n-response";
import type { ToolRequest } from "./types";
import { resolveWorkflowIntent } from "@/lib/tool-branch-event";

export async function dispatchN8nWorkflow(
  request: ToolRequest,
): Promise<{ ok: true; parsed: ReturnType<typeof parseN8nToolResponse> } | { ok: false; error: string }> {
  const routes = getN8nToolRoutes();
  const defaultUrl = getN8nToolWebhookUrl();
  const url = routes[request.tool] ?? defaultUrl;

  if (!url) {
    return {
      ok: false,
      error: `No n8n webhook configured for tool "${request.tool}"`,
    };
  }

  const secret = getN8nWebhookSecret();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const intent = resolveWorkflowIntent(request.args);

  const body = {
    tool: request.tool,
    args: request.args ?? {},
    intent,
    sessionId: request.sessionId ?? request.channel,
    turnId: request.turnId,
    channel: request.channel,
    requesterId: request.requesterId,
    agentId: request.agentId,
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let raw: unknown = { raw: text };
  if (text) {
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      raw = { message: text };
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `n8n workflow failed (${response.status})`,
    };
  }

  return { ok: true, parsed: parseN8nToolResponse(raw) };
}
