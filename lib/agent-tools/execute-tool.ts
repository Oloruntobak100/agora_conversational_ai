import { dispatchN8nWorkflow } from "./dispatch-n8n";
import { endConversationSession } from "./end-conversation";
import { formatToolResultForMcp } from "./n8n-response";
import {
  formatSessionFieldsForAgent,
  gateSendEmailWorkflow,
  isSendEmailIntent,
  mergeSendEmailArgs,
} from "@/lib/send-email-workflow";
import { resolveSessionChannel } from "@/lib/resolve-session-channel";
import {
  confirmSessionEmail,
  confirmSessionEmailContent,
  setSessionEmailContent,
} from "@/lib/session-fields";
import { getSessionToolContext } from "@/lib/session-tool-context";
import { pushToolBranchEvent } from "@/lib/session-tool-events";
import {
  buildToolBranchEvent,
  resolveWorkflowIntent,
} from "@/lib/tool-branch-event";
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

  if (tool === "get_session_fields") {
    const channel = resolveSessionChannel(request.args, request);
    if (!channel) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Missing channel_name. Pass the session channel_name from the system prompt.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: await formatSessionFieldsForAgent(channel),
        },
      ],
    };
  }

  if (tool === "confirm_session_email") {
    const channel = resolveSessionChannel(request.args, request);
    if (!channel) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Missing channel_name. Pass the session channel_name from the system prompt.",
          },
        ],
      };
    }

    const ok = await confirmSessionEmail(channel);
    if (!ok) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "No email submitted yet. Ask the user to complete the on-screen email form first.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: "Email address confirmed. Ask the user what the email should say, then use set_email_content before sending.",
        },
      ],
    };
  }

  if (tool === "set_email_content") {
    const channel = resolveSessionChannel(request.args, request);
    if (!channel) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Missing channel_name. Pass the session channel_name from the system prompt.",
          },
        ],
      };
    }

    const subject =
      typeof request.args?.subject === "string"
        ? request.args.subject.trim()
        : "";
    const body =
      typeof request.args?.body === "string"
        ? request.args.body.trim()
        : typeof request.args?.message === "string"
          ? request.args.message.trim()
          : "";

    if (!subject || !body) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "subject and body are required (non-empty strings).",
          },
        ],
      };
    }

    const saved = await setSessionEmailContent(channel, subject, body);
    if (!saved) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Confirm the recipient email first (confirm_session_email), then set_email_content.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: await formatSessionFieldsForAgent(channel),
        },
      ],
    };
  }

  if (tool === "confirm_email_content") {
    const channel = resolveSessionChannel(request.args, request);
    if (!channel) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Missing channel_name. Pass the session channel_name from the system prompt.",
          },
        ],
      };
    }

    const ok = await confirmSessionEmailContent(channel);
    if (!ok) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "No subject and body saved yet. Call set_email_content first, then confirm_email_content.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: "Subject and body confirmed. Call invoke_workflow with intent send_email to send.",
        },
      ],
    };
  }

  if (tool === "invoke_workflow") {
    const session = resolveSessionIds(request.args, request);
    const intent = resolveWorkflowIntent(request.args);

    const workflowChannel =
      session?.channel ?? resolveSessionChannel(request.args, request);

    if (workflowChannel && isSendEmailIntent(intent)) {
      const gate = await gateSendEmailWorkflow(workflowChannel);
      if (!gate.allowed) {
        return {
          isError: true,
          content: [{ type: "text", text: gate.message }],
        };
      }
      request = {
        ...request,
        args: await mergeSendEmailArgs(request.args, workflowChannel),
      };
    }

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
    const resolvedIntent = resolveWorkflowIntent(request.args);

    if (workflowChannel) {
      const display = buildToolBranchEvent(parsed, {
        fallbackBranch: workflowKey,
        intent: resolvedIntent,
      });
      await pushToolBranchEvent(workflowChannel, display);
      console.info("[invoke_workflow]", {
        channel: workflowChannel,
        branch: display.branch,
        label: display.label,
      });
    }

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
