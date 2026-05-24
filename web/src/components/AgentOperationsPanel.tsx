import type { Run, RunEvent } from "../types";
import { useI18n } from "../i18n";
import type { ControlProfile } from "./advancedControls";
import { getViewportPreset } from "./advancedControls";
import { summarizeRunEvent } from "./runEventView";

type Props = {
  run: Run | null;
  events: RunEvent[];
  activeEvent: RunEvent | null;
  profile: ControlProfile;
};

export function AgentOperationsPanel({ run, events, activeEvent, profile }: Props) {
  const { t } = useI18n();
  const viewport = getViewportPreset(profile.viewportId);
  const recentEvents = events.slice(-4);
  const currentUrl = extractUrl(activeEvent);
  const pendingApprovals = approvalRules(profile, t);
  const recoveryStrategies = [
    t("operations.recoverySettle"),
    t("operations.recoveryDom"),
    t("operations.recoveryRetry"),
    t("operations.recoveryStop"),
    t("operations.recoveryTakeover"),
  ];

  return (
    <section className="panel operations-panel">
      <div className="panel-header">{t("operations.header")}</div>

      <div className="operations-section">
        <span className="eyebrow">{t("operations.loop")}</span>
        <ol className="context-loop">
          <li className="active">{t("operations.loopContext")}</li>
          <li className={run?.status === "running" ? "active" : ""}>{t("operations.loopModel")}</li>
          <li className={activeEvent?.tool_name ? "active" : ""}>{t("operations.loopAction")}</li>
          <li className={events.length ? "active" : ""}>{t("operations.loopState")}</li>
        </ol>
      </div>

      <div className="operations-section">
        <span className="eyebrow">{t("operations.dom")}</span>
        <dl className="compact-dl">
          <dt>{t("operations.mode")}</dt>
          <dd>{profile.mode}</dd>
          <dt>{t("operations.viewport")}</dt>
          <dd>{viewport.width}x{viewport.height}</dd>
          <dt>{t("operations.url")}</dt>
          <dd>{currentUrl ?? t("operations.urlMissing")}</dd>
          <dt>{t("operations.domPath")}</dt>
          <dd>{profile.mode === "computer" ? t("operations.visualFirst") : t("operations.domFirst")}</dd>
        </dl>
      </div>

      <div className="operations-section">
        <span className="eyebrow">{t("operations.approvalQueue")}</span>
        {run?.pending_confirmation_summary ? (
          <div className="approval-queue-item">{run.pending_confirmation_summary}</div>
        ) : (
          <div className="status-text">{t("operations.noApprovals")}</div>
        )}
        <ul className="mini-list">
          {pendingApprovals.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      <div className="operations-section">
        <span className="eyebrow">{t("operations.recovery")}</span>
        <ul className="mini-list">
          {recoveryStrategies.map((strategy) => (
            <li key={strategy}>{strategy}</li>
          ))}
        </ul>
      </div>

      <div className="operations-section">
        <span className="eyebrow">{t("operations.recent")}</span>
        {recentEvents.length ? (
          <ul className="mini-list">
            {recentEvents.map((event, index) => (
              <li key={event.id ?? `${event.kind}-${index}`}>{summarizeRunEvent(event)}</li>
            ))}
          </ul>
        ) : (
          <div className="status-text">{t("operations.emptyRecent")}</div>
        )}
      </div>
    </section>
  );
}

function approvalRules(profile: ControlProfile, t: ReturnType<typeof useI18n>["t"]): string[] {
  return [
    profile.actionPolicy.requireApprovalForSubmits ? t("operations.submitApproval") : null,
    profile.actionPolicy.requireApprovalForExternalNavigation
      ? t("operations.externalApproval")
      : null,
    profile.actionPolicy.requireApprovalForDestructiveActions
      ? t("operations.destructiveApproval")
      : null,
  ].filter(Boolean) as string[];
}

function extractUrl(event: RunEvent | null): string | null {
  if (!event?.action_payload) return null;
  const value = event.action_payload.url ?? event.action_payload.current_url;
  return typeof value === "string" ? value : null;
}
