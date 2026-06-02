export type NexoraSessionPayload = {
  object: "nexora.session";
  action: "end";
  reason?: string;
};

export function isNexoraSessionPayload(
  value: unknown,
): value is NexoraSessionPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { object?: unknown }).object === "nexora.session" &&
    (value as { action?: unknown }).action === "end"
  );
}
