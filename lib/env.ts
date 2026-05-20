/**
 * Server-side Agora credentials with legacy Vercel env fallbacks.
 */
export function getAgoraAppId(): string {
  const id =
    process.env.NEXT_PUBLIC_AGORA_APP_ID?.trim() ||
    process.env.AGORA_APP_ID?.trim();
  if (!id) {
    throw new Error(
      "Missing Agora App ID. Set NEXT_PUBLIC_AGORA_APP_ID (or legacy AGORA_APP_ID)."
    );
  }
  return id;
}

export function getAgoraAppCertificate(): string {
  const cert =
    process.env.NEXT_AGORA_APP_CERTIFICATE?.trim() ||
    process.env.AGORA_APP_CERTIFICATE?.trim();
  if (!cert) {
    throw new Error(
      "Missing Agora App Certificate. Set NEXT_AGORA_APP_CERTIFICATE (or legacy AGORA_APP_CERTIFICATE)."
    );
  }
  return cert;
}

export function getAgentUid(): string {
  return (
    process.env.NEXT_PUBLIC_AGENT_UID?.trim() ||
    String(123456)
  );
}

export function getAgentGreeting(): string {
  return (
    process.env.NEXT_AGENT_GREETING?.trim() ||
    process.env.AGENT_GREETING_MESSAGE?.trim() ||
    "Hello! I'm listening. How can I help you today?"
  );
}
