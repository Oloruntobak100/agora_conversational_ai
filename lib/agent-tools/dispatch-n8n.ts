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

  const args = request.args ?? {};
  const intent = resolveWorkflowIntent(args);
  const channelName =
    request.channel ??
    (typeof args.channel_name === "string" ? args.channel_name : undefined);
  const to =
    typeof args.to === "string"
      ? args.to
      : typeof args.email === "string"
        ? args.email
        : undefined;
  const subject =
    typeof args.subject === "string" ? args.subject : undefined;
  const emailBody =
    typeof args.body === "string"
      ? args.body
      : typeof args.message === "string"
        ? args.message
        : undefined;

  const body = {
    tool: request.tool,
    intent,
    to,
    email: to,
    subject,
    body: emailBody,
    message: emailBody,
    channel_name: channelName,
    requester_id:
      request.requesterId ??
      (typeof args.requester_id === "string" ? args.requester_id : undefined),
    args,
    sessionId: request.sessionId ?? channelName,
    turnId: request.turnId,
    channel: channelName,
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
