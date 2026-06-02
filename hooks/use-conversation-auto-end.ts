import { useEffect, useRef } from "react";
import type { AgentState } from "agora-agent-client-toolkit";
import {
  getFarewellHangupMs,
  getSilenceForceEndMs,
  isAgentFarewellMessage,
} from "@/lib/conversation-end";

type MessageItem = {
  uid: number;
  text: string;
  createdAt?: number;
};

export function useConversationAutoEnd(options: {
  enabled: boolean;
  channel: string;
  messageList: MessageItem[];
  agentUid: string;
  agentState: AgentState | null;
  onEnd: () => void;
  sessionEndHandled: React.MutableRefObject<boolean>;
}): void {
  const lastUserSpeechAt = useRef(Date.now());
  const callStartedAt = useRef(Date.now());

  useEffect(() => {
    lastUserSpeechAt.current = Date.now();
    callStartedAt.current = Date.now();
  }, [options.channel]);

  useEffect(() => {
    const agentUidStr = options.agentUid;
    let latest = lastUserSpeechAt.current;
    for (const msg of options.messageList) {
      if (String(msg.uid) !== agentUidStr) {
        const t = msg.createdAt ?? Date.now();
        if (t > latest) latest = t;
      }
    }
    lastUserSpeechAt.current = latest;
  }, [options.messageList, options.agentUid]);

  useEffect(() => {
    if (!options.enabled) return;

    const farewellMs = getFarewellHangupMs();
    const forceMs = getSilenceForceEndMs();

    const tick = () => {
      if (options.sessionEndHandled.current) return;

      const agentBusy =
        options.agentState === "speaking" ||
        options.agentState === "thinking";

      const now = Date.now();
      const sinceUser = now - lastUserSpeechAt.current;

      const last = options.messageList[options.messageList.length - 1];
      if (
        last &&
        String(last.uid) === options.agentUid &&
        isAgentFarewellMessage(last.text) &&
        !agentBusy &&
        sinceUser >= farewellMs
      ) {
        options.sessionEndHandled.current = true;
        console.info("[auto-end] agent farewell detected, ending session");
        options.onEnd();
        return;
      }

      if (now - callStartedAt.current < 10_000) return;

      if (!agentBusy && sinceUser >= forceMs) {
        options.sessionEndHandled.current = true;
        console.info("[auto-end] silence force-end timeout");
        options.onEnd();
      }
    };

    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [
    options.enabled,
    options.channel,
    options.messageList,
    options.agentUid,
    options.agentState,
    options.onEnd,
    options.sessionEndHandled,
  ]);
}
