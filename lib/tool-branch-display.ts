const BRANCH_ICONS: Record<string, string> = {
  send_email: "✉️",
  email: "✉️",
  lookup_order: "📦",
  order: "📦",
  book_appointment: "📅",
  booking: "📅",
  crm: "👤",
  search: "🔍",
  default: "⚡",
};

export function formatBranchLabel(branch: string): string {
  return branch
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function defaultIconForBranch(branch: string): string {
  const key = branch.trim().toLowerCase();
  return BRANCH_ICONS[key] ?? BRANCH_ICONS.default;
}

export function defaultToolCalledLabel(branch: string): string {
  return `${formatBranchLabel(branch)} tool called`;
}

export function defaultWorkflowSuccessLabel(branch: string): string {
  const key = branch.trim().toLowerCase();
  if (key === "send_email" || key === "email") return "Email sent successfully";
  if (key === "lookup_order" || key === "order") return "Order lookup complete";
  if (key === "book_appointment" || key === "booking") {
    return "Booking workflow complete";
  }
  return `${formatBranchLabel(branch)} complete`;
}
