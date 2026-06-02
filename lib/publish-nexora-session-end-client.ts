import type { RTMClient } from "agora-rtm";
import type { NexoraSessionSignal } from "@/lib/publish-rtm-signal";

/** Browser-only RTM signal so ConversationComponent can tear down the UI. */
export async function publishNexoraSessionEndFromClient(
  rtmClient: RTMClient,
  channel: string,
  reason?: string,
): Promise<void> {
  const payload: NexoraSessionSignal = {
    object: "nexora.session",
    action: "end",
    ...(reason ? { reason } : {}),
  };

  await rtmClient.publish(channel, JSON.stringify(payload), {
    channelType: "MESSAGE",
  });
}
