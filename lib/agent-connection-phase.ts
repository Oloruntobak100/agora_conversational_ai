export type AgentConnectionPhase =
  | 'rtc-connecting'
  | 'session-setup'
  | 'waiting-for-agent'
  | 'ready';

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

  // useJoin is authoritative once the channel join completes. connection-state-change
  // can lag or never fire (Chrome) and may report transient DISCONNECTING while joined.
  if (!joinSuccess) {
    return 'rtc-connecting';
  }

  if (connectionState === 'DISCONNECTED') {
    return 'rtc-connecting';
  }

  if (!rtmReady || !hasAgentId) {
    return 'session-setup';
  }

  return 'waiting-for-agent';
}
