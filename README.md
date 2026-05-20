# Agora Voice Agent (Web)

Minimal Next.js web app for [Agora Conversational AI](https://docs.agora.io/en/conversational-ai/overview/product-overview): tap the microphone, talk to a voice agent, hear spoken replies. Business actions (appointments, email, webhooks) are intended to run in **n8n** via MCP tools.

**Repository:** [github.com/Oloruntobak100/agora_conversational_ai](https://github.com/Oloruntobak100/agora_conversational_ai)

Mobile-first UI (large tap targets, safe-area insets, `viewport-fit: cover` for notched phones).

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Agora Web RTC SDK + Conversational AI REST API (`join` / `leave`)
- Framer Motion (mic UI)
- Deploy on Vercel

## Quick start

1. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

2. Complete [Agora Console setup](#agora-console-checklist) and fill `.env.local`.

3. Run locally:

   ```bash
   npm install
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), tap the mic, allow microphone access.

## Agora Console checklist

1. Create a project at [console.agora.io](https://console.agora.io).
2. Copy **App ID** → `AGORA_APP_ID` and `NEXT_PUBLIC_AGORA_APP_ID`.
3. Enable **App Certificate** → `AGORA_APP_CERTIFICATE`.
4. Enable **RTC** and **Conversational AI** for the project.
5. **RESTful API**: copy **Customer ID** / **Customer Secret** → `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`.
6. If `join` fails with provider errors, add **OpenAI / Deepgram / MiniMax** credentials in Conversational AI model settings (for presets).
7. Optional: smoke-test `POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appId}/join` with Basic auth.

## Vercel environment variables

Set every variable from [`.env.example`](.env.example) in the Vercel project **Settings → Environment Variables**.

| Variable | Required |
|----------|----------|
| `AGORA_APP_ID` | Yes |
| `AGORA_APP_CERTIFICATE` | Yes |
| `AGORA_CUSTOMER_ID` | Yes |
| `AGORA_CUSTOMER_SECRET` | Yes |
| `NEXT_PUBLIC_AGORA_APP_ID` | Yes (same as App ID) |
| `AGORA_CONVERSATIONAL_AI_BASE_URL` | No (default `https://api.agora.io`) |
| `AGORA_AGENT_PRESET` | No |
| `SESSION_IDLE_TIMEOUT_SEC` | No |
| `AGENT_SESSION_MAX_MINUTES` | No |
| `AGENT_SYSTEM_PROMPT` | No |
| `AGENT_GREETING_MESSAGE` | No |
| `OPENAI_API_KEY` / `AGENT_LLM_MODEL` | Only for explicit LLM override |
| `AGORA_ENABLE_TOOLS` | No (`false` default) |
| `N8N_MCP_ENDPOINT` | When tools enabled |
| `N8N_TOOL_WEBHOOK_URL` | Optional bridge via `/api/tools` |

Deploy:

```bash
vercel
```

## How it works

1. Browser calls `POST /api/session/start`.
2. Server generates channel + UIDs, RTC tokens, and calls Agora **join**.
3. Browser joins the RTC channel, publishes the microphone.
4. Conversational AI agent joins the same channel and handles ASR → LLM → TTS.
5. Stop or page unload calls `POST /api/session/stop` (Agora **leave**).

## n8n integration (actions)

Tools are **off** until you configure n8n and set `AGORA_ENABLE_TOOLS=true`.

### Option A — MCP (recommended)

1. In n8n, expose an MCP server with tools such as `book_appointment`, `send_email`, `run_webhook`.
2. Set `N8N_MCP_ENDPOINT` to that URL.
3. Set `AGORA_ENABLE_TOOLS=true` on Vercel.
4. Restart a session — the agent can invoke allowed tools during conversation.

### Option B — Webhook bridge

1. Create an n8n workflow triggered by webhook with body `{ tool, args, sessionId, turnId }`.
2. Set `N8N_TOOL_WEBHOOK_URL` and optionally `N8N_WEBHOOK_SECRET`.
3. Call `POST /api/tools` from your own integration layer (stub included).

Keep Gmail, Calendar, and CRM secrets **only in n8n**.

## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/session/start` | POST | Start agent + return user RTC credentials |
| `/api/session/stop` | POST | Stop agent (`{ agentId }`) |
| `/api/tools` | POST | Forward tool calls to n8n (optional) |

## Scripts

```bash
npm run dev    # development
npm run build  # production build
npm run start  # production server
npm run lint   # ESLint
```

## Smoke test (production)

- Desktop Chrome: start session, speak, hear greeting/reply, end session.
- iOS Safari: same flow; confirm mic permission and audio playback.
- Confirm Agora Console / billing: agent reaches `leave` after **End session** or tab close.

## Troubleshooting

### “Listening to you” but no voice reply

1. **Internet** — RTC needs a stable connection (Wi‑Fi or mobile data). “No internet connection” in the browser will block the agent.
2. **Pause after speaking** — The agent sends your audio after you **stop talking** (end-of-speech). Speak, then pause 1–2 seconds.
3. **Wait for assistant** — Status should change from “Waiting for assistant to join…” to “I'm listening…”. If you get an error after ~25s, check Conversational AI + provider keys in Agora Console.
4. **Vercel env vars** — All five required Agora variables must be set; redeploy after changes.
5. **Speaker / volume** — Turn phone volume up; on iOS, disable silent mode. If prompted, tap the mic again to unlock speaker audio.
6. **Redeploy** — Pull latest `main` (includes fix for subscribing to the agent already in the channel).

## License

Private — configure per your project.
