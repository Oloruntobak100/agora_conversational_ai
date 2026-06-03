export type SessionFieldsStatus =
  | "none"
  | "awaiting_capture"
  | "pending_confirmation"
  | "confirmed"
  | "pending_content"
  | "content_confirmed";

export type SessionFieldsRecord = {
  email?: string;
  emailConfirmed: boolean;
  awaitingEmailCapture: boolean;
  subject?: string;
  body?: string;
  contentConfirmed: boolean;
  updatedAt: number;
  expiresAt: number;
};
