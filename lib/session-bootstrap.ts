import { isMobileBrowser } from '@/lib/device';

/** Delay before enabling RTC join/mic on mobile (provider mount + StrictMode settle). */
export function getRtcJoinReadyDelayMs(): number {
  return isMobileBrowser() ? 250 : 0;
}

/** Pause after stopping a prior cloud agent so Agora can release the channel. */
export function getPriorAgentStopSettleMs(): number {
  return isMobileBrowser() ? 900 : 300;
}

/** Mobile Chrome: invite the agent only after the user has joined RTC. */
export function shouldDeferAgentInviteToInCall(): boolean {
  return isMobileBrowser();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
