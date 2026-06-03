/** Debug session logging (NDJSON ingest + console for Vercel). */
export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  const payload = {
    sessionId: "3cbf76",
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
  };
  // #region agent log
  fetch("http://127.0.0.1:7645/ingest/60315393-7333-48b3-bbed-5acc3d74cb67", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "3cbf76",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
  console.info("[debug-3cbf76]", JSON.stringify(payload));
}
