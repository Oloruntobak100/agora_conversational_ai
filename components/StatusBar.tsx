"use client";

import type { SessionUiState } from "@/types/agent";

interface StatusBarProps {
  state: SessionUiState;
  message: string;
  errorMessage: string | null;
  isActive: boolean;
  onEnd?: () => void;
}

export function StatusBar({
  state,
  message,
  errorMessage,
  isActive,
  onEnd,
}: StatusBarProps) {
  return (
    <div className="flex w-full flex-col items-center gap-4 px-3 text-center sm:max-w-md sm:px-6" role="status">
      <p
        className="text-base font-medium leading-snug tracking-tight text-neutral-800 sm:text-lg"
        aria-live="polite"
        aria-atomic="true"
      >
        {errorMessage ?? message}
      </p>

      {errorMessage && state === "error" && (
        <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
          Check microphone permissions and your Agora configuration, then try
          again.
        </p>
      )}

      {isActive && onEnd && (
        <button
          type="button"
          onClick={onEnd}
          className="mt-1 flex min-h-12 w-full max-w-xs items-center justify-center rounded-full border border-neutral-200 bg-white px-6 py-3 text-base font-medium text-neutral-700 shadow-sm transition active:scale-[0.98] active:bg-neutral-50 sm:mt-2 sm:min-h-11 sm:w-auto sm:py-2.5 sm:text-sm"
        >
          End session
        </button>
      )}

      {state === "idle" && !errorMessage && (
        <p className="text-sm leading-relaxed text-neutral-400">
          Allow microphone access when prompted
        </p>
      )}
    </div>
  );
}
