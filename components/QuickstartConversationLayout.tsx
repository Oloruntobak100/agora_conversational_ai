'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { RtmConnectionState } from '@/types/conversation';

type QuickstartConversationLayoutProps = {
  statusPanel: ReactNode;
  pipelineMetrics: ReactNode;
  transcriptPanel: ReactNode;
  visualizer: ReactNode;
  controls: ReactNode;
  rtmState?: RtmConnectionState;
  onEndConversation: () => void;
};

export function QuickstartConversationLayout({
  statusPanel,
  pipelineMetrics,
  transcriptPanel,
  visualizer,
  controls,
  rtmState,
  onEndConversation,
}: QuickstartConversationLayoutProps) {
  return (
    <div className="flex h-dvh min-h-0 flex-1 flex-col text-left">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 sm:py-3 md:gap-4 md:py-4 lg:h-[76px] lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-0">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Image
            src="/agora-logo-mark.svg"
            alt="Agora"
            width={40}
            height={40}
            className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9 md:h-10 md:w-10"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <span className="truncate text-sm font-semibold leading-none tracking-[-0.025em] text-foreground sm:text-base md:text-lg">
              Agora Conversational AI
            </span>
            <div className="min-w-0 overflow-x-auto sm:block">{pipelineMetrics}</div>
            {rtmState === 'failed' && (
              <span className="text-[11px] text-amber-400/90">
                Transcript reconnecting…
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end md:pr-1">
          {statusPanel}
          <Button
            variant="destructive"
            size="sm"
            className="h-9 shrink-0 rounded-md border border-destructive bg-transparent px-3 text-xs font-medium text-destructive hover:bg-destructive/10 sm:h-8"
            onClick={onEndConversation}
            aria-label="End conversation with AI agent"
            title="End conversation"
          >
            End Conversation
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:gap-3 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-3 md:gap-4 md:px-6 md:pb-4 md:pt-4 lg:flex-row lg:gap-0">
        {/* Mobile: transcript first so chat is visible without scrolling past the orb */}
        <aside className="order-1 flex h-[min(38dvh,16rem)] min-h-[10rem] w-full shrink-0 flex-col sm:h-[min(40dvh,18rem)] lg:order-1 lg:h-full lg:min-h-0 lg:max-h-none lg:w-[26rem]">
          {transcriptPanel}
        </aside>

        <main className="order-2 flex min-h-0 min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0 lg:border-l lg:border-border/80 lg:pl-6">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center py-1 sm:py-2">
              {visualizer}
            </div>
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)] pt-2 sm:pt-3 md:pt-4">
              {controls}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
