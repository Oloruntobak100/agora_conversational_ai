import type { ToolRequest } from "@/lib/agent-tools/types";

/** Channel id for session-field tools — does not require agent/requester in memory. */
export function resolveSessionChannel(
  args: Record<string, unknown> | undefined,
  fallback?: Partial<ToolRequest>,
): string | null {
  const channel =
    (typeof args?.channel_name === "string" && args.channel_name.trim()) ||
    (typeof args?.channel === "string" && args.channel.trim()) ||
    fallback?.channel?.trim() ||
    fallback?.sessionId?.trim();
  return channel || null;
}
