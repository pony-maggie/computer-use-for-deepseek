const activeStatuses = new Set(["created", "running", "waiting_for_confirmation", "paused"]);

export type RunAction = "start" | "pause" | "resume" | "cancel" | "approve" | "reject";

export function getRunControlState(status: string, hasRun: boolean, pendingAction: RunAction | null = null) {
  if (pendingAction) {
    return {
      canStart: false,
      canPause: false,
      canResume: false,
      canCancel: false,
      canApprove: false,
      canReject: false,
    };
  }

  return {
    canStart: hasRun && status === "created",
    canPause: hasRun && (status === "running" || status === "waiting_for_confirmation"),
    canResume: hasRun && status === "paused",
    canCancel: hasRun && activeStatuses.has(status),
    canApprove: hasRun && status === "waiting_for_confirmation",
    canReject: hasRun && status === "waiting_for_confirmation",
  };
}
