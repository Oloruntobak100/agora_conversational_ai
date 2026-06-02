import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeAgentTool } from "@/lib/agent-tools";

const invokeWorkflowSchema = {
  channel_name: z.string().describe("RTC channel name"),
  requester_id: z.string().describe("User RTC uid"),
  workflow: z
    .string()
    .optional()
    .describe("Optional n8n route key (N8N_TOOL_ROUTES_JSON)"),
  args: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Workflow payload"),
};

const endConversationSchema = {
  channel_name: z.string(),
  requester_id: z.string(),
  reason: z.string().optional(),
};

export function createNexoraMcpServer(): McpServer {
  const server = new McpServer({
    name: "nexora",
    version: "1.0.0",
  });

  server.registerTool(
    "invoke_workflow",
    {
      description:
        "Run a Nexora n8n workflow. Always pass channel_name and requester_id from the session.",
      inputSchema: invokeWorkflowSchema,
    },
    async (args) => {
      const result = await executeAgentTool({
        tool: "invoke_workflow",
        args: args as Record<string, unknown>,
      });
      return {
        content: result.content,
        isError: result.isError,
      };
    },
  );

  server.registerTool(
    "end_conversation",
    {
      description:
        "End the voice session when the user is done or the task is complete.",
      inputSchema: endConversationSchema,
    },
    async (args) => {
      const result = await executeAgentTool({
        tool: "end_conversation",
        args: args as Record<string, unknown>,
      });
      return {
        content: result.content,
        isError: result.isError,
      };
    },
  );

  return server;
}
