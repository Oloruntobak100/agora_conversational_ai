# Nexora n8n tool bridge

Nexora can call **n8n Cloud** workflows while the Agora Conversational AI agent is in a live session. Workflows run through a shared JSON contract; results are spoken back by the agent or can end the session.

## Architecture

1. **Production:** Agora cloud → `https://<your-domain>/api/mcp` (Streamable HTTP MCP) → `invoke_workflow`, `get_session_fields`, `confirm_session_email`, `end_conversation`.
2. **Manual testing:** `POST /api/tools` with the same tool names and args (no MCP handshake).

Both paths use `lib/agent-tools` (`executeAgentTool`, `dispatch-n8n.ts`).

## Enable tools

Set in Vercel (or `.env.local`):

| Variable | Required | Notes |
|----------|----------|--------|
| `AGORA_ENABLE_TOOLS` | Yes | `true` to register MCP on the agent |
| `NEXORA_MCP_PUBLIC_URL` | Yes* | Public HTTPS base, e.g. `https://nexora-voice-ai.vercel.app` |
| `N8N_TOOL_WEBHOOK_URL` | Yes | Default n8n webhook for `invoke_workflow` |
| `N8N_WEBHOOK_SECRET` | Recommended | Sent as `X-Webhook-Secret` to n8n |
| `MCP_AUTH_TOKEN` | Recommended | Agora sends `Authorization: Bearer …` to `/api/mcp` |

\*If unset, `VERCEL_URL` is used on Vercel deployments.

Optional:

- `N8N_TOOL_ROUTES_JSON` — per-tool URLs, e.g. `{"lookup_order":"https://…/webhook/abc"}`

**Tools stay off** unless `AGORA_ENABLE_TOOLS=true` **and** a public MCP URL resolves. This avoids breaking sessions when MCP is misconfigured.

## Reference n8n workflow

1. **Webhook** trigger (POST), path e.g. `nexora-tools`.
2. Your logic (HTTP Request, Set, Code, etc.).
3. **Respond to Webhook** node with JSON:

```json
{
  "speak": "Your order ships tomorrow.",
  "endSession": false,
  "data": { "orderId": "123" }
}
```

| Field | Purpose |
|-------|---------|
| `speak` | Line for the agent to paraphrase to the user |
| `endSession` | If `true`, Nexora stops the agent and sends RTM `nexora.session` end |
| `data` | Opaque payload (logged / future UI) |

### n8n Switch node (single webhook)

1. Webhook → **Switch** on `{{ $json.intent }}` or `{{ $json.args.intent }}`
2. Output `send_email` → email branch → **Respond to Webhook**
3. Output `lookup_order` → order branch → **Respond to Webhook**

Example voice: *"Send an email to support"* → agent directs the user to the **on-screen email form**, then `get_session_fields` → read-back → `confirm_session_email` → `invoke_workflow` with `intent: "send_email"`.

The in-call UI shows a centered **Workflow** pill when the webhook returns successfully (polls `/api/tool-events`).

### Form-first email (`send_email`)

Voice STT is not used for the `to` address. Flow:

1. User types email in **Email capture** panel (or taps **Enter email** during the call).
2. `POST /api/session-fields` `{ channel, email, action: "submit" }` stores the address (`pending_confirmation`).
3. Agent calls `get_session_fields` and reads `readBackLine` aloud for confirmation.
4. User confirms verbally or taps **Yes, that's correct** → `confirm_session_email` or `POST` `{ action: "confirm" }`.
5. `invoke_workflow` with `intent: "send_email"` — Nexora sets `args.to` from the stored email (overrides any LLM guess).

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/session-fields` | GET `?channel=` | Panel status: `none`, `awaiting_capture`, `pending_confirmation`, `confirmed` |
| `/api/session-fields` | POST | `submit` (email), `confirm`, `reset` |

**Production (Vercel):** connect **Vercel KV** (or Upstash Redis) so the browser form and Agora MCP `get_session_fields` share the same storage. Add `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project (created automatically when you link KV in the Vercel dashboard). Without KV, email submit and agent tools may hit different serverless instances and the agent will not see the form email.

### Incoming payload from Nexora

```json
{
  "tool": "invoke_workflow",
  "intent": "send_email",
  "args": { "intent": "send_email", "to": "user@example.com", "subject": "Hello" },
  "sessionId": "channel-name",
  "channel": "channel-name",
  "requesterId": "4321",
  "agentId": "cloud-agent-id"
}
```

For `send_email`, `to` is always the form-captured address when confirmed; the LLM should not pass `to` from speech.

Use **`intent`** (or `args.intent`) in an n8n **Switch** node to route branches, e.g. `send_email`, `lookup_order`, `book_appointment`.

### Respond to Webhook (include UI banner fields)

```json
{
  "speak": "Your email has been sent.",
  "branch": "send_email",
  "toolLabel": "Email tool called",
  "toolIcon": "✉️",
  "endSession": false,
  "data": {}
}
```

| Field | Purpose |
|-------|---------|
| `branch` | Switch branch id (shown in UI + logs) |
| `toolLabel` | Banner headline, e.g. "Email tool called" |
| `toolIcon` | Emoji or short icon string for the in-call banner |

Validate `X-Webhook-Secret` in n8n (IF node or Function) when `N8N_WEBHOOK_SECRET` is set.

## MCP tools (Agora-facing)

| Tool | Args | Behavior |
|------|------|----------|
| `invoke_workflow` | `channel_name`, `requester_id`, optional `workflow`, `args` | POST to n8n |
| `get_session_fields` | `channel_name`, `requester_id` | Returns form email + read-back line |
| `confirm_session_email` | `channel_name`, `requester_id` | Marks form email confirmed before `send_email` |
| `end_conversation` | `channel_name`, `requester_id`, optional `reason` | Stop agent + RTM end signal |

The system prompt instructs the LLM to pass `channel_name` and `requester_id` from template variables `{{channel_name}}` and `{{requester_id}}`.

Session metadata is also stored in-memory after invite (`lib/session-tool-context.ts`) for warm serverless instances.

## Test checklist

1. **Env:** `AGORA_ENABLE_TOOLS=true`, `NEXORA_MCP_PUBLIC_URL`, `N8N_TOOL_WEBHOOK_URL`, `MCP_AUTH_TOKEN`.
2. **Direct API:**

```bash
curl -s -X POST https://<domain>/api/tools \
  -H "Content-Type: application/json" \
  -d '{"tool":"invoke_workflow","args":{"channel_name":"test-ch","requester_id":"999","query":"ping"}}'
```

3. **Live call:** Start a session, ask the agent to run a workflow; confirm n8n execution history.
4. **End session:** Say goodbye; agent should call `end_conversation` and the UI should tear down without refresh.

## Troubleshooting

| Issue | Check |
|-------|--------|
| Agent never calls tools | `AGORA_ENABLE_TOOLS`, public MCP URL, Agora can reach HTTPS (not localhost) |
| MCP 401 | `MCP_AUTH_TOKEN` matches Console / OpenAI vendor MCP headers |
| n8n 404 | Webhook URL and workflow **Active** |
| Tool missing session | Pass `channel_name` + `requester_id` in tool args; re-invite after cold start |

See also [WEBHOOKS.md](./WEBHOOKS.md) for Agora Console notifications (ops, not tool execution).
