import { useEffect, useRef } from "react";
import {
  getFarewellHangupMs,
  isAgentClosingReply,
  isInternalTranscriptMessage,
  isUserEndIntent,
} from "@/lib/conversation-end";

type MessageItem = {
  turn_id?: string | number;
  uid: number;
  text: string;
  createdAt?: number;
};

const MAX_WAIT_AFTER_USER_GOODBYE_MS = 8_000;

export function useConversationAutoEnd(options: {
  enabled: boolean;
  channel: string;
  messageList: MessageItem[];
  agentUid: string;
  onEnd: () => void | Promise<void>;
  sessionEndHandled: React.MutableRefObject<boolean>;
}): void {
  const userEndIndexRef = useRef(-1);
  const shortenedAfterClosingRef = useRef(false);
  const hangupTimerRef = useRef<number | null>(null);

  const clearHangupTimer = () => {
    if (hangupTimerRef.current !== null) {
      window.clearTimeout(hangupTimerRef.current);
      hangupTimerRef.current = null;
    }
  };

  useEffect(() => {
    userEndIndexRef.current = -1;
    shortenedAfterClosingRef.current = false;
    clearHangupTimer();
  }, [options.channel]);

  useEffect(() => {
    return () => clearHangupTimer();
  }, []);

  useEffect(() => {
    if (!options.enabled || options.sessionEndHandled.current) return;

    const visible = options.messageList.filter(
      (m) => !isInternalTranscriptMessage(m.text ?? ""),
    );

    const agentUidStr = options.agentUid;
    let lastUserEndIndex = -1;
    for (let i = visible.length - 1; i >= 0; i--) {
      if (String(visible[i].uid) === agentUidStr) continue;
      if (isUserEndIntent(visible[i].text)) {
        lastUserEndIndex = i;
        break;
      }
    }

    if (lastUserEndIndex < 0) return;

    const afterGoodbye = visible.slice(lastUserEndIndex + 1);
    const agentClosingReply = afterGoodbye.some(
      (m) =>
        String(m.uid) === agentUidStr && isAgentClosingReply(m.text ?? ""),
    );

    const fireEnd = (reason: string) => {
      if (options.sessionEndHandled.current) return;
      options.sessionEndHandled.current = true;
      clearHangupTimer();
      console.info("[auto-end]", reason);
      void Promise.resolve(options.onEnd());
    };

    const schedule = (reason: string, delayMs: number) => {
      clearHangupTimer();
      hangupTimerRef.current = window.setTimeout(
        () => fireEnd(reason),
        delayMs,
      );
    };

    if (userEndIndexRef.current !== lastUserEndIndex) {
      userEndIndexRef.current = lastUserEndIndex;
      shortenedAfterClosingRef.current = false;
      schedule("user-goodbye-max-wait", MAX_WAIT_AFTER_USER_GOODBYE_MS);
      return;
    }

    if (agentClosingReply && !shortenedAfterClosingRef.current) {
      shortenedAfterClosingRef.current = true;
      schedule("agent-closing-reply", getFarewellHangupMs());
    }
  }, [
    options.enabled,
    options.channel,
    options.messageList,
    options.agentUid,
    options.onEnd,
    options.sessionEndHandled,
  ]);
}
