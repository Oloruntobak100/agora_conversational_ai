import { useEffect, useRef } from "react";
import {
  getFarewellHangupMs,
  isInternalTranscriptMessage,
  isUserFarewellMessage,
} from "@/lib/conversation-end";

type MessageItem = {
  turn_id?: string | number;
  uid: number;
  text: string;
  createdAt?: number;
};

function isUserEndIntent(text: string): boolean {
  const t = text.trim();
  return (
    isUserFarewellMessage(t) || /end conversation/i.test(t) || /^bye\.?$/i.test(t)
  );
}

export function useConversationAutoEnd(options: {
  enabled: boolean;
  channel: string;
  messageList: MessageItem[];
  agentUid: string;
  onEnd: () => void;
  sessionEndHandled: React.MutableRefObject<boolean>;
}): void {
  const scheduledKey = useRef<string | null>(null);

  useEffect(() => {
    scheduledKey.current = null;
  }, [options.channel]);

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

    const scheduleKey = `${lastUserEndIndex}-${afterGoodbye.length}`;
    if (scheduledKey.current === scheduleKey) return;
    scheduledKey.current = scheduleKey;

    const delayMs = agentReplied ? getFarewellHangupMs() : 5_000;

    const id = window.setTimeout(() => {
      if (options.sessionEndHandled.current) return;
      options.sessionEndHandled.current = true;
      console.info("[auto-end] user ended call, closing session", {
        agentReplied,
        delayMs,
      });
      options.onEnd();
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [
    options.enabled,
    options.channel,
    options.messageList,
    options.agentUid,
    options.onEnd,
    options.sessionEndHandled,
  ]);
}
