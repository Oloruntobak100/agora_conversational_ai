-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
-- Stores per-channel email capture for Nexora voice sessions.

create table if not exists public.nexora_session_fields (
  channel text primary key,
  email text,
  email_confirmed boolean not null default false,
  awaiting_email_capture boolean not null default false,
  subject text,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists nexora_session_fields_expires_at_idx
  on public.nexora_session_fields (expires_at);

-- Optional: purge expired rows periodically (Supabase cron or manual).
-- delete from public.nexora_session_fields where expires_at < now();

-- In-call workflow success banners (polled by /api/tool-events)
create table if not exists public.nexora_tool_events (
  id text primary key,
  channel text not null,
  branch text not null,
  label text not null,
  icon text not null,
  created_at timestamptz not null default now()
);

create index if not exists nexora_tool_events_channel_created_idx
  on public.nexora_tool_events (channel, created_at desc);
