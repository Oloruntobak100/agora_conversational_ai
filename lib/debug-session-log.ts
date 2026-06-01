type DebugLogPayload = {
  location: string;
  message: string;
  data?: Record<string, unknown>;
  hypothesisId?: string;
  runId?: string;
};

const SESSION_ID = '3cbf76';
const INGEST =
  'http://127.0.0.1:7645/ingest/60315393-7333-48b3-bbed-5acc3d74cb67';

/** Debug-mode NDJSON (local ingest + console for production Chrome inspect). */
export function debugSessionLog(payload: DebugLogPayload): void {
  const entry = {
    sessionId: SESSION_ID,
    timestamp: Date.now(),
    ...payload,
  };

  if (typeof window !== 'undefined') {
    // #region agent log
    console.info('[debug-3cbf76]', entry);
    fetch(INGEST, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': SESSION_ID,
      },
      body: JSON.stringify(entry),
    }).catch(() => {});
    // #endregion
  }
}
