export type AgentConnectionPhase =
  | 'rtc-connecting'
  | 'session-setup'
  | 'waiting-for-agent'
  | 'ready';

const RTC_CONNECTING = new Set([
  'CONNECTING',
  'RECONNECTING',
  'DISCONNECTING',
]);

export function getAgentConnectionPhase(options: {
  joinSuccess: boolean;
  connectionState: string;
  rtmReady: boolean;
  hasAgentId: boolean;
  isAgentConnected: boolean;
}): AgentConnectionPhase {
  const { joinSuccess, connectionState, rtmReady, hasAgentId, isAgentConnected } =
    options;

  if (isAgentConnected && joinSuccess && rtmReady) {
    return 'ready';
  }

  if (!joinSuccess || RTC_CONNECTING.has(connectionState)) {
    return 'rtc-connecting';
  }

  if (!rtmReady || !hasAgentId) {
    return 'session-setup';
  }

  return 'waiting-for-agent';
}
