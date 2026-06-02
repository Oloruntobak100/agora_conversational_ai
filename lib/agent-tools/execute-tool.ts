import { dispatchN8nWorkflow } from "./dispatch-n8n";
import { endConversationSession } from "./end-conversation";
import { formatToolResultForMcp } from "./n8n-response";
import { getSessionToolContext } from "@/lib/session-tool-context";
import type { ToolExecutionResult, ToolRequest } from "./types";

function resolveSessionIds(
  args: Record<string, unknown> | undefined,
  fallback?: Partial<ToolRequest>,
): { channel: string; requesterId: string; agentId: string } | null {
  const channel =
    (typeof args?.channel_name === "string" && args.channel_name) ||
    (typeof args?.channel === "string" && args.channel) ||
    fallback?.channel ||
    fallback?.sessionId;

  if (!channel) return null;

  const ctx = getSessionToolContext(channel);
  const requesterId =
    (typeof args?.requester_id === "string" && args.requester_id) ||
    (typeof args?.requesterId === "string" && args.requesterId) ||
    fallback?.requesterId ||
    ctx?.requesterId;

  const agentId =
    (typeof args?.agent_id === "string" && args.agent_id) ||
    (typeof args?.agentId === "string" && args.agentId) ||
    fallback?.agentId ||
    ctx?.agentId;

  if (!requesterId || !agentId) return null;

  return { channel, requesterId, agentId };
}

export async function executeAgentTool(
  request: ToolRequest,
): Promise<ToolExecutionResult> {
  const tool = request.tool;

  if (tool === "end_conversation") {
    const session = resolveSessionIds(request.args, request);
    if (!session) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Missing channel_name / requester_id or active session context.",
          },
        ],
      };
    }

    const reason =
      typeof request.args?.reason === "string"
        ? request.args.reason
        : undefined;

    const result = await endConversationSession({
      ...session,
      reason,
    });

    if (!result.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: result.error }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: "Session ended successfully. Do not mention technical errors.",
        },
      ],
    };
  }

  if (tool === "invoke_workflow") {
    const session = resolveSessionIds(request.args, request);
    const workflowKey =
      typeof request.args?.workflow === "string"
        ? request.args.workflow
        : "invoke_workflow";
    const n8nResult = await dispatchN8nWorkflow({
      ...request,
      tool: workflowKey,
      channel: session?.channel ?? request.channel,
      requesterId: session?.requesterId ?? request.requesterId,
      agentId: session?.agentId ?? request.agentId,
    });

    if (!n8nResult.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: n8nResult.error }],
      };
    }

    const { parsed } = n8nResult;

    if (parsed.endSession && session) {
      await endConversationSession({
        ...session,
        reason: "n8n workflow requested endSession",
      });
    }

    return {
      content: [
        {
          type: "text",
          text: formatToolResultForMcp(
            parsed,
            "Workflow completed successfully.",
          ),
        },
      ],
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${tool}` }],
  };
}
