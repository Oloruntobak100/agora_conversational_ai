import { z } from "zod";

const serverEnvSchema = z.object({
  AGORA_APP_ID: z.string().min(1),
  AGORA_APP_CERTIFICATE: z.string().min(1),
  AGORA_CUSTOMER_ID: z.string().min(1),
  AGORA_CUSTOMER_SECRET: z.string().min(1),
  AGORA_CONVERSATIONAL_AI_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : "https://api.agora.io")),
  AGORA_AGENT_PRESET: z.string().optional(),
  AGENT_SYSTEM_PROMPT: z.string().optional(),
  AGENT_GREETING_MESSAGE: z.string().optional(),
  SESSION_IDLE_TIMEOUT_SEC: z.coerce.number().int().positive().default(120),
  AGENT_SESSION_MAX_MINUTES: z.coerce.number().int().positive().default(30),
  OPENAI_API_KEY: z.string().optional(),
  AGENT_LLM_MODEL: z.string().optional(),
  AGORA_ENABLE_TOOLS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  N8N_MCP_ENDPOINT: z.string().url().optional(),
  N8N_MCP_SERVER_NAME: z.string().optional(),
  N8N_TOOL_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => i.path.join("."))
      .join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return parsed.data;
}

export function getPublicAppId(): string {
  const appId =
    process.env.NEXT_PUBLIC_AGORA_APP_ID ?? process.env.AGORA_APP_ID;
  if (!appId) {
    throw new Error("NEXT_PUBLIC_AGORA_APP_ID or AGORA_APP_ID is required");
  }
  return appId;
}
