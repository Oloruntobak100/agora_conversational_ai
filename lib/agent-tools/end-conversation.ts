import { AgoraClient, Area } from "agora-agent-server-sdk";
import {
  getAgoraAppCertificate,
  getAgoraAppId,
} from "@/lib/env";
import { publishRtmSessionEnd } from "@/lib/publish-rtm-signal";
import { clearSessionToolContext } from "@/lib/session-tool-context";

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

  try {
    await publishRtmSessionEnd({ channel, reason });
  } catch (rtmError) {
    console.warn("[end-conversation] RTM signal failed:", rtmError);
  }

  clearSessionToolContext(channel);

  console.info("[end-conversation]", { agentId, channel, requesterId, reason });

  return { ok: true };
}
