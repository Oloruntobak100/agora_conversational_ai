/** Agent transcript lines that mean the in-call email form should appear. */
export function agentRequestedEmailForm(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /on-screen form/i.test(t) ||
    /type your email/i.test(t) ||
    /email form/i.test(t) ||
    /enter your email/i.test(t) ||
    /email address in the form/i.test(t) ||
    /form on your screen/i.test(t)
  );
}
