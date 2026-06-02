import type { N8nToolResponse } from "@/lib/agent-tools/types";
import {
  defaultIconForBranch,
  defaultToolCalledLabel,
  formatBranchLabel,
} from "@/lib/tool-branch-display";

export function resolveWorkflowIntent(
  args: Record<string, unknown> | undefined,
): string | undefined {
  if (!args) return undefined;
  for (const key of ["intent", "action", "task", "workflow"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function buildToolBranchEvent(
  parsed: N8nToolResponse,
  options: { fallbackBranch?: string; intent?: string },
): { branch: string; label: string; icon: string } {
  const dataBranch =
    typeof parsed.data?.branch === "string" ? parsed.data.branch : undefined;
  const branch =
    parsed.branch ??
    dataBranch ??
    options.intent ??
    options.fallbackBranch ??
    "workflow";

  const label =
    parsed.toolLabel ??
    (typeof parsed.data?.toolLabel === "string"
      ? parsed.data.toolLabel
      : defaultToolCalledLabel(branch));

  const icon =
    parsed.toolIcon ??
    (typeof parsed.data?.toolIcon === "string"
      ? parsed.data.toolIcon
      : defaultIconForBranch(branch));

  return { branch, label, icon: icon || defaultIconForBranch(branch) };
}

export function branchSummaryForLog(branch: string): string {
  return formatBranchLabel(branch);
}
