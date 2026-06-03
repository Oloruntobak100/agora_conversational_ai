import { AgoraClient, Area } from "agora-agent-server-sdk";
import {
  getAgoraAppCertificate,
  getAgoraAppId,
} from "@/lib/env";
import { clearSessionFields } from "@/lib/session-fields";
import { clearSessionToolContext } from "@/lib/session-tool-context";
import { clearToolBranchEvents } from "@/lib/session-tool-events";

export async function endConversationSession(options: {
  agentId: string;
  channel: string;
  requesterId: string;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { agentId, channel, requesterId, reason } = options;

  const client = new AgoraClient({
    area: Area.US,
    appId: getAgoraAppId(),
    appCertificate: getAgoraAppCertificate(),
  });

  try {
    await client.stopAgent(agentId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to stop agent";
    if (!message.toLowerCase().includes("shutting down")) {
      return { ok: false, error: message };
    }
  }

  clearSessionToolContext(channel);
  clearToolBranchEvents(channel);
  await clearSessionFields(channel);

  console.info("[end-conversation]", { agentId, channel, requesterId, reason });

  return { ok: true };
}
