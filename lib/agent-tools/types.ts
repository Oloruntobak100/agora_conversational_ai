import { z } from "zod";

export const toolRequestSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
  turnId: z.union([z.string(), z.number()]).optional(),
  channel: z.string().optional(),
  requesterId: z.string().optional(),
  agentId: z.string().optional(),
});

export type ToolRequest = z.infer<typeof toolRequestSchema>;

export const n8nToolResponseSchema = z.object({
  speak: z.string().optional(),
  endSession: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type N8nToolResponse = z.infer<typeof n8nToolResponseSchema>;

export type ToolExecutionResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};
