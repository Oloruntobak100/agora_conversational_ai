export type NexoraSessionSignal = {
  object: "nexora.session";
  action: "end";
  reason?: string;
};

/**
 * Server-side RTM publish is not supported (agora-rtm requires `window`).
 * The browser publishes via `publishNexoraSessionEndFromClient` on end-session.
 */
export async function publishRtmSessionEnd(options: {
  channel: string;
  reason?: string;
}): Promise<void> {
  console.info("[publish-rtm-signal] skipped on server; client publishes RTM end", {
    channel: options.channel,
    reason: options.reason,
  });
}
