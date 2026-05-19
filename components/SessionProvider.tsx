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

import { VOLUME_POLL_MS, VOLUME_THRESHOLD } from "@/lib/constants";
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
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  toggleSession: () => Promise<void>;
}

const VoiceSessionContext = createContext<VoiceSessionContextValue | null>(null);

function getStatusMessage(state: SessionUiState): string {
  switch (state) {
    case "idle":
      return "Tap the microphone to start";
    case "connecting":
      return "Connecting to your assistant…";
    case "armed":
      return "I'm listening — speak anytime";
    case "userSpeaking":
      return "Listening to you…";
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

  const clientRef = useRef<RtcClient | null>(null);
  const localUidRef = useRef<number | null>(null);
  const micTrackRef = useRef<MicTrack | null>(null);
  const sessionRef = useRef<StartSessionResponse | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteVolumeRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
  }, []);

  const stopSession = useCallback(async () => {
    clearTimers();
    setUserVolume(0);
    setAgentVolume(0);
    remoteVolumeRef.current = 0;

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
        maxSessionMinutes?: number;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start session");
      }

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;
      localUidRef.current = data.uid;

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        await client.subscribe(user, mediaType);
        user.audioTrack?.play();
      });

      client.on("user-unpublished", () => {
        remoteVolumeRef.current = 0;
      });

      await client.join(appId, data.channel, data.token, data.uid);

      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes) => {
        const localUid = localUidRef.current;
        const remote = volumes.find((v) => v.uid !== localUid);
        remoteVolumeRef.current = remote
          ? Math.min(1, remote.level / 100)
          : 0;
      });

      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        ANS: true,
        AEC: true,
      });
      micTrackRef.current = micTrack;
      await client.publish([micTrack]);

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
  }, [state, startVolumePolling, stopSession]);

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

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      void stopSessionRef.current();
    };
  }, []);

  const isActive =
    state === "connecting" ||
    state === "armed" ||
    state === "userSpeaking" ||
    state === "agentSpeaking";

  const value: VoiceSessionContextValue = {
    state,
    statusMessage: getStatusMessage(state),
    errorMessage,
    userVolume,
    agentVolume,
    isActive,
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
