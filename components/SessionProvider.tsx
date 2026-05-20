"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  subscribeAllRemoteAudio,
  subscribeAndPlayRemoteAudio,
} from "@/lib/agora/rtc-client";
import {
  AGENT_AUDIO_POLL_MS,
  AGENT_JOIN_TIMEOUT_MS,
  VOLUME_POLL_MS,
  VOLUME_THRESHOLD,
} from "@/lib/constants";
import type { SessionUiState, StartSessionResponse } from "@/types/agent";

type AgoraModule = typeof import("agora-rtc-sdk-ng");
type RtcClient = ReturnType<AgoraModule["default"]["createClient"]>;
type MicTrack = Awaited<
  ReturnType<AgoraModule["default"]["createMicrophoneAudioTrack"]>
>;

interface VoiceSessionContextValue {
  state: SessionUiState;
  statusMessage: string;
  errorMessage: string | null;
  userVolume: number;
  agentVolume: number;
  isActive: boolean;
  agentConnected: boolean;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  toggleSession: () => Promise<void>;
}

const VoiceSessionContext = createContext<VoiceSessionContextValue | null>(null);

function getStatusMessage(
  state: SessionUiState,
  agentConnected: boolean
): string {
  switch (state) {
    case "idle":
      return "Tap the microphone to start";
    case "connecting":
      return "Starting session…";
    case "armed":
      return agentConnected
        ? "I'm listening — speak, then pause for a reply"
        : "Listen for your assistant — greeting coming…";
    case "userSpeaking":
      return "Hearing you… pause when finished";
    case "agentSpeaking":
      return "Assistant is speaking…";
    case "error":
      return "Something went wrong";
    default:
      return "";
  }
}

