'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AgoraRTC, {
  useRTCClient,
  useLocalMicrophoneTrack,
  useRemoteUsers,
  useClientEvent,
  useJoin,
  usePublish,
  useConnectionState,
  RemoteUser,
  UID,
} from 'agora-rtc-react';
import {
  AgoraVoiceAI,
  AgoraVoiceAIEvents,
  AgentState,
  MessageSalStatus,
  TranscriptHelperMode,
  type TranscriptHelperItem,
  type UserTranscription,
  type AgentTranscription,
} from 'agora-agent-client-toolkit';
import { AgentVisualizer } from 'agora-agent-uikit';
import { MicButtonWithVisualizer } from 'agora-agent-uikit/rtc';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import {
  playAgentRemoteAudio,
  resumeRtcAudioContext,
} from '@/lib/audio-playback';
import { ensureMicrophoneAccess } from '@/lib/microphone-permission';
import { setupRtmClient } from '@/lib/setup-rtm-client';
import type { RtmConnectionState } from '@/types/conversation';
import {
  getCurrentInProgressMessage,
  getVisibleMessageList,
  mapAgentVisualizerState,
  normalizeTimestampMs,
  normalizeTranscript,
} from '@/lib/conversation';
import { MicrophoneSelector } from './MicrophoneSelector';
import {
  getConversationIssueSeverity,
  type ConnectionIssue,
} from './ConversationErrorCard';
import { AgentConnectionOverlay } from './AgentConnectionOverlay';
import { ConnectionStatusPanel } from './ConnectionStatusPanel';
import { QuickstartConversationLayout } from './QuickstartConversationLayout';
import { QuickstartTranscriptPanel } from './QuickstartTranscriptPanel';
import type { QuickstartAgentMetric } from './QuickstartPipelineMetrics';
import { getAgentConnectionPhase } from '@/lib/agent-connection-phase';
import { isMobileBrowser } from '@/lib/device';
import { createCloudAgentInviteRunner } from '@/lib/run-cloud-agent-invite';
import { getRtcJoinReadyDelayMs } from '@/lib/session-bootstrap';
import { isNexoraSessionPayload } from '@/lib/nexora-session';
import {
  hasRecentUserEndIntent,
  isInternalTranscriptMessage,
} from '@/lib/conversation-end';
import { useConversationAutoEnd } from '@/hooks/use-conversation-auto-end';
import type { ConversationComponentProps } from '@/types/conversation';


// Cap the displayed issues list to avoid overwhelming the UI during a cascade of errors.
const MAX_CONNECTION_ISSUES = 6;

type AgoraRtcWithParameters = typeof AgoraRTC & {
  setParameter?: (key: string, value: unknown) => void;
};

// Payload shape for signaling-level errors forwarded by the agent over RTM.
// The `module` field identifies which backend subsystem (LLM / ASR / TTS) raised the error.
type RtmMessageErrorPayload = {
  object: 'message.error';
  module?: string;
  code?: number;
  message?: string;
  send_ts?: number;
};

// Payload shape for SAL (Session Abstraction Layer) registration status messages.
// VP_REGISTER_FAIL and VP_REGISTER_DUPLICATE indicate RTM channel subscription problems.
type RtmSalStatusPayload = {
  object: 'message.sal_status';
  status?: string;
  timestamp?: number;
};

// Type guard for RTM signaling-level error payloads (object: 'message.error').
function isRtmMessageErrorPayload(
  value: unknown,
): value is RtmMessageErrorPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { object?: unknown }).object === 'message.error'
  );
}

// Type guard for RTM SAL status payloads (object: 'message.sal_status').
function isRtmSalStatusPayload(value: unknown): value is RtmSalStatusPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { object?: unknown }).object === 'message.sal_status'
  );
}

