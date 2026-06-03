import { buildEmailReadBackLine, maskEmail } from "@/lib/email-utils";
import {
  buildBodyReadBackLine,
  buildFullEmailContentReadBack,
  buildSubjectReadBackLine,
} from "@/lib/email-content-readback";
import {
  getSessionFields,
  getSessionFieldsWithRetry,
  setAwaitingEmailCapture,
} from "@/lib/session-fields";

export const SEND_EMAIL_INTENT = "send_email";

export function isSendEmailIntent(intent: string | undefined): boolean {
  return intent?.trim().toLowerCase() === SEND_EMAIL_INTENT;
}

export type SendEmailGateResult =
  | { allowed: true }
  | { allowed: false; message: string };

export async function gateSendEmailWorkflow(
  channel: string,
): Promise<SendEmailGateResult> {
  const fields = await getSessionFieldsWithRetry(channel);

  if (!fields?.email) {
    await setAwaitingEmailCapture(channel);
    return {
      allowed: false,
      message:
        "Email is not captured yet. Tell the user to enter their email in the on-screen form (do not guess from voice). When they say they submitted it, call get_session_fields again before invoke_workflow send_email.",
    };
  }

  if (!fields.emailConfirmed) {
    return {
      allowed: false,
      message: `Email is pending confirmation. Read this aloud exactly once, then wait for the user: ${buildEmailReadBackLine(fields.email)}. If they confirm, call confirm_session_email with channel_name and requester_id. Do not send yet.`,
    };
  }

  if (!fields.subject?.trim() || !fields.body?.trim()) {
    return {
      allowed: false,
      message:
        'The recipient email is confirmed. Ask the user in a friendly way: "Tell me about the email — what is it for and what should it say?" Listen, then draft a concise subject and body. Call set_email_content with channel_name and requester_id, then get_session_fields and read readBackSubject and readBackBody aloud before sending.',
    };
  }

  if (!fields.contentConfirmed) {
    return {
      allowed: false,
      message: `Subject and body need confirmation. Read aloud: ${buildFullEmailContentReadBack(fields.subject, fields.body)}. If the user agrees, call confirm_email_content with channel_name and requester_id, then invoke_workflow send_email.`,
    };
  }

  return { allowed: true };
}

export async function mergeSendEmailArgs(
  args: Record<string, unknown> | undefined,
  channel: string,
): Promise<Record<string, unknown>> {
  const fields = await getSessionFields(channel);
  const base = { ...(args ?? {}) };

  const inner =
    base.args && typeof base.args === "object" && !Array.isArray(base.args)
      ? { ...(base.args as Record<string, unknown>) }
      : {};

  const channelName =
    (typeof base.channel_name === "string" && base.channel_name.trim()) ||
    channel;
  const requesterId =
    typeof base.requester_id === "string" ? base.requester_id : undefined;

  const workflowArgs: Record<string, unknown> = {
    ...inner,
    intent: SEND_EMAIL_INTENT,
  };

  if (fields?.email) {
    workflowArgs.to = fields.email;
    workflowArgs.email = fields.email;
  }
  if (fields?.subject) {
    workflowArgs.subject = fields.subject;
  }
  if (fields?.body) {
    workflowArgs.body = fields.body;
    workflowArgs.message = fields.body;
  }

  return {
    ...base,
    channel_name: channelName,
    ...(requesterId ? { requester_id: requesterId } : {}),
    intent: SEND_EMAIL_INTENT,
    args: workflowArgs,
    ...(fields?.email
      ? { to: fields.email, email: fields.email }
      : {}),
    ...(fields?.subject ? { subject: fields.subject } : {}),
    ...(fields?.body ? { body: fields.body, message: fields.body } : {}),
  };
}

export async function formatSessionFieldsForAgent(
  channel: string,
): Promise<string> {
  const fields = await getSessionFieldsWithRetry(channel);

  if (!fields?.email) {
    return JSON.stringify({
      status: "none",
      email: null,
      instruction:
        "No email on file yet. If the user says they submitted the form, call get_session_fields again in a moment. Do not ask them to re-type unless it is still empty after a retry.",
    });
  }

  if (!fields.emailConfirmed) {
    return JSON.stringify({
      status: "pending_confirmation",
      email: fields.email,
      emailMasked: maskEmail(fields.email),
      emailConfirmed: false,
      readBackLine: buildEmailReadBackLine(fields.email),
      instruction:
        "Read readBackLine aloud once and ask if the address is correct. On yes, call confirm_session_email.",
    });
  }

  if (!fields.subject?.trim() || !fields.body?.trim()) {
    return JSON.stringify({
      status: "confirmed",
      email: fields.email,
      emailMasked: maskEmail(fields.email),
      emailConfirmed: true,
      subject: null,
      body: null,
      instruction:
        'Address is confirmed. Ask: "Tell me about the email — what should it say and who is it for?" Then draft subject and body and call set_email_content.',
    });
  }

  if (!fields.contentConfirmed) {
    return JSON.stringify({
      status: "pending_content",
      email: fields.email,
      emailMasked: maskEmail(fields.email),
      emailConfirmed: true,
      subject: fields.subject,
      body: fields.body,
      readBackSubject: buildSubjectReadBackLine(fields.subject),
      readBackBody: buildBodyReadBackLine(fields.body),
      instruction:
        "Read readBackSubject and readBackBody aloud. On yes, call confirm_email_content, then invoke_workflow send_email.",
    });
  }

  return JSON.stringify({
    status: "content_confirmed",
    email: fields.email,
    emailMasked: maskEmail(fields.email),
    emailConfirmed: true,
    subject: fields.subject,
    body: fields.body,
    contentConfirmed: true,
    instruction:
      "All confirmed. Call invoke_workflow with intent send_email only (server injects to, subject, body).",
  });
}