function measureTrackVolume(track: MicTrack | null): number {
  if (!track) return 0;
  try {
    const level = track.getVolumeLevel?.();
    if (typeof level === "number") return level;
  } catch {
    // fall through
  }
  return 0;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionUiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userVolume, setUserVolume] = useState(0);
  const [agentVolume, setAgentVolume] = useState(0);
  const [agentConnected, setAgentConnected] = useState(false);

  const clientRef = useRef<RtcClient | null>(null);
  const localUidRef = useRef<number | null>(null);
  const micTrackRef = useRef<MicTrack | null>(null);
  const sessionRef = useRef<StartSessionResponse | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteVolumeRef = useRef(0);
  const agentConnectedRef = useRef(false);

  const markAgentConnected = useCallback(() => {
    if (agentConnectedRef.current) return;
    agentConnectedRef.current = true;
    setAgentConnected(true);
    if (agentWaitTimerRef.current) {
      clearTimeout(agentWaitTimerRef.current);
      agentWaitTimerRef.current = null;
    }
    if (agentPollTimerRef.current) {
      clearInterval(agentPollTimerRef.current);
      agentPollTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (agentWaitTimerRef.current) {
      clearTimeout(agentWaitTimerRef.current);
      agentWaitTimerRef.current = null;
    }
    if (agentPollTimerRef.current) {
      clearInterval(agentPollTimerRef.current);
      agentPollTimerRef.current = null;
    }
  }, []);

  const trySubscribeAgentAudio = useCallback(async () => {
    const client = clientRef.current;
    const localUid = localUidRef.current;
    if (!client || localUid == null) return false;

    const count = await subscribeAllRemoteAudio(client, localUid);
    if (count > 0) {
      markAgentConnected();
      return true;
    }
    return false;
  }, [markAgentConnected]);

  const stopSession = useCallback(async () => {
    clearTimers();
    setUserVolume(0);
    setAgentVolume(0);
    remoteVolumeRef.current = 0;
    agentConnectedRef.current = false;
    setAgentConnected(false);

    const session = sessionRef.current;
    sessionRef.current = null;

    if (session?.agentId) {
      try {
        await fetch("/api/session/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: session.agentId }),
        });
      } catch (e) {
        console.warn("Failed to stop agent on server", e);
      }
    }

    const mic = micTrackRef.current;
    if (mic) {
      mic.stop();
      mic.close();
      micTrackRef.current = null;
    }

    const client = clientRef.current;
    if (client) {
      try {
        await client.leave();
      } catch {
        // ignore leave errors
      }
      client.removeAllListeners();
      clientRef.current = null;
    }

    localUidRef.current = null;
    setState("idle");
  }, [clearTimers]);

  const startVolumePolling = useCallback(() => {
    volumeTimerRef.current = setInterval(() => {
      const micLevel = measureTrackVolume(micTrackRef.current);
      const remoteLevel = remoteVolumeRef.current;
      setUserVolume(micLevel);
      setAgentVolume(remoteLevel);

      setState((prev) => {
        if (prev === "connecting" || prev === "error" || prev === "idle") {
          return prev;
        }
        if (remoteLevel > VOLUME_THRESHOLD) return "agentSpeaking";
        if (micLevel > VOLUME_THRESHOLD) return "userSpeaking";
        return "armed";
      });
    }, VOLUME_POLL_MS);
  }, []);

  const startSession = useCallback(async () => {
    if (state === "connecting") return;

    if (!navigator.onLine) {
      setErrorMessage(
        "No internet connection. Connect to Wi‑Fi or mobile data and try again."
      );
      setState("error");
      return;
    }

    setErrorMessage(null);
    setState("connecting");

    try {
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        throw new Error("NEXT_PUBLIC_AGORA_APP_ID is not configured");
      }

      const res = await fetch("/api/session/start", { method: "POST" });
      const data = (await res.json()) as StartSessionResponse & {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start session");
      }

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

      AgoraRTC.onAutoplayFailed = () => {
        setErrorMessage(
          "Speaker blocked by browser. Tap the microphone again to enable audio."
        );
      };

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;
      localUidRef.current = data.uid;

      const handleRemoteUser = async (
        user: Parameters<typeof subscribeAndPlayRemoteAudio>[1]
      ) => {
        const track = await subscribeAndPlayRemoteAudio(
          client,
          user,
          data.uid
        );
        if (track) {
          markAgentConnected();
        }
      };

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        await handleRemoteUser(user);
      });

      client.on("user-unpublished", (user) => {
        if (Number(user.uid) !== Number(localUidRef.current)) {
          remoteVolumeRef.current = 0;
        }
      });

      await client.join(appId, data.channel, data.token, data.uid);

      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes) => {
        const localUid = localUidRef.current;
        const remote = volumes.find(
          (v) => Number(v.uid) !== Number(localUid)
        );
        remoteVolumeRef.current = remote
          ? Math.min(1, remote.level / 100)
          : 0;
        if (remote && remote.level > 0) {
          markAgentConnected();
        }
      });

      // Join channel first, then publish mic so the agent can greet you.
      await trySubscribeAgentAudio();

      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        ANS: true,
        AEC: true,
      });
      micTrackRef.current = micTrack;
      await client.publish([micTrack]);

      await trySubscribeAgentAudio();

      agentPollTimerRef.current = setInterval(() => {
        void trySubscribeAgentAudio();
      }, AGENT_AUDIO_POLL_MS);

      agentWaitTimerRef.current = setTimeout(() => {
        if (!agentConnectedRef.current) {
          setErrorMessage(
            "Could not hear the assistant. Turn volume up, allow speaker audio, and try again in Chrome or Safari."
          );
          setState("error");
          void stopSession();
        }
      }, AGENT_JOIN_TIMEOUT_MS);

      sessionRef.current = data;
      startVolumePolling();

      const maxMinutes = data.maxSessionMinutes ?? 30;
      maxTimerRef.current = setTimeout(
        () => {
          void stopSession();
        },
        maxMinutes * 60 * 1000
      );

      setState("armed");
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof Error ? err.message : "Could not start voice session"
      );
      setState("error");
      await stopSession();
    }
  }, [
    state,
    startVolumePolling,
    stopSession,
    markAgentConnected,
    trySubscribeAgentAudio,
  ]);

  const toggleSession = useCallback(async () => {
    if (state === "idle" || state === "error") {
      await startSession();
    } else {
      await stopSession();
    }
  }, [state, startSession, stopSession]);

  const stopSessionRef = useRef(stopSession);
  stopSessionRef.current = stopSession;

  useEffect(() => {
    const handleUnload = () => {
      const agentId = sessionRef.current?.agentId;
      if (!agentId) return;
      const blob = new Blob([JSON.stringify({ agentId })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/session/stop", blob);
    };

    const handleOffline = () => {
      if (sessionRef.current) {
        setErrorMessage(
          "Connection lost. End the session and try again when back online."
        );
        setState("error");
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isActive =
    state === "connecting" ||
    state === "armed" ||
    state === "userSpeaking" ||
    state === "agentSpeaking";

  const value: VoiceSessionContextValue = {
    state,
    statusMessage: getStatusMessage(state, agentConnected),
    errorMessage,
    userVolume,
    agentVolume,
    isActive,
    agentConnected,
    startSession,
    stopSession,
    toggleSession,
  };

  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
    </VoiceSessionContext.Provider>
  );
}

export function useVoiceSession(): VoiceSessionContextValue {
  const ctx = useContext(VoiceSessionContext);
  if (!ctx) {
    throw new Error("useVoiceSession must be used within SessionProvider");
  }
  return ctx;
}
