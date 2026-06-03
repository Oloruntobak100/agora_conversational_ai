export type SessionFieldsStatus =
  | "none"
  | "awaiting_capture"
  | "pending_confirmation"
  | "confirmed";

export type SessionFieldsRecord = {
  email?: string;
  emailConfirmed: boolean;
  awaitingEmailCapture: boolean;
  subject?: string;
  updatedAt: number;
  expiresAt: number;
};
