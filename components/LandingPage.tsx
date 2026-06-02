'use client';

import { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { RTMClient } from 'agora-rtm';
import type { AgoraTokenData, AgoraRenewalTokens } from '../types/conversation';
import { inviteCloudAgent } from '@/lib/invite-cloud-agent';
import { ErrorBoundary } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { resumeRtcAudioContext } from '@/lib/audio-playback';
import { bootstrapRtmClient } from '@/lib/bootstrap-rtm-client';
import { ensureMicrophoneAccess } from '@/lib/microphone-permission';
import { shouldDeferAgentInviteToInCall } from '@/lib/session-bootstrap';
import {
  clearStoredAgentId,
  getStoredAgentId,
  setStoredAgentId,
  stopStoredAgentIfAny,
} from '@/lib/session-agent-storage';
import type { RtmConnectionState } from '@/types/conversation';
import { QuickstartPreCallCard } from './QuickstartPreCallCard';

// Dynamically import the ConversationComponent with ssr disabled
const ConversationComponent = dynamic(() => import('./ConversationComponent'), {
  ssr: false,
});

// Dynamically import AgoraRTCProvider (browser-only).
const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } =
      await import('agora-rtc-react');
    const { useEffect } = await import('react');
    return {
      default: function AgoraProviders({
        children,
      }: {
        children: React.ReactNode;
      }) {
        const clientRef = useRef<ReturnType<
          typeof AgoraRTC.createClient
        > | null>(null);
        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({
            mode: 'rtc',
            codec: 'vp8',
          });
        }

        useEffect(() => {
          const rtc = clientRef.current;
          return () => {
            if (!rtc) return;
            void rtc.leave().catch(() => {});
          };
        }, []);

        return (
          <AgoraRTCProvider client={clientRef.current}>
            {children}
          </AgoraRTCProvider>
        );
      },
    };
  },
  { ssr: false },
);

export default function LandingPage() {
  const [showConversation, setShowConversation] = useState(false);

  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
    void import('./ConversationComponent');

    const onPageHide = () => {
      const agentId = getStoredAgentId();
      if (!agentId) return;
      const body = JSON.stringify({ agent_id: agentId });
      navigator.sendBeacon(
        '/api/stop-conversation',
        new Blob([body], { type: 'application/json' }),
      );
      clearStoredAgentId();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [rtmClient, setRtmClient] = useState<RTMClient | null>(null);
  const [rtmConnectionState, setRtmConnectionState] =
    useState<RtmConnectionState>('connecting');
  const [agentJoinError, setAgentJoinError] = useState(false);

  const handleStartConversation = async () => {
    setIsLoading(true);
    setError(null);
    setAgentJoinError(false);

    const mic = await ensureMicrophoneAccess();
    if (!mic.ok) {
      setError(mic.message);
      setIsLoading(false);
      return;
    }

    await resumeRtcAudioContext();
    await stopStoredAgentIfAny();

    try {
      const agoraResponse = await fetch('/api/generate-agora-token');
      const responseData = await agoraResponse.json();

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(responseData)}`,
        );
      }

      setRtmConnectionState('connecting');
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;

      // Desktop: invite + RTM in parallel. Mobile Chrome: RTM first, invite after RTC join
      // (agent invited into an empty channel before the user joins is a common mobile failure).
      const deferInvite = shouldDeferAgentInviteToInCall();
      const [agentData, rtm] = await Promise.all([
        deferInvite
          ? Promise.resolve(null)
          : inviteCloudAgent(responseData.uid, responseData.channel).catch((err) => {
              console.error('Failed to start conversation with agent:', err);
              setAgentJoinError(true);
              return null;
            }),

        bootstrapRtmClient({
          appId,
          uid: responseData.uid,
          token: responseData.token,
          channel: responseData.channel,
        }),
      ]);

      setRtmConnectionState('ready');
      setRtmClient(rtm);
      setAgoraData({
        ...responseData,
        agentId: agentData?.agent_id,
      });
      setShowConversation(true);
    } catch (err) {
      setRtmConnectionState('failed');
      setError(
        'Could not connect live transcript. Check your connection and try again.',
      );
      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenWillExpire = useCallback(
    async (uid: string): Promise<AgoraRenewalTokens> => {
      try {
        const channel = agoraData?.channel;
        if (!channel) {
          throw new Error('Missing channel for token renewal');
        }

        const [rtcResponse, rtmResponse] = await Promise.all([
          fetch(`/api/generate-agora-token?channel=${channel}&uid=${uid}`),
          fetch(`/api/generate-agora-token?channel=${channel}&uid=${agoraData.uid}`),
        ]);
        const [rtcData, rtmData] = await Promise.all([
          rtcResponse.json(),
          rtmResponse.json(),
        ]);

        if (!rtcResponse.ok || !rtmResponse.ok) {
          throw new Error('Failed to generate renewal tokens');
        }

        return {
          rtcToken: rtcData.token,
          rtmToken: rtmData.token,
        };
      } catch (error) {
        console.error('Error renewing token:', error);
        throw error;
      }
    },
    [agoraData],
  );

  const handleEndConversation = async () => {
    if (agoraData?.agentId) {
      try {
        const response = await fetch('/api/stop-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agoraData.agentId }),
        });
        if (!response.ok) {
          console.error('Failed to stop agent:', await response.text());
        }
      } catch (error) {
        console.error('Error stopping agent:', error);
      }
    }

    if (rtmClient && agoraData?.channel) {
      try {
        await rtmClient.unsubscribe(agoraData.channel);
        await rtmClient.logout();
      } catch (err) {
        console.error('RTM logout error:', err);
      }
    }

    clearStoredAgentId();
    setRtmClient(null);
    setRtmConnectionState('connecting');
    setAgoraData(null);
    setShowConversation(false);
  };

  const handleAgentStarted = useCallback((agentId: string) => {
    setStoredAgentId(agentId);
    setAgentJoinError(false);
    setAgoraData((prev) => (prev ? { ...prev, agentId } : prev));
  }, []);

  const handleAgentInviteFailed = useCallback(() => {
    setAgentJoinError(true);
  }, []);

  return (
    <div className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          showConversation
            ? 'items-stretch justify-start'
            : 'items-center justify-center'
        }`}
      >
        <div
          className={`z-10 flex min-h-0 flex-1 flex-col ${
            showConversation
              ? 'h-full w-full max-w-none items-stretch gap-0 px-0 text-left'
              : 'w-full max-w-none items-center justify-center px-4 text-center'
          }`}
        >
          {!showConversation ? (
            <QuickstartPreCallCard
              isLoading={isLoading}
              error={error}
              onStartConversation={handleStartConversation}
            />
          ) : agoraData && rtmClient ? (
            <>
              <Suspense fallback={<LoadingSkeleton />}>
                <ErrorBoundary>
                  <AgoraProvider key={agoraData.channel}>
                    <ConversationComponent
                      key={agoraData.channel}
                      agoraData={agoraData}
                      rtmClient={rtmClient}
                      rtmConnectionState={rtmConnectionState}
                      onTokenWillExpire={handleTokenWillExpire}
                      onEndConversation={handleEndConversation}
                      onAgentStarted={handleAgentStarted}
                      onAgentInviteFailed={handleAgentInviteFailed}
                      agentInviteFailed={agentJoinError}
                    />
                  </AgoraProvider>
                </ErrorBoundary>
              </Suspense>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Failed to load conversation data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
