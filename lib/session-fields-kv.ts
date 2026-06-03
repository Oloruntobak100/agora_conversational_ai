/**
 * Optional Upstash / Vercel KV REST store so session fields survive serverless instances.
 * Set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*).
 */

const TTL_SEC = 60 * 60;

function getKvConfig(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function isSessionFieldsKvConfigured(): boolean {
  return getKvConfig() !== null;
}

async function kvCommand(
  command: (string | number)[],
): Promise<unknown | null> {
  const cfg = getKvConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      console.warn("[session-fields-kv] command failed", res.status, command[0]);
      return null;
    }
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  } catch (error) {
    console.warn("[session-fields-kv]", error);
    return null;
  }
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await kvCommand(["GET", key]);
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kvCommand(["SET", key, JSON.stringify(value), "EX", TTL_SEC]);
}

export async function kvDel(key: string): Promise<void> {
  await kvCommand(["DEL", key]);
}
