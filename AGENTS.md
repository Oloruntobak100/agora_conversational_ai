# Agent Guide

Use this file as the primary agent-facing guide for `agora-convoai-quickstart-nextjs`.

## Start Here

- Read [README.md](./README.md) for setup, commands, verification, and deployment.
- Use [DOCS/N8N_TOOLS.md](./DOCS/N8N_TOOLS.md) for MCP + n8n tool bridge setup.
- Use [DOCS/WEBHOOKS.md](./DOCS/WEBHOOKS.md) for Agora Console webhook ingestion.

## Current System Shape

- Next.js 16 App Router with React 19 and TypeScript
- Browser RTC via `agora-rtc-react`
- RTM transcripts via `agora-rtm`
- Transcript/runtime helpers via `agora-agent-client-toolkit`
- Shared UI primitives via `agora-agent-uikit`
- Token and agent lifecycle routes inside `app/api`

## Key Files

- `app/api/generate-agora-token/route.ts`: RTC + RTM token generation
- `app/api/invite-agent/route.ts`: managed agent session startup
- `app/api/stop-conversation/route.ts`: agent shutdown
- `app/api/mcp/route.ts`: Streamable HTTP MCP (must be public HTTPS for Agora cloud)
- `app/api/tools/route.ts`: direct tool execution for curl/Postman tests
- `app/api/webhooks/agora/route.ts`: Agora Console notifications (signature verified)
- `lib/invite-agent-pipeline.ts`: agent prompt, VAD, silence/filler, MCP wiring
- `lib/agent-tools/`: `invoke_workflow`, `end_conversation`, n8n dispatch
- `lib/publish-rtm-signal.ts`: server RTM `nexora.session` end signal
- `components/LandingPage.tsx`: session bootstrap, RTM setup, provider wiring
- `components/ConversationComponent.tsx`: RTC join, transcript flow, visualizer, renewals
- `lib/agora.ts`: shared agent UID defaults
- `env.local.example`: local environment template

## Working Rules

- Keep the RTC client creation StrictMode-safe with `useRef`, not `useMemo`.
- Keep the token route on `RtcTokenBuilder.buildTokenWithRtm`.
- Keep transcript UID remapping aligned with the toolkit sentinel behavior.
- MCP endpoint must be reachable on **public HTTPS** (`NEXORA_MCP_PUBLIC_URL` or `VERCEL_URL`); localhost does not work for cloud tool calls.
- Tools are gated by `AGORA_ENABLE_TOOLS=true` and a resolvable MCP public URL; default is tools off.
- Keep README, `DOCS/N8N_TOOLS.md`, and `DOCS/WEBHOOKS.md` aligned with implementation changes.

## Commands

```bash
pnpm install
pnpm run doctor
pnpm run dev
pnpm run verify
```

Useful narrower checks:

```bash
pnpm run lint
pnpm run typecheck
pnpm run verify:api
pnpm run build
```

## Done Criteria

1. Run the narrowest relevant validation command.
2. For shipped app/runtime changes, ensure `pnpm run verify` passes.
3. Update the root README and any affected docs when workflow or architecture guidance changes.
