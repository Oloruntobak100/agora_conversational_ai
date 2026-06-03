import { buildEmailReadBackLine, maskEmail } from "@/lib/email-utils";
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
      message: `Email is pending confirmation. Read this aloud exactly once, then wait for the user: ${buildEmailReadBackLine(fields.email)}. If they confirm, call confirm_session_email with channel_name and requester_id, then invoke_workflow send_email. If they want to change it, ask them to use the form again.`,
    };
  }

  return { allowed: true };
}

export async function mergeSendEmailArgs(
  args: Record<string, unknown> | undefined,
  channel: string,
): Promise<Record<string, unknown>> {
  const fields = await getSessionFields(channel);
  const merged = { ...(args ?? {}) };
  if (fields?.email) {
    merged.to = fields.email;
    merged.intent = SEND_EMAIL_INTENT;
  }
  return merged;
}

export async function formatSessionFieldsForAgent(
  channel: string,
): Promise<string> {
  const fields = await getSessionFieldsWithRetry(channel);
  const status = fields
    ? fields.emailConfirmed
      ? "confirmed"
      : fields.email
        ? "pending_confirmation"
        : fields.awaitingEmailCapture
          ? "awaiting_capture"
          : "none"
    : "none";

  if (!fields?.email) {
    return JSON.stringify({
      status,
      email: null,
      instruction:
        "No email on file yet. If the user says they submitted the form, call get_session_fields again in a moment. Do not ask them to re-type unless it is still empty after a retry.",
    });
  }

  return JSON.stringify({
    status,
    email: fields.email,
    emailMasked: maskEmail(fields.email),
    emailConfirmed: fields.emailConfirmed,
    readBackLine: buildEmailReadBackLine(fields.email),
    instruction: fields.emailConfirmed
      ? "Email is confirmed. You may call invoke_workflow with intent send_email."
      : "Read readBackLine aloud once and ask if it is correct. On yes, call confirm_session_email.",
  });
}