export default function ConversationComponent({
  agoraData,
  rtmClient,
  rtmConnectionState,
  onTokenWillExpire,
  onEndConversation,
  onAgentStarted,
  onAgentInviteFailed,
  agentInviteFailed = false,
}: ConversationComponentProps) {
  const client = useRTCClient();
  const remoteUsers = useRemoteUsers();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [isConnectionDetailsOpen, setIsConnectionDetailsOpen] = useState(false);
  const [activeRtm, setActiveRtm] = useState(rtmClient);
  const [rtmState, setRtmState] = useState<RtmConnectionState>(rtmConnectionState);
  const [speakerBlocked, setSpeakerBlocked] = useState(false);
  const [micMissing, setMicMissing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [fallbackMicTrack, setFallbackMicTrack] = useState<
    Awaited<ReturnType<typeof AgoraRTC.createMicrophoneAudioTrack>> | null
  >(null);

  const agentUID =
    process.env.NEXT_PUBLIC_AGENT_UID ?? String(DEFAULT_AGENT_UID);
  const [joinedUID, setJoinedUID] = useState<UID>(0);

  // Transcript + agent state — managed with AgoraVoiceAI (see effect below).
  const [rawTranscript, setRawTranscript] = useState<
    TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>[]
  >([]);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<QuickstartAgentMetric[]>([]);
  const [connectionIssues, setConnectionIssues] = useState<ConnectionIssue[]>(
    [],
  );
  const [showConnectionStuck, setShowConnectionStuck] = useState(false);
  const connectionWaitStartedAt = useRef<number | null>(null);
  const agentConnectTimeoutMs = useMemo(
    () => (isMobileBrowser() ? 35_000 : 45_000),
    [],
  );
  const agentWatchdogMs = useMemo(
    () => (isMobileBrowser() ? 42_000 : 35_000),
    [],
  );
  const addConnectionIssue = useCallback((issue: ConnectionIssue) => {
    setConnectionIssues((prev) => {
      const isDuplicate = prev.some(
        (x) =>
          x.agentUserId === issue.agentUserId &&
          x.code === issue.code &&
          x.message === issue.message &&
          Math.abs(x.timestamp - issue.timestamp) < 1500,
      );
      if (isDuplicate) return prev;
      return [issue, ...prev].slice(0, MAX_CONNECTION_ISSUES);
    });
  }, []);

  // Auto-open details only for hard errors (avoid yellow-dot noise from transient RTM warnings).
  useEffect(() => {
    if (
      connectionIssues.some(
        (issue) => getConversationIssueSeverity(issue) === 'error',
      )
    ) {
      setIsConnectionDetailsOpen(true);
    }
  }, [connectionIssues]);

  // StrictMode guard: delay `useJoin`'s ready flag until after the fake-unmount
  // cycle completes. React StrictMode fires cleanup synchronously before any
  // setTimeout callback, so the first (fake) mount's timeout is always cancelled.
  // Only the real second mount's timeout fires, meaning useJoin joins exactly once.
  const [isReady, setIsReady] = useState(false);
  const rtcJoinRetries = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, getRtcJoinReadyDelayMs());
    return () => {
      cancelled = true;
      clearTimeout(id);
      setIsReady(false);
    };
  }, []);

  const { isConnected: joinSuccess, error: joinError } = useJoin(
    {
      appid: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
      channel: agoraData.channel,
      token: agoraData.token,
      uid: parseInt(agoraData.uid, 10),
    },
    isReady,
  );

  const connectionState = useConnectionState(client);

  // Create mic track only after the StrictMode fake-unmount cycle completes (isReady).
  // Passing `true` here creates two tracks in StrictMode — the first publishes, then
  // StrictMode cleanup closes it and the second takes over, causing a ~3s audio gap.
  // isReady uses the same setTimeout(fn,0) pattern as useJoin: StrictMode cleanup fires
  // synchronously before the timeout, so only the real second mount's timer fires.
  // Do NOT pass `isEnabled` — that ties track lifetime to mute state and breaks the Web Audio
  // graph inside MicButtonWithVisualizer. Mute uses track.setEnabled() only.
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(isReady);
  const activeMicTrack = localMicrophoneTrack ?? fallbackMicTrack;

  useEffect(() => {
    if (!isReady || !joinSuccess) {
      setMicMissing(false);
      return;
    }
    if (activeMicTrack) {
      setMicMissing(false);
      setMicError(null);
      return;
    }
    const id = window.setTimeout(() => setMicMissing(true), 2000);
    return () => window.clearTimeout(id);
  }, [isReady, joinSuccess, activeMicTrack]);

  const requestMicrophoneAgain = useCallback(async () => {
    setMicError(null);
    const mic = await ensureMicrophoneAccess();
    if (!mic.ok) {
      setMicError(mic.message);
      return;
    }
    try {
      if (fallbackMicTrack) {
        fallbackMicTrack.stop();
        fallbackMicTrack.close();
      }
      const track = await AgoraRTC.createMicrophoneAudioTrack();
      setFallbackMicTrack(track);
      setMicMissing(false);
    } catch (err) {
      console.error('Failed to create microphone track:', err);
      setMicError(
        'Could not start the microphone. Check permissions and try again.',
      );
    }
  }, [fallbackMicTrack]);

  // ENABLE_AUDIO_PTS is a module-level SDK parameter (not on the client instance).
  // It must be set before publishing audio for transcript timing to be accurate.
  useEffect(() => {
    if (!client) return;
    try {
      (AgoraRTC as AgoraRtcWithParameters).setParameter?.(
        'ENABLE_AUDIO_PTS',
        true,
      );
    } catch (error) {
      console.warn('Could not set ENABLE_AUDIO_PTS:', error);
    }
  }, [client]);

  useEffect(() => {
    setActiveRtm(rtmClient);
    setRtmState(rtmConnectionState);
  }, [rtmClient, rtmConnectionState]);

  const rtmReconnectAttempts = useRef(0);
  const agentAudioPlayAttempted = useRef(false);
  const inviteRunnerRef = useRef(createCloudAgentInviteRunner());
  const inviteStartedForChannel = useRef<string | null>(null);
  const agentWatchdogFired = useRef(false);
  const toolkitSubscribed = useRef(false);
  const sessionEndHandled = useRef(false);
  const messageListRef = useRef<
    { uid: number; text: string; createdAt?: number }[]
  >([]);

  // Retry RTM in-call when bootstrap failed (common on mobile / incognito).
  useEffect(() => {
    if (activeRtm || !joinSuccess || !isReady || rtmState !== 'failed') return;
    if (rtmReconnectAttempts.current >= 2) return;

    rtmReconnectAttempts.current += 1;
    let cancelled = false;

    (async () => {
      setRtmState('connecting');
      try {
        const rtm = await setupRtmClient({
          appId: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
          uid: agoraData.uid,
          token: agoraData.token,
          channel: agoraData.channel,
        });
        if (!cancelled) {
          setActiveRtm(rtm);
          setRtmState('ready');
        }
      } catch (err) {
        console.error('In-call RTM reconnect failed:', err);
        if (!cancelled) setRtmState('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeRtm,
    joinSuccess,
    isReady,
    rtmState,
    agoraData.uid,
    agoraData.token,
    agoraData.channel,
  ]);

  useEffect(() => {
    AgoraRTC.onAutoplayFailed = () => {
      setSpeakerBlocked(true);
    };
    return () => {
      AgoraRTC.onAutoplayFailed = undefined;
    };
  }, []);

  useEffect(() => {
    setSpeakerBlocked(false);
    setConnectionIssues([]);
    agentAudioPlayAttempted.current = false;
    inviteRunnerRef.current.cancel();
    inviteStartedForChannel.current = null;
    agentWatchdogFired.current = false;
    toolkitSubscribed.current = false;
    sessionEndHandled.current = false;
    rtmReconnectAttempts.current = 0;
    rtcJoinRetries.current = 0;
  }, [agoraData.channel]);

  // Invite when RTC + RTM are up. Required on mobile (deferred from landing); backup on desktop.
  useEffect(() => {
    if (!isReady || !joinSuccess || !activeRtm || agoraData.agentId) return;
    if (inviteStartedForChannel.current === agoraData.channel) return;
    inviteStartedForChannel.current = agoraData.channel;

    let cancelled = false;

    (async () => {
      const result = await inviteRunnerRef.current.invite(
        agoraData.uid,
        agoraData.channel,
      );
      if (cancelled) return;

      if (result.ok) {
        onAgentStarted(result.agentId);
      } else {
        inviteStartedForChannel.current = null;
        onAgentInviteFailed?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isReady,
    joinSuccess,
    activeRtm,
    agoraData.agentId,
    agoraData.uid,
    agoraData.channel,
    onAgentStarted,
    onAgentInviteFailed,
  ]);

  // Agent invited but never appears in RTC — re-invite once (slow Chrome/Edge paths).
  useEffect(() => {
    if (
      !joinSuccess ||
      !activeRtm ||
      !agoraData.agentId ||
      isAgentConnected ||
      agentInviteFailed
    ) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      if (isAgentConnected || agentWatchdogFired.current) return;
      agentWatchdogFired.current = true;

      try {
        await fetch('/api/stop-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agoraData.agentId }),
        });
      } catch {
        // continue with fresh invite
      }

      inviteRunnerRef.current.cancel();
      const result = await inviteRunnerRef.current.invite(
        agoraData.uid,
        agoraData.channel,
      );

      if (result.ok) {
        onAgentStarted(result.agentId);
      } else {
        onAgentInviteFailed?.();
      }
    }, agentWatchdogMs);

    return () => window.clearTimeout(timeoutId);
  }, [
    joinSuccess,
    activeRtm,
    isAgentConnected,
    agentInviteFailed,
    agoraData.agentId,
    agoraData.uid,
    agoraData.channel,
    agentWatchdogMs,
    onAgentStarted,
    onAgentInviteFailed,
  ]);

  const unlockAgentSpeaker = useCallback(async () => {
    const played = await playAgentRemoteAudio(remoteUsers, agentUID);
    setSpeakerBlocked(!played);
    return played;
  }, [remoteUsers, agentUID]);

  useEffect(() => {
    if (!joinSuccess || !isAgentConnected) return;
    const agent = remoteUsers.find((u) => u.uid.toString() === agentUID);
    if (!agent?.audioTrack) return;

    void unlockAgentSpeaker();
  }, [joinSuccess, isAgentConnected, remoteUsers, agentUID, unlockAgentSpeaker]);

  // Browsers (especially mobile) often block the first play(); retry until audio unlocks.
  useEffect(() => {
    if (!joinSuccess || !isAgentConnected || !speakerBlocked) return;

    const intervalId = window.setInterval(() => {
      void unlockAgentSpeaker();
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [joinSuccess, isAgentConnected, speakerBlocked, unlockAgentSpeaker]);

  // Track the auto-assigned RTC UID for token renewal and agent invite.
  useEffect(() => {
    if (joinSuccess && client) {
      const uid = client.uid;
      if (uid !== null && uid !== undefined) {
        setJoinedUID(uid);
      }
    }
  }, [joinSuccess, client]);

  // Initialize AgoraVoiceAI once the channel is joined.
  //
  // Gating on `isReady && joinSuccess` is critical for StrictMode safety:
  //   - `isReady` ensures we are past the initial fake-unmount cycle, so this
  //     effect only runs on the real mount (not the discarded fake one).
  //   - Once `isReady` is true, React does NOT double-invoke this effect for
  //     subsequent state changes (`joinSuccess` becoming true). That means
  //     AgoraVoiceAI.init() is called exactly once.
  useEffect(() => {
    if (!isReady || !joinSuccess || !activeRtm) return;

    let cancelled = false;

    (async () => {
      try {
        const ai = await AgoraVoiceAI.init({
          rtcEngine: client,
          rtmConfig: { rtmEngine: activeRtm },
          renderMode: TranscriptHelperMode.TEXT,
          enableLog: true,
        });

        if (cancelled) {
          try {
            if (AgoraVoiceAI.getInstance() === ai) {
              // Tear down only the instance created by this effect run.
              ai.unsubscribe();
              ai.destroy();
            }
          } catch {}
          return;
        }

        ai.on(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, (t) => {
          const filtered = t.filter((item) => {
            const text =
              typeof item.text === 'string' ? item.text : String(item.text ?? '');
            return !isInternalTranscriptMessage(text);
          });
          setRawTranscript([...filtered]);
        });
        // Agent state drives the visualizer, independent of RTC audio presence.
        ai.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (_, event) =>
          setAgentState(event.state),
        );
        ai.on(AgoraVoiceAIEvents.AGENT_METRICS, (_, metrics) => {
          setAgentMetrics((prev) => [...prev, metrics].slice(-8));
        });
        ai.on(AgoraVoiceAIEvents.MESSAGE_ERROR, (agentUserId, error) => {
          addConnectionIssue({
            id: `${Date.now()}-${agentUserId}-message-error-${error.code}`,
            source: 'rtm',
            agentUserId,
            code: error.code,
            message: error.message,
            timestamp: normalizeTimestampMs(error.timestamp),
          });
        });
        // SAL status: capture raw RTM messages so message.sal_status surfaces even if higher-level events don't.
        ai.on(
          AgoraVoiceAIEvents.MESSAGE_SAL_STATUS,
          (agentUserId, salStatus) => {
            if (
              salStatus.status === MessageSalStatus.VP_REGISTER_FAIL ||
              salStatus.status === MessageSalStatus.VP_REGISTER_DUPLICATE
            ) {
              addConnectionIssue({
                id: `${Date.now()}-${agentUserId}-sal-${salStatus.status}`,
                source: 'rtm',
                agentUserId,
                code: salStatus.status,
                message: `SAL status: ${salStatus.status}`,
                timestamp: normalizeTimestampMs(salStatus.timestamp),
              });
            }
          },
        );
        // Agent error: capture raw RTM messages so message.error surfaces even if higher-level events don't.
        ai.on(AgoraVoiceAIEvents.AGENT_ERROR, (agentUserId, error) => {
          addConnectionIssue({
            id: `${Date.now()}-${agentUserId}-agent-error-${error.code}`,
            source: 'agent',
            agentUserId,
            code: error.code,
            message: `${error.type}: ${error.message}`,
            timestamp: normalizeTimestampMs(error.timestamp),
          });
        });
        ai.subscribeMessage(agoraData.channel);
        toolkitSubscribed.current = true;
      } catch (error) {
        if (!cancelled) {
          console.error('[AgoraVoiceAI] init failed:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        const ai = AgoraVoiceAI.getInstance();
        if (ai) {
          ai.unsubscribe();
          ai.destroy();
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isReady,
    joinSuccess,
    activeRtm,
    agoraData.channel,
    agoraData.uid,
    agoraData.agentId,
    client,
    addConnectionIssue,
    onAgentStarted,
    onAgentInviteFailed,
  ]);

  // Raw RTM parsing is kept as a fallback for signaling-level errors and SAL status.
  useEffect(() => {
    if (!activeRtm) return;

    const handleRtmMessage = (event: {
      message: string | Uint8Array;
      publisher: string;
    }) => {
      const payloadText =
        typeof event.message === 'string'
          ? event.message
          : new TextDecoder().decode(event.message);

      let parsed: unknown;
      try {
        parsed = JSON.parse(payloadText);
      } catch {
        return;
      }

      if (isNexoraSessionPayload(parsed)) {
        if (!sessionEndHandled.current) {
          sessionEndHandled.current = true;
          window.setTimeout(() => onEndConversation(), 400);
        }
        return;
      }

      if (isRtmMessageErrorPayload(parsed)) {
        const p = parsed;
        addConnectionIssue({
          id: `${Date.now()}-${event.publisher}-rtm-msg-error-${p.code ?? 'unknown'}`,
          source: 'rtm-signaling',
          agentUserId: event.publisher,
          code: p.code ?? 'unknown',
          message: `${p.module ?? 'unknown'}: ${p.message ?? 'Unknown signaling error'}`,
          timestamp: normalizeTimestampMs(p.send_ts ?? Date.now()),
        });
        return;
      }

      if (isRtmSalStatusPayload(parsed)) {
        const p = parsed;
        if (
          p.status === 'VP_REGISTER_FAIL' ||
          p.status === 'VP_REGISTER_DUPLICATE'
        ) {
          addConnectionIssue({
            id: `${Date.now()}-${event.publisher}-rtm-sal-${p.status}`,
            source: 'rtm-signaling',
            agentUserId: event.publisher,
            code: p.status,
            message: `SAL status: ${p.status}`,
            timestamp: normalizeTimestampMs(p.timestamp ?? Date.now()),
          });
        }
      }
    };

    activeRtm.addEventListener('message', handleRtmMessage);
    return () => {
      activeRtm.removeEventListener('message', handleRtmMessage);
    };
  }, [activeRtm, addConnectionIssue, onEndConversation]);

  // The toolkit uses uid="0" for local user speech — remap to actual RTC UID
  // so the transcript panel renders user messages on the correct side.
  // Also normalize punctuation spacing for display when upstream text arrives compacted.
  const transcript = useMemo(() => {
    return normalizeTranscript(rawTranscript, String(client.uid));
  }, [rawTranscript, client.uid]);

  // Completed (END + INTERRUPTED) messages shown as history.
  // INTERRUPTED must be included — if the agent's first turn is cut off,
  // messageList stays empty and the first interrupted turn is never shown.
  const messageList = useMemo(
    () => getVisibleMessageList(transcript),
    [transcript],
  );
  messageListRef.current = messageList;

  useConversationAutoEnd({
    enabled: joinSuccess && isAgentConnected && Boolean(agoraData.agentId),
    channel: agoraData.channel,
    messageList,
    agentUid: agentUID,
    onEnd: onEndConversation,
    sessionEndHandled,
  });

  const currentInProgressMessage = useMemo(() => {
    const inProgress = getCurrentInProgressMessage(transcript);
    if (
      inProgress &&
      typeof inProgress.text === 'string' &&
      isInternalTranscriptMessage(inProgress.text)
    ) {
      return null;
    }
    return inProgress;
  }, [transcript]);

  // Publish local mic once the track exists; usePublish waits for RTC connection.
  usePublish([activeMicTrack]);

  useClientEvent(client, 'user-joined', (user) => {
    if (user.uid.toString() !== agentUID) return;

    setIsAgentConnected(true);
    agentAudioPlayAttempted.current = false;

    try {
      const ai = AgoraVoiceAI.getInstance();
      if (ai && toolkitSubscribed.current) {
        ai.subscribeMessage(agoraData.channel);
      }
    } catch {
      // Toolkit may not be initialized yet on very fast agent join.
    }

    void unlockAgentSpeaker();
  });

  useClientEvent(client, 'user-left', (user) => {
    if (user.uid.toString() !== agentUID) return;
    setIsAgentConnected(false);
    if (sessionEndHandled.current) return;
    if (!hasRecentUserEndIntent(messageListRef.current, agentUID)) return;
    sessionEndHandled.current = true;
    console.info('[auto-end] agent left after user goodbye');
    onEndConversation();
  });

  // Sync isAgentConnected with remoteUsers (covers cases where user-joined/left are missed)
  useEffect(() => {
    const isAgentInRemoteUsers = remoteUsers.some(
      (user) => user.uid.toString() === agentUID,
    );
    setIsAgentConnected(isAgentInRemoteUsers);
  }, [remoteUsers, agentUID]);

  useEffect(() => {
    if (!joinError) return;
    const rtcCode =
      typeof joinError.rtcError === 'object' &&
      joinError.rtcError &&
      'code' in joinError.rtcError
        ? String((joinError.rtcError as { code: string }).code)
        : 'JOIN_FAILED';
    addConnectionIssue({
      id: `${Date.now()}-rtc-join`,
      source: 'rtc',
      agentUserId: agentUID,
      code: rtcCode,
      message: joinError.message || 'Failed to join voice channel',
      timestamp: Date.now(),
    });
  }, [joinError, addConnectionIssue, agentUID]);

  // Mobile Chrome: recover from transient RTC join failures without a full page refresh.
  useEffect(() => {
    if (!isMobileBrowser() || !joinError || !isReady || joinSuccess) return;
    if (rtcJoinRetries.current >= 2) return;

    const retryId = window.setTimeout(async () => {
      rtcJoinRetries.current += 1;
      try {
        if (client && client.connectionState !== 'DISCONNECTED') {
          await client.leave();
        }
      } catch {
        // Continue with re-join attempt.
      }
      setIsReady(false);
      window.setTimeout(
        () => setIsReady(true),
        getRtcJoinReadyDelayMs() + 100,
      );
    }, 2_000);

    return () => window.clearTimeout(retryId);
  }, [joinError, isReady, joinSuccess, client]);

  const connectionSeverity = useMemo<'normal' | 'warning' | 'error'>(() => {
    // RTC transport problems take precedence; otherwise derive severity from captured issues.
    if (
      connectionState === 'DISCONNECTED' ||
      connectionState === 'DISCONNECTING'
    ) {
      return 'error';
    }
    if (
      connectionState === 'CONNECTING' ||
      connectionState === 'RECONNECTING'
    ) {
      return 'warning';
    }
    if (connectionIssues.length === 0) {
      return 'normal';
    }
    const hasError = connectionIssues.some(
      (issue) => getConversationIssueSeverity(issue) === 'error',
    );
    if (hasError) return 'error';
    // RTC is up: treat RTM-only warnings as healthy unless transcript never connected.
    if (connectionState === 'CONNECTED' && rtmState === 'ready') {
      return 'normal';
    }
    if (connectionState === 'CONNECTED' && isAgentConnected) {
      return 'warning';
    }
    return 'warning';
  }, [connectionState, connectionIssues, rtmState, isAgentConnected]);

  const visualizerState = useMemo(
    () =>
      mapAgentVisualizerState(agentState, isAgentConnected, connectionState),
    [agentState, isAgentConnected, connectionState],
  );

  const connectionPhase = useMemo(
    () =>
      getAgentConnectionPhase({
        joinSuccess,
        connectionState,
        rtmReady: rtmState === 'ready',
        hasAgentId: Boolean(agoraData.agentId),
        isAgentConnected,
      }),
    [
      joinSuccess,
      connectionState,
      rtmState,
      agoraData.agentId,
      isAgentConnected,
    ],
  );

  const isAgentSessionReady = connectionPhase === 'ready';

  useEffect(() => {
    if (agentInviteFailed || joinError) {
      setShowConnectionStuck(true);
      return;
    }

    if (isAgentSessionReady) {
      setShowConnectionStuck(false);
      connectionWaitStartedAt.current = null;
      return;
    }

    if (!isReady) {
      connectionWaitStartedAt.current = null;
      setShowConnectionStuck(false);
      return;
    }

    if (!connectionWaitStartedAt.current) {
      connectionWaitStartedAt.current = Date.now();
    }

    const intervalId = window.setInterval(() => {
      const started = connectionWaitStartedAt.current;
      if (!started) return;
      if (Date.now() - started >= agentConnectTimeoutMs) {
        setShowConnectionStuck(true);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [
    agentInviteFailed,
    isAgentSessionReady,
    isReady,
    joinError,
    agentConnectTimeoutMs,
  ]);

  const handleRefreshSession = useCallback(() => {
    window.location.reload();
  }, []);

  const handleOverlayInteract = useCallback(() => {
    void resumeRtcAudioContext();
    void unlockAgentSpeaker();
  }, [unlockAgentSpeaker]);

  // Subtitles can work while remote audio is still blocked — recover on speech.
  useEffect(() => {
    if (agentState === 'speaking' || agentState === 'thinking') {
      void unlockAgentSpeaker();
    }
  }, [agentState, unlockAgentSpeaker]);

  useEffect(() => {
    if (!isAgentConnected || !speakerBlocked) return;
    const last = messageList[messageList.length - 1];
    if (last && String(last.uid) === agentUID) {
      void unlockAgentSpeaker();
    }
  }, [messageList, isAgentConnected, speakerBlocked, agentUID, unlockAgentSpeaker]);

  /**
   * Mute/unmute via track.setEnabled() only — usePublish owns publish state.
   * If we also unpublish in the toggle, usePublish and the button fight each other
   * and break the MicButtonWithVisualizer Web Audio graph.
   */
  const handleMicToggle = useCallback(async () => {
    await resumeRtcAudioContext();
    void unlockAgentSpeaker();

    const next = !isEnabled;
    const track = activeMicTrack;
    if (!track) {
      setIsEnabled(next);
      return;
    }
    try {
      await track.setEnabled(next);
      setIsEnabled(next);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  }, [isEnabled, activeMicTrack, unlockAgentSpeaker]);

  const handleTokenWillExpire = useCallback(async () => {
    if (!onTokenWillExpire || !joinedUID) return;
    try {
      // RTC and RTM renew independently, but the quickstart fetches both in one request.
      const { rtcToken, rtmToken } = await onTokenWillExpire(
        joinedUID.toString(),
      );
      await client?.renewToken(rtcToken);
      if (activeRtm) {
        await activeRtm.renewToken(rtmToken);
      }
    } catch (error) {
      console.error('Failed to renew Agora token:', error);
    }
  }, [client, onTokenWillExpire, joinedUID, activeRtm]);

  useClientEvent(client, 'token-privilege-will-expire', handleTokenWillExpire);

  const handleEndConversation = useCallback(async () => {
    const tracks = [localMicrophoneTrack, fallbackMicTrack].filter(Boolean);
    for (const track of tracks) {
      if (!track) continue;
      try {
        await client?.unpublish(track);
      } catch (error) {
        console.warn('Failed to unpublish microphone track:', error);
      }

      try {
        track.stop();
        track.close();
      } catch (error) {
        console.warn('Failed to release microphone track:', error);
      }
    }

    try {
      const ai = AgoraVoiceAI.getInstance();
      if (ai) {
        ai.unsubscribe();
        ai.destroy();
      }
    } catch (error) {
      console.warn('AgoraVoiceAI teardown failed:', error);
    }

    try {
      if (activeRtm) {
        await activeRtm.unsubscribe(agoraData.channel);
        await activeRtm.logout();
      }
    } catch (error) {
      console.warn('RTM teardown failed:', error);
    }

    try {
      if (client && joinSuccess) {
        await client.leave();
      }
    } catch (error) {
      console.warn('RTC leave failed:', error);
    }

    onEndConversation();
  }, [
    client,
    joinSuccess,
    localMicrophoneTrack,
    fallbackMicTrack,
    activeRtm,
    agoraData.channel,
    onEndConversation,
  ]);

  const showSpeakerPrompt =
    isAgentSessionReady && isAgentConnected && speakerBlocked;

  return (
    <QuickstartConversationLayout
      rtmState={rtmState}
      statusPanel={
        <ConnectionStatusPanel
          connectionState={connectionState}
          connectionSeverity={connectionSeverity}
          connectionIssues={connectionIssues}
          isOpen={isConnectionDetailsOpen}
          onToggle={() => setIsConnectionDetailsOpen((open) => !open)}
        />
      }
      transcriptPanel={
        <QuickstartTranscriptPanel
          messageList={messageList}
          currentInProgressMessage={currentInProgressMessage}
          agentUID={agentUID}
        />
      }
      visualizer={
        <div
          className="relative flex h-full min-h-[20rem] w-full max-w-4xl items-center justify-center"
          role="region"
          aria-label="AI agent status visualization"
        >
          <AgentVisualizer state={visualizerState} size="lg" />
          <AgentConnectionOverlay
            phase={connectionPhase}
            showStuck={showConnectionStuck || agentInviteFailed}
            onRefresh={handleRefreshSession}
            onInteract={handleOverlayInteract}
          />
          {remoteUsers.map((user) => (
            <div key={user.uid} className="hidden">
              <RemoteUser user={user} />
            </div>
          ))}
        </div>
      }
      controls={
        <div className="flex w-full flex-col items-center gap-2">
          {micMissing && (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <button
                type="button"
                onClick={requestMicrophoneAgain}
                className="rounded-full border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive"
              >
                Allow microphone
              </button>
              {micError && (
                <p className="max-w-sm text-xs text-destructive">{micError}</p>
              )}
            </div>
          )}
          {showSpeakerPrompt && (
            <button
              type="button"
              onClick={() => void unlockAgentSpeaker()}
              className="w-full max-w-sm rounded-xl border-2 border-primary bg-primary px-5 py-3 text-base font-semibold text-black shadow-lg active:scale-[0.98]"
            >
              Tap to hear response
            </button>
          )}
        <div
          className={
            isAgentSessionReady ? '' : 'pointer-events-none opacity-40'
          }
        >
        <div
          className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-full border border-border bg-card/80 px-4 py-2 backdrop-blur-md"
          role="group"
          aria-label="Audio controls"
        >
          <div className="conversation-mic-host flex items-center justify-center">
            <MicButtonWithVisualizer
              isEnabled={isEnabled}
              setIsEnabled={setIsEnabled}
              track={activeMicTrack}
              onToggle={handleMicToggle}
              className="overflow-visible"
              aria-label={isEnabled ? 'Mute microphone' : 'Unmute microphone'}
              enabledColor="hsl(var(--primary))"
              disabledColor="hsl(var(--destructive))"
            />
          </div>
          <MicrophoneSelector localMicrophoneTrack={activeMicTrack} />
        </div>
        </div>
        </div>
      }
      onEndConversation={handleEndConversation}
    />
  );
}
