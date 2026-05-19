"use client";

import { motion } from "framer-motion";

import type { SessionUiState } from "@/types/agent";

interface VoiceOrbProps {
  state: SessionUiState;
  userVolume: number;
  agentVolume: number;
  onToggle: () => void;
  disabled?: boolean;
}

export function VoiceOrb({
  state,
  userVolume,
  agentVolume,
  onToggle,
  disabled = false,
}: VoiceOrbProps) {
  const isActive =
    state === "armed" ||
    state === "userSpeaking" ||
    state === "agentSpeaking" ||
    state === "connecting";

  const scale =
    state === "userSpeaking"
      ? 1 + Math.min(userVolume * 0.35, 0.18)
      : state === "agentSpeaking"
        ? 1 + Math.min(agentVolume * 0.2, 0.12)
        : 1;

  const ringOpacity = state === "agentSpeaking" ? 0.15 + agentVolume * 0.5 : 0;

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={disabled || state === "connecting"}
      aria-label={isActive ? "End voice session" : "Start voice session"}
      className="relative flex h-[min(52vw,13rem)] w-[min(52vw,13rem)] min-h-[11rem] min-w-[11rem] max-h-56 max-w-56 items-center justify-center rounded-full touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:h-52 sm:w-52 sm:min-h-0 sm:min-w-0"
      animate={{ scale }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      {state === "agentSpeaking" && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="pointer-events-none absolute inset-0 rounded-full border border-violet-300"
              initial={{ scale: 1, opacity: ringOpacity }}
              animate={{
                scale: 1.35 + i * 0.22 + agentVolume * 0.25,
                opacity: [ringOpacity, 0],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: i * 0.35,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}

      <motion.span
        className="absolute inset-[10%] rounded-full bg-gradient-to-br from-violet-100 via-white to-indigo-100 shadow-inner sm:inset-3"
        animate={
          state === "armed" || state === "userSpeaking"
            ? { opacity: [0.85, 1, 0.85] }
            : { opacity: 1 }
        }
        transition={
          state === "armed" || state === "userSpeaking"
            ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      />

      <span
        className={`relative z-10 flex h-[58%] w-[58%] min-h-[5.5rem] min-w-[5.5rem] items-center justify-center rounded-full border-2 transition-colors sm:h-28 sm:w-28 sm:min-h-0 sm:min-w-0 ${
          isActive
            ? "border-violet-400 bg-violet-50 text-violet-600"
            : "border-neutral-200 bg-white text-neutral-400"
        }`}
      >
        {state === "connecting" ? (
          <motion.span
            className="h-10 w-10 rounded-full border-2 border-violet-300 border-t-violet-600 sm:h-11 sm:w-11"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        ) : (
          <MicIcon active={isActive} />
        )}
      </span>
    </motion.button>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-11 w-11 sm:h-12 sm:w-12 ${active ? "text-violet-600" : "text-neutral-400"}`}
      aria-hidden
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}
