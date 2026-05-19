import type { JoinAgentResponse } from "@/types/agent";
import type { AgoraJoinRequest } from "@/types/agent";

function basicAuthHeader(customerId: string, customerSecret: string): string {
  const credentials = Buffer.from(`${customerId}:${customerSecret}`).toString(
    "base64"
  );
  return `Basic ${credentials}`;
}

export async function joinConversationalAgent(
  baseUrl: string,
  appId: string,
  customerId: string,
  customerSecret: string,
  body: AgoraJoinRequest
): Promise<JoinAgentResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/conversational-ai-agent/v2/projects/${appId}/join`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(customerId, customerSecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: JoinAgentResponse & { detail?: string; reason?: string } = {
    agent_id: "",
    create_ts: 0,
    status: "FAILED",
  };

  if (text) {
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`Agora join returned invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  if (!response.ok) {
    const detail = data.detail ?? data.reason ?? text;
    throw new Error(
      `Agora join failed (${response.status}): ${detail || "Unknown error"}`
    );
  }

  if (!data.agent_id) {
    throw new Error("Agora join succeeded but no agent_id was returned");
  }

  return data;
}

export async function leaveConversationalAgent(
  baseUrl: string,
  appId: string,
  customerId: string,
  customerSecret: string,
  agentId: string
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/conversational-ai-agent/v2/projects/${appId}/agents/${agentId}/leave`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(customerId, customerSecret),
      "Content-Type": "application/json",
    },
  });

  if (response.ok) {
    return;
  }

  const text = await response.text();
  let detail = text;
  try {
    const parsed = JSON.parse(text) as { detail?: string; reason?: string };
    detail = parsed.detail ?? parsed.reason ?? text;
  } catch {
    // keep raw text
  }

  // Idempotent: agent already stopped
  if (response.status === 404) {
    return;
  }

  throw new Error(
    `Agora leave failed (${response.status}): ${detail || "Unknown error"}`
  );
}
