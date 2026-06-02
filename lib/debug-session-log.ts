/** Debug-mode NDJSON ingest (session 3cbf76). */
export function debugSessionLog(
  hypothesisId: string,
  location: string,
  message: string,
  data?: Record<string, unknown>,
  runId = "pre-fix",
): void {
  // #region agent log
  fetch("http://127.0.0.1:7645/ingest/60315393-7333-48b3-bbed-5acc3d74cb67", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "3cbf76",
    },
    body: JSON.stringify({
      sessionId: "3cbf76",
      hypothesisId,
      location,
      message,
      data,
      runId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}
