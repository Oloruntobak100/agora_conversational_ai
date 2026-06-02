import type { RTMClient } from 'agora-rtm';
import { isMobileBrowser } from '@/lib/device';
import { markSession } from '@/lib/session-timing';
import { setupRtmClient } from '@/lib/setup-rtm-client';

/**
 * RTM is required for transcript + AgoraVoiceAI (official quickstart pattern).
 * Retries transient failures; throws if all attempts fail so the UI never
 * enters a call without RTM.
 */
export async function bootstrapRtmClient(options: {
  appId: string;
  uid: string;
  token: string;
  channel: string;
}): Promise<RTMClient> {
  const mobile = isMobileBrowser();
  markSession('rtm_bootstrap_start', 'H4', { mobile });
  const rtm = await setupRtmClient({
    ...options,
    maxAttempts: mobile ? 8 : 5,
  });
  markSession('rtm_bootstrap_done', 'H4', { mobile });
  return rtm;
}
