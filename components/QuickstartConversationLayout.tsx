'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

type QuickstartConversationLayoutProps = {
  statusPanel: ReactNode;
  pipelineMetrics: ReactNode;
  transcriptPanel: ReactNode;
  visualizer: ReactNode;
  controls: ReactNode;
  onEndConversation: () => void;
};

export function QuickstartConversationLayout({
  statusPanel,
  pipelineMetrics,
  transcriptPanel,
  visualizer,
  controls,
  onEndConversation,
}: QuickstartConversationLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col text-left">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:gap-4 md:py-4 lg:h-[76px] lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-0">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/agora-logo-mark.svg"
            alt="Agora"
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 object-contain md:h-10 md:w-10"
          />
          <div className="flex min-w-0 flex-col justify-center gap-1">
            <span className="truncate text-base font-semibold leading-none tracking-[-0.025em] text-foreground md:text-lg">
              Agora Conversational AI
            </span>
            <div className="hidden min-w-0 sm:block">{pipelineMetrics}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:pr-1">
          {statusPanel}
          <Button
            variant="destructive"
            size="sm"
            className="h-8 rounded-md border border-destructive bg-transparent px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
            onClick={onEndConversation}
            aria-label="End conversation with AI agent"
            title="End conversation"
          >
            End Conversation
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:gap-4 md:px-6 md:pb-4 md:pt-4 lg:flex-row lg:gap-0 lg:overflow-hidden">
        {/* Mobile: transcript first so chat is visible without scrolling past the orb */}
        <aside className="order-1 flex min-h-[34dvh] w-full shrink-0 flex-col lg:order-1 lg:h-full lg:min-h-0 lg:w-[26rem]">
          {transcriptPanel}
        </aside>

        <main className="order-2 flex min-h-[min(42dvh,22rem)] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0 lg:border-l lg:border-border/80 lg:pl-6">
          <div className="flex min-h-0 flex-1 flex-col pb-2 pt-2 md:pb-6 md:pt-3">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {visualizer}
            </div>
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)] pt-3 md:pt-4">
              {controls}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
