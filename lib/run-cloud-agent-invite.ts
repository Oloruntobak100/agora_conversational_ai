import { inviteCloudAgent } from '@/lib/invite-cloud-agent';
import { markSession } from '@/lib/session-timing';

export type CloudAgentInviteResult =
  | { ok: true; agentId: string }
  | { ok: false };

/**
 * StrictMode-safe cloud agent invite. Ignores stale async results after cleanup
 * and never blocks retries with a stuck ref flag.
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
      source: string,
    ): Promise<CloudAgentInviteResult> {
      const gen = ++generation;
      markSession(`invite_${source}_start`, 'H1', { source });

      const response = await inviteCloudAgent(requesterId, channelName);

      if (gen !== generation) {
        return { ok: false };
      }

      markSession(`invite_${source}_done`, 'H1', {
        source,
        ok: Boolean(response?.agent_id),
      });

      if (!response?.agent_id) {
        return { ok: false };
      }

      return { ok: true, agentId: response.agent_id };
    },
  };
}
