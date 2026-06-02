/** Agent lines that indicate the call should end (not a check-in). */
export function isAgentFarewellMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/still there|checking in|just checking|are you there/i.test(t)) {
    return false;
  }
  return /goodbye|good bye|have a (great|wonderful|nice) day|take care|talk to you later|see you later|bye for now|ending our call/i.test(
    t,
  );
}

export function isUserFarewellMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /goodbye|good bye|that's all|that is all|i'm done|im done|hang up|end (the )?call|bye\b/i.test(
    t,
  );
}

export function getSilenceWrapUpContent(): string {
  return (
    process.env.NEXORA_SILENCE_WRAPUP_CONTENT?.trim() ||
    "The user has been silent. Say one short sentence wishing them a great day and goodbye. Then immediately call end_conversation with channel_name and requester_id. Do not ask another question."
  );
}

export function getFarewellHangupMs(): number {
  const raw = process.env.NEXT_PUBLIC_NEXORA_FAREWELL_HANGUP_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 500) {
    return Math.min(parsed, 30_000);
  }
  return 2_500;
}

/** Client safety net if end_conversation never runs after silence wrap-up. */
export function getSilenceForceEndMs(): number {
  const raw = process.env.NEXT_PUBLIC_NEXORA_SILENCE_FORCE_END_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 3_000) {
    return Math.min(parsed, 120_000);
  }
  return 15_000;
}
