# Agora Console webhooks (Nexora)

Agora Conversational AI can POST session events to your app for **monitoring and QA**. These webhooks do **not** hang up calls — use the `end_conversation` MCP tool and RTM `nexora.session` for user-facing teardown.

## Endpoint

```
POST https://<your-domain>/api/webhooks/agora
```

Example production URL:

```
https://nexora-voice-ai.vercel.app/api/webhooks/agora
```

## Setup in Agora Console

1. Open your project → **Conversational AI** (or product notifications, per current Console UI).
2. Enable **Notifications** / webhooks.
3. Set the callback URL to `https://<domain>/api/webhooks/agora`.
4. Copy the **secret** into Vercel as `AGORA_WEBHOOK_SECRET`.

## Environment

| Variable | Required | Notes |
|----------|----------|--------|
| `AGORA_WEBHOOK_SECRET` | Recommended | Verifies `Agora-Signature` (SHA1) and `Agora-Signature-V2` (SHA256) |

If the secret is unset, the route logs a warning and accepts unsigned payloads (dev only).

## Signature verification

The handler reads the raw body and verifies HMAC per [Agora webhooks documentation](https://docs.agora.io/en/conversational-ai/develop/webhooks):

- `Agora-Signature-V2` → HMAC-SHA256 hex
- `Agora-Signature` → HMAC-SHA1 hex

Implementation: `lib/webhooks/verify-agora-signature.ts`.

## Handled event types

| `eventType` | Meaning | Logging |
|-------------|---------|---------|
| `101` | Agent joined | `console.info` |
| `102` | Agent left | `console.info` |
| `103` | Dialogue history | `console.info` |
| `110` | Agent error | `console.warn` |
| `111` | Agent metrics | `console.info` |
| other | Unknown | `console.info` |

Response: `200` with `{ "ok": true }` within 10 seconds.

## Labels and correlation

Invite-time labels (`app: nexora`, `channel`, `requester_id`) help match webhook payloads to sessions in Vercel logs. They are set in `lib/invite-agent-pipeline.ts` via `.withLabels()`.

## Local testing

Without Console, you can POST a signed body:

```bash
BODY='{"eventType":101,"noticeId":"test-1"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$AGORA_WEBHOOK_SECRET" | awk '{print $2}')
curl -s -X POST http://localhost:3000/api/webhooks/agora \
  -H "Content-Type: application/json" \
  -H "Agora-Signature-V2: $SIG" \
  -d "$BODY"
```

## Related

- Tool execution and n8n: [N8N_TOOLS.md](./N8N_TOOLS.md)
- Auto end-call: `end_conversation` tool + RTM `nexora.session` in `lib/publish-rtm-signal.ts`
