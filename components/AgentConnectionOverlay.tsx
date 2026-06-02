'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AgentConnectionPhase =
  | 'rtc-connecting'
  | 'session-setup'
  | 'waiting-for-agent'
  | 'ready';

type AgentConnectionOverlayProps = {
  phase: AgentConnectionPhase;
  showStuck: boolean;
  onRefresh: () => void;
  /** User gesture during wait — unlocks audio on strict mobile browsers. */
  onInteract?: () => void;
};

const MESSAGES: Record<AgentConnectionPhase, string> = {
  'rtc-connecting': 'Connecting to voice channel…',
  'session-setup': 'Preparing secure session…',
  'waiting-for-agent': 'Waiting for agent to connect…',
  ready: '',
};

export function AgentConnectionOverlay({
  phase,
  showStuck,
  onRefresh,
  onInteract,
}: AgentConnectionOverlayProps) {
  if (phase === 'ready' && !showStuck) return null;

  const message = showStuck
    ? 'Agent is taking longer than expected.'
    : MESSAGES[phase];

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-2xl bg-background/75 px-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy={!showStuck}
      onClick={!showStuck ? onInteract : undefined}
      onKeyDown={
        !showStuck && onInteract
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onInteract();
            }
          : undefined
      }
      tabIndex={!showStuck && onInteract ? 0 : undefined}
    >
      {!showStuck && (
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
          <Loader2
            className="relative h-8 w-8 animate-spin text-primary"
            aria-hidden
          />
        </div>
      )}

      <div className="max-w-xs text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {!showStuck && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {onInteract
              ? 'Tap anywhere here if audio is silent after connecting'
              : 'This usually takes a few seconds'}
          </p>
        )}
        {showStuck && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Check your connection, then refresh to try again.
          </p>
        )}
      </div>

      {showStuck && (
        <Button
          type="button"
          onClick={onRefresh}
          className="h-10 gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh session
        </Button>
      )}
    </div>
  );
}
