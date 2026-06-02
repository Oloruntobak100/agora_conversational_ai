'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { RtmConnectionState } from '@/types/conversation';

type QuickstartConversationLayoutProps = {
  statusPanel: ReactNode;
  transcriptPanel: ReactNode;
  visualizer: ReactNode;
  controls: ReactNode;
  rtmState?: RtmConnectionState;
  onEndConversation: () => void;
};

export function QuickstartConversationLayout({
  statusPanel,
  transcriptPanel,
  visualizer,
  controls,
  rtmState,
  onEndConversation,
}: QuickstartConversationLayoutProps) {
  return (
    <div className="flex h-dvh min-h-0 flex-1 flex-col text-left">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Nexora
          </span>
          {rtmState === 'failed' && (
            <span className="text-[11px] text-amber-400/90">
              Reconnecting transcript…
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {statusPanel}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-4 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onEndConversation}
            aria-label="End conversation"
          >
            End
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:gap-3 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-3 md:gap-4 md:px-5 md:pb-4 md:pt-4 lg:flex-row lg:gap-0">
        <aside className="order-1 flex h-[min(38dvh,16rem)] min-h-[10rem] w-full shrink-0 flex-col sm:h-[min(40dvh,18rem)] lg:order-1 lg:h-full lg:min-h-0 lg:max-h-none lg:w-[26rem]">
          {transcriptPanel}
        </aside>

        <main className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0 lg:border-l lg:border-border/80 lg:pl-5">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center py-1 sm:py-2">
              {visualizer}
            </div>
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)] pt-2 sm:pt-3">
              {controls}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
