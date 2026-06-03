'use client';

import { useEffect, useState } from 'react';
import type { ToolBranchEvent } from '@/lib/session-tool-events';
import { formatBranchLabel } from '@/lib/tool-branch-display';

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
    const fade = window.setTimeout(() => setVisible(false), 5_000);
    const remove = window.setTimeout(() => onDismiss(event.id), 5_600);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(remove);
    };
  }, [event.id, onDismiss]);

  const headline =
    event.label && !/tool activated/i.test(event.label)
      ? event.label
      : formatBranchLabel(event.branch);

  const isSuccess = /complete|sent successfully|tool called/i.test(headline);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none flex w-full max-w-[22rem] items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-xl transition-all duration-500 ease-out sm:max-w-sm ${
        isSuccess
          ? 'border-emerald-500/35 bg-emerald-950/20 shadow-emerald-950/20'
          : 'border-border/60 bg-background/90 shadow-black/25'
      } ${visible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/80 text-base"
        aria-hidden
      >
        {event.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[10px] font-medium uppercase tracking-[0.2em] ${
            isSuccess ? 'text-emerald-400/90' : 'text-muted-foreground'
          }`}
        >
          {isSuccess ? 'Workflow complete' : 'Workflow'}
        </p>
        <p className="truncate text-sm font-medium text-foreground">
          {headline}
        </p>
      </div>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          isSuccess ? 'bg-emerald-400' : 'bg-primary/80'
        }`}
        aria-hidden
      />
    </div>
  );
}

export function WorkflowToolBannerStack({
  events,
  onDismiss,
}: WorkflowToolBannerProps) {
  if (events.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex flex-col items-center gap-2 px-4">
      {events.map((event) => (
        <BannerCard key={event.id} event={event} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
