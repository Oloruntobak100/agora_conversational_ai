import { n8nToolResponseSchema, type N8nToolResponse } from "./types";

export function parseN8nToolResponse(raw: unknown): N8nToolResponse {
  const parsed = n8nToolResponseSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  if (typeof raw === "object" && raw !== null && "message" in raw) {
    return { speak: String((raw as { message: unknown }).message) };
  }

  if (typeof raw === "string") {
    return { speak: raw };
  }

  return { data: { raw } };
}

export function formatToolResultForMcp(
  response: N8nToolResponse,
  fallback?: string,
): string {
  const parts: string[] = [];
  if (response.speak) parts.push(response.speak);
  if (response.endSession) parts.push("[endSession:true]");
  if (response.data && Object.keys(response.data).length > 0) {
    parts.push(JSON.stringify(response.data));
  }
  if (parts.length === 0 && fallback) return fallback;
  return parts.join(" ") || "OK";
}
