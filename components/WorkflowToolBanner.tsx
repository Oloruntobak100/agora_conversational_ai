'use client';

import { useEffect, useState } from 'react';
import type { ToolBranchEvent } from '@/lib/session-tool-events';

type WorkflowToolBannerProps = {
  events: ToolBranchEvent[];
  onDismiss: (id: string) => void;
};

function BannerCard({
  event,
  onDismiss,
}: {
  event: ToolBranchEvent;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fade = window.setTimeout(() => setVisible(false), 5_500);
    const remove = window.setTimeout(() => onDismiss(event.id), 6_200);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, [event.id, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/90 via-card/95 to-card/90 px-4 py-3 shadow-lg shadow-emerald-950/30 backdrop-blur-md transition-all duration-500 ease-out ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-2 opacity-0'
      }`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl ring-1 ring-emerald-400/30"
        aria-hidden
      >
        {event.icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-400/90">
          Tool activated
        </p>
        <p className="text-sm font-semibold leading-snug text-foreground">
          {event.label}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Branch · {event.branch.replace(/_/g, ' ')}
        </p>
      </div>
      <span className="relative mt-1 flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
    </div>
  );
}

export function WorkflowToolBannerStack({
  events,
  onDismiss,
}: WorkflowToolBannerProps) {
  if (events.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 z-30 flex flex-col gap-2 sm:left-4 sm:right-auto sm:max-w-md">
      {events.map((event) => (
        <BannerCard key={event.id} event={event} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
