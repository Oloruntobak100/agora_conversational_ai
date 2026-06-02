import type { RTMClient } from 'agora-rtm';
import { isMobileBrowser } from '@/lib/device';
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
  return setupRtmClient({
    ...options,
    maxAttempts: isMobileBrowser() ? 8 : 5,
  });
}
