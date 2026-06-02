/** Agora silence "think" prompts — must not show in transcript or reset idle timers. */
export function isInternalTranscriptMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/the user has been (silent|quiet)/i.test(t)) return true;
  if (/do not say goodbye unless they clearly want to end/i.test(t)) return true;
  if (/end_conversation with channel_name/i.test(t)) return true;
  if (/do not ask another question/i.test(t)) return true;
  return false;
}

/** Agent lines that indicate the call should end (not a check-in). */
export function isAgentFarewellMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /still there|checking in|just checking|are you there|still with me|need help with something|need assistance/i.test(
      t,
    )
  ) {
    return false;
  }
  if (/issue ending the session/i.test(t)) {
    return false;
  }
  return /goodbye|good bye|have a (great|wonderful|nice) day|take care|talk to you later|see you later|bye for now|ending our call|thank you for chatting/i.test(
    t,
  );
}

export function hasRecentUserEndIntent(
  messages: { uid: number | string; text: string }[],
  agentUid: string,
): boolean {
  const agentUidStr = String(agentUid);
  const start = Math.max(0, messages.length - 6);
  for (let i = messages.length - 1; i >= start; i--) {
    const m = messages[i];
    if (String(m.uid) === agentUidStr) continue;
    const t = m.text.trim();
    if (
      isUserFarewellMessage(t) ||
      /^i'?m good\b/i.test(t) ||
      /^that'?s all\b/i.test(t) ||
      /end conversation/i.test(t)
    ) {
      return true;
    }
  }
  return false;
}

export function isUserFarewellMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /goodbye|good bye|that's all|that is all|i'm done|im done|hang up|end (the )?call|end conversation|bye\b|i'?m good/i.test(
    t,
  );
}

export function getSilenceWrapUpContent(): string {
  return (
    process.env.NEXORA_SILENCE_WRAPUP_CONTENT?.trim() ||
    "The user has been quiet for a while. Ask one brief, friendly question to see if they are still there or need help. Do not say goodbye unless they clearly want to end the call."
  );
}

export function getFarewellHangupMs(): number {
  const raw = process.env.NEXT_PUBLIC_NEXORA_FAREWELL_HANGUP_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 500) {
    return Math.min(parsed, 30_000);
  }
  return 2_000;
}

/** Long idle safety net — only real user silence, not internal prompts. */
export function getSilenceForceEndMs(): number {
  const raw = process.env.NEXT_PUBLIC_NEXORA_SILENCE_FORCE_END_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 10_000) {
    return Math.min(parsed, 300_000);
  }
  return 90_000;
}
