import { useEffect, useState } from "react";
import type { Run } from "../types";
import { useI18n } from "../i18n";
import { ApprovalPreview } from "./ApprovalPreview";
import { getRunControlState, type RunAction } from "./runControlState";

type Props = {
  runId: string | null;
  status: string;
  run: Run | null;
  pendingAction: RunAction | null;
  error?: string | null;
  onStart: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
};

export function RunControls({
  runId,
  status,
  run,
  pendingAction,
  error,
  onStart,
  onPause,
  onResume,
  onCancel,
  onApprove,
  onReject,
}: Props) {
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  const controls = getRunControlState(status, Boolean(runId), pendingAction);
  const activityText = getActivityText(run, status, pendingAction, now, t);
  const pendingLabels: Record<RunAction, string> = {
    start: t("run.pendingStart"),
    pause: t("run.pendingPause"),
    resume: t("run.pendingResume"),
    cancel: t("run.pendingCancel"),
    approve: t("run.pendingApprove"),
    reject: t("run.pendingReject"),
  };

  useEffect(() => {
    if (status !== "running") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  return (
    <section className="panel run-controls">
      <div className="run-summary">
        <span className="eyebrow">{t("run.current")}</span>
        <span>{runId ?? t("run.none")}</span>
        <strong>{status}</strong>
        {pendingAction ? <span className="pending-text">{pendingLabels[pendingAction]}</span> : null}
        {activityText ? <span className="activity-text">{activityText}</span> : null}
      </div>
      {run ? (
        <span className="usage-summary">
          {run.model} · {run.steps}/{run.max_steps} steps · {run.total_tokens}/
          {run.token_budget} tokens · cache {run.prompt_cache_hit_tokens}/
          {run.prompt_cache_miss_tokens} · ${run.estimated_cost_usd.toFixed(4)}
          {run.cost_budget_usd > 0 ? `/${run.cost_budget_usd.toFixed(4)}` : ""}
        </span>
      ) : null}
      {run?.task ? (
            <div className="current-task">
              <span className="eyebrow">{t("run.currentTask")}</span>
              <p>{run.task}</p>
            </div>
      ) : null}
      {error ? <div className="error-text run-action-error">{error}</div> : null}
      <button disabled={!controls.canStart} onClick={() => void onStart()}>
        {pendingAction === "start" ? t("run.starting") : t("run.start")}
      </button>
      <button disabled={!controls.canPause} onClick={() => void onPause()}>
        {pendingAction === "pause" ? t("run.pausing") : t("run.pause")}
      </button>
      <button disabled={!controls.canResume} onClick={() => void onResume()}>
        {pendingAction === "resume" ? t("run.resuming") : t("run.resume")}
      </button>
      <button disabled={!controls.canCancel} onClick={() => void onCancel()}>
        {pendingAction === "cancel" ? t("run.canceling") : t("run.cancel")}
      </button>
      {run?.pending_confirmation_summary ? (
        <ApprovalPreview
          summary={run.pending_confirmation_summary}
          payload={run.pending_confirmation}
          canApprove={controls.canApprove}
          canReject={controls.canReject}
          approving={pendingAction === "approve"}
          rejecting={pendingAction === "reject"}
          onApprove={() => void onApprove()}
          onReject={() => void onReject()}
        />
      ) : null}
    </section>
  );
}

function getActivityText(
  run: Run | null,
  status: string,
  pendingAction: RunAction | null,
  now: number,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!run || pendingAction || status !== "running") return null;

  const updatedAt = run.updated_at ? Date.parse(run.updated_at) : NaN;
  const elapsedSeconds = Number.isNaN(updatedAt)
    ? null
    : Math.max(0, Math.floor((now - updatedAt) / 1000));
  const elapsed = elapsedSeconds === null ? "" : ` ${formatDuration(elapsedSeconds)}`;
  const phase = run.steps === 0 ? t("run.waitingFirst") : t("run.waitingNext");
  return `${t("run.working")}${elapsed}. ${phase}`;
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
