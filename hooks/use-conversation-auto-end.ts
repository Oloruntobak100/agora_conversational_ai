import { useEffect, useRef } from "react";
import {
  getFarewellHangupMs,
  hasRecentUserEndIntent,
  isAgentFarewellMessage,
  isInternalTranscriptMessage,
} from "@/lib/conversation-end";

type MessageItem = {
  turn_id?: string | number;
  uid: number;
  text: string;
  createdAt?: number;
};

function turnKey(msg: MessageItem): string {
  return `${msg.turn_id ?? ""}:${msg.uid}:${msg.text}`;
}

export function useConversationAutoEnd(options: {
  enabled: boolean;
  channel: string;
  messageList: MessageItem[];
  agentUid: string;
  onEnd: () => void;
  sessionEndHandled: React.MutableRefObject<boolean>;
}): void {
  const scheduledFarewellKey = useRef<string | null>(null);

  useEffect(() => {
    scheduledFarewellKey.current = null;
  }, [options.channel]);

  useEffect(() => {
    if (!options.enabled || options.sessionEndHandled.current) return;

    const visible = options.messageList.filter(
      (m) => !isInternalTranscriptMessage(m.text ?? ""),
    );
    if (visible.length === 0) return;

    const last = visible[visible.length - 1];
    const agentUidStr = options.agentUid;

    if (String(last.uid) !== agentUidStr) return;
    if (!isAgentFarewellMessage(last.text)) return;

    if (!hasRecentUserEndIntent(visible, agentUidStr)) return;

    const key = turnKey(last);
    if (scheduledFarewellKey.current === key) return;
    scheduledFarewellKey.current = key;

    const delayMs = getFarewellHangupMs();
    const id = window.setTimeout(() => {
      if (options.sessionEndHandled.current) return;
      options.sessionEndHandled.current = true;
      console.info("[auto-end] farewell exchange complete, ending session");
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
