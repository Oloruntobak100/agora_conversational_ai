import { inviteCloudAgent } from '@/lib/invite-cloud-agent';

export type CloudAgentInviteResult =
  | { ok: true; agentId: string }
  | { ok: false };

/**
 * StrictMode-safe cloud agent invite. Ignores stale async results after cleanup.
 */
export function createCloudAgentInviteRunner() {
  let generation = 0;

  return {
    cancel() {
      generation += 1;
    },
    async invite(
      requesterId: string,
      channelName: string,
    ): Promise<CloudAgentInviteResult> {
      const gen = ++generation;
      const response = await inviteCloudAgent(requesterId, channelName);

      if (gen !== generation) {
        return { ok: false };
      }

      if (!response?.agent_id) {
        return { ok: false };
      }

      return { ok: true, agentId: response.agent_id };
    },
  };
}
