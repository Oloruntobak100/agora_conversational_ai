import type { RTMClient } from 'agora-rtm';

const RTM_RETRY_DELAYS_MS = [0, 400, 1200, 2000, 3000, 4000, 6000, 8000];

async function releaseRtmClient(
  rtm: RTMClient,
  channel: string,
): Promise<void> {
  try {
    await rtm.unsubscribe(channel);
  } catch {
    // Best-effort teardown between retries.
  }
  try {
    await rtm.logout();
  } catch {
    // Best-effort teardown between retries.
  }
}

export async function setupRtmClient(options: {
  appId: string;
  uid: string;
  token: string;
  channel: string;
  maxAttempts?: number;
}): Promise<RTMClient> {
  const { appId, uid, token, channel, maxAttempts = RTM_RETRY_DELAYS_MS.length } =
    options;

  let lastError: unknown;
  let partial: RTMClient | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = RTM_RETRY_DELAYS_MS[attempt] ?? 1200;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (partial) {
      await releaseRtmClient(partial, channel);
      partial = null;
    }

    try {
      const { default: AgoraRTM } = await import('agora-rtm');
      const rtm: RTMClient = new AgoraRTM.RTM(appId, uid);
      partial = rtm;
      await rtm.login({ token });
      await rtm.subscribe(channel);
      return rtm;
    } catch (err) {
      lastError = err;
      console.warn(`RTM setup attempt ${attempt + 1} failed:`, err);
    }
  }

  if (partial) {
    await releaseRtmClient(partial, channel);
  }

  throw lastError ?? new Error('RTM setup failed');
}
