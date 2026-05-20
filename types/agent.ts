export type SessionUiState =
  | "idle"
  | "connecting"
  | "armed"
  | "userSpeaking"
  | "agentSpeaking"
  | "error";

export interface StartSessionResponse {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  agentId: string;
  agentRtcUid: number;
  agentStatus: string;
  idleTimeoutSec: number;
  maxSessionMinutes?: number;
}

export interface JoinAgentResponse {
  agent_id: string;
  create_ts: number;
  status: string;
}

export interface AgoraJoinRequest {
  name: string;
  preset?: string;
  properties: Record<string, unknown>;
}
