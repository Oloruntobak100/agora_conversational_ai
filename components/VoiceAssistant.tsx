"use client";

import { SessionProvider, useVoiceSession } from "@/components/SessionProvider";
import { StatusBar } from "@/components/StatusBar";
import { VoiceOrb } from "@/components/VoiceOrb";

function VoiceAssistantInner() {
  const {
    state,
    statusMessage,
    errorMessage,
    userVolume,
    agentVolume,
    isActive,
    toggleSession,
    stopSession,
  } = useVoiceSession();

  return (
    <main className="safe-area-shell flex min-h-dvh w-full max-w-lg flex-col touch-manipulation mx-auto">
      <header className="shrink-0 pt-2 text-center sm:pt-4">
        <h1 className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-400 sm:text-sm">
          Voice Assistant
        </h1>
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-2 py-4 sm:gap-10">
        <VoiceOrb
          state={state}
          userVolume={userVolume}
          agentVolume={agentVolume}
          onToggle={() => void toggleSession()}
          disabled={false}
        />
        <StatusBar
          state={state}
          message={statusMessage}
          errorMessage={errorMessage}
          isActive={isActive}
          onEnd={() => void stopSession()}
        />
      </section>

      <footer className="shrink-0 pb-2 text-center sm:pb-4">
        <p className="text-[11px] text-neutral-300 sm:text-xs">
          Tap the microphone to start · Works best with headphones on mobile
        </p>
      </footer>
    </main>
  );
}

export function VoiceAssistant() {
  return (
    <SessionProvider>
      <VoiceAssistantInner />
    </SessionProvider>
  );
}
