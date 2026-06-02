import { NextResponse } from "next/server";
import { getAgoraWebhookSecret } from "@/lib/env";
import { verifyAgoraWebhookRequest } from "@/lib/webhooks/verify-agora-signature";

export const runtime = "nodejs";

type AgoraWebhookBody = {
  noticeId?: string;
  productId?: number;
  eventType?: number;
  notifyMs?: number;
  payload?: Record<string, unknown>;
};

function logEvent(body: AgoraWebhookBody): void {
  const { eventType, noticeId, payload } = body;
  switch (eventType) {
    case 101:
      console.info("[agora-webhook] agent joined", { noticeId, payload });
      break;
    case 102:
      console.info("[agora-webhook] agent left", { noticeId, payload });
      break;
    case 103:
      console.info("[agora-webhook] dialogue history", { noticeId });
      break;
    case 110:
      console.warn("[agora-webhook] agent error", { noticeId, payload });
      break;
    case 111:
      console.info("[agora-webhook] agent metrics", { noticeId, payload });
      break;
    default:
      console.info("[agora-webhook] event", { eventType, noticeId });
  }
}

export async function POST(request: Request) {
  const secret = getAgoraWebhookSecret();
  const rawBody = await request.text();

  if (secret) {
    const valid = verifyAgoraWebhookRequest(rawBody, secret, request.headers);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "[agora-webhook] AGORA_WEBHOOK_SECRET not set — accepting unsigned payloads",
    );
  }

  let body: AgoraWebhookBody = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as AgoraWebhookBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  logEvent(body);

  return NextResponse.json({ ok: true });
}
