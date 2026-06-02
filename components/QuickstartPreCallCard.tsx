'use client';

import { Loader2 } from 'lucide-react';

type QuickstartPreCallCardProps = {
  isLoading: boolean;
  error: string | null;
  onStartConversation: () => void;
};

export function QuickstartPreCallCard({
  isLoading,
  error,
  onStartConversation,
}: QuickstartPreCallCardProps) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6 animate-fade-up">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Nexora
      </p>

      <button
        type="button"
        onClick={onStartConversation}
        disabled={isLoading}
        className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[0_0_40px_-8px_hsl(var(--primary)/0.55)] transition-all hover:scale-[1.02] hover:shadow-[0_0_48px_-6px_hsl(var(--primary)/0.65)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        aria-label={
          isLoading ? 'Starting conversation' : 'Start conversation'
        }
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Connecting…
          </span>
        ) : (
          'Start conversation'
        )}
      </button>

      {error && (
        <p className="max-w-xs text-center text-xs leading-relaxed text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
