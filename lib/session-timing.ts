import { debugSessionLog } from '@/lib/debug-session-log';
import { isMobileBrowser } from '@/lib/device';

const marks = new Map<string, number>();

function browserMeta(): Record<string, string | boolean | undefined> {
  if (typeof navigator === 'undefined') return {};
  const conn = (
    navigator as Navigator & {
      connection?: { effectiveType?: string };
    }
  ).connection;
  return {
    mobile: isMobileBrowser(),
    ua: navigator.userAgent.slice(0, 80),
    effectiveType: conn?.effectiveType,
  };
}

export function resetSessionTiming(): void {
  marks.clear();
  marks.set('session_start', Date.now());
}

export function markSession(
  phase: string,
  hypothesisId?: string,
  extra?: Record<string, unknown>,
): void {
  const now = Date.now();
  marks.set(phase, now);
  const start = marks.get('session_start') ?? now;
  debugSessionLog({
    location: 'session-timing.ts',
    message: `phase:${phase}`,
    hypothesisId: hypothesisId ?? 'T',
    data: {
      elapsedMs: now - start,
      ...browserMeta(),
      ...extra,
    },
  });
}

export function elapsedSince(phase: string): number | null {
  const t = marks.get(phase);
  if (!t) return null;
  return Date.now() - t;
}
