import type { RTMClient } from 'agora-rtm';

export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

export interface ClientStartRequest {
  requester_id: string;
  channel_name: string;
}

export interface StopConversationRequest {
  agent_id: string;
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

export interface AgoraRenewalTokens {
  rtcToken: string;
  rtmToken: string;
}

export type RtmConnectionState = 'connecting' | 'ready' | 'failed';

export interface ConversationComponentProps {
  agoraData: AgoraTokenData;
  /** Required before mount — transcript and AgoraVoiceAI depend on RTM (official quickstart). */
  rtmClient: RTMClient;
  rtmConnectionState: RtmConnectionState;
  onTokenWillExpire: (uid: string) => Promise<AgoraRenewalTokens>;
  onEndConversation: () => void;
}
