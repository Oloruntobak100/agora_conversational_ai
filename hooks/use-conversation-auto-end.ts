import { useEffect, useRef } from "react";
import {
  getFarewellHangupMs,
  isInternalTranscriptMessage,
  isUserEndIntent,
} from "@/lib/conversation-end";
import { debugSessionLog } from "@/lib/debug-session-log";

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
  const shortenedAfterAgentReplyRef = useRef(false);
  const hangupTimerRef = useRef<number | null>(null);

  const clearHangupTimer = () => {
    if (hangupTimerRef.current !== null) {
      window.clearTimeout(hangupTimerRef.current);
      hangupTimerRef.current = null;
    }
  };

  useEffect(() => {
    userEndIndexRef.current = -1;
    shortenedAfterAgentReplyRef.current = false;
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
    const agentReplied = afterGoodbye.some(
      (m) => String(m.uid) === agentUidStr,
    );

    const fireEnd = (reason: string, delayMs: number) => {
      if (options.sessionEndHandled.current) return;
      options.sessionEndHandled.current = true;
      clearHangupTimer();
      debugSessionLog("H3", "use-conversation-auto-end.ts:fire", "hangup fired", {
        reason,
        delayMs,
        lastUserEndIndex,
        agentReplied,
      });
      console.info("[auto-end]", reason);
      void Promise.resolve(options.onEnd());
    };

    const schedule = (reason: string, delayMs: number) => {
      clearHangupTimer();
      debugSessionLog("H1", "use-conversation-auto-end.ts:schedule", "hangup scheduled", {
        reason,
        delayMs,
        lastUserEndIndex,
        agentReplied,
        previousUserEndIndex: userEndIndexRef.current,
      });
      hangupTimerRef.current = window.setTimeout(
        () => fireEnd(reason, delayMs),
        delayMs,
      );
    };

    if (userEndIndexRef.current !== lastUserEndIndex) {
      userEndIndexRef.current = lastUserEndIndex;
      shortenedAfterAgentReplyRef.current = false;
      schedule("user-goodbye-max-wait", MAX_WAIT_AFTER_USER_GOODBYE_MS);
      return;
    }

    if (agentReplied && !shortenedAfterAgentReplyRef.current) {
      shortenedAfterAgentReplyRef.current = true;
      schedule("agent-replied-after-goodbye", getFarewellHangupMs());
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
