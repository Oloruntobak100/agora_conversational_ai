import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyAgoraSignature(
  rawBody: string,
  secret: string,
  signature: string | null,
  algorithm: "sha1" | "sha256",
): boolean {
  if (!signature) return false;

  const hmac = createHmac(algorithm, secret);
  hmac.update(rawBody, "utf8");
  const expected = hmac.digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return expected === signature;
  }
}

export function verifyAgoraWebhookRequest(
  rawBody: string,
  secret: string,
  headers: Headers,
): boolean {
  const sigV1 = headers.get("Agora-Signature");
  const sigV2 = headers.get("Agora-Signature-V2");

  if (sigV2 && verifyAgoraSignature(rawBody, secret, sigV2, "sha256")) {
    return true;
  }
  if (sigV1 && verifyAgoraSignature(rawBody, secret, sigV1, "sha1")) {
    return true;
  }
  return false;
}
