import type { Run, RunEvent } from "../types";
import type { ControlProfile } from "./advancedControls";
import { getViewportPreset, recoveryStrategies } from "./advancedControls";
import { summarizeRunEvent } from "./runEventView";

type Props = {
  run: Run | null;
  events: RunEvent[];
  activeEvent: RunEvent | null;
  profile: ControlProfile;
};

export function AgentOperationsPanel({ run, events, activeEvent, profile }: Props) {
  const viewport = getViewportPreset(profile.viewportId);
  const recentEvents = events.slice(-4);
  const currentUrl = extractUrl(activeEvent);
  const pendingApprovals = approvalRules(profile);

  return (
    <section className="panel operations-panel">
      <div className="panel-header">Agent Operations</div>

      <div className="operations-section">
        <span className="eyebrow">Live Context Loop</span>
        <ol className="context-loop">
          <li className="active">Screenshot + previous context</li>
          <li className={run?.status === "running" ? "active" : ""}>Model response</li>
          <li className={activeEvent?.tool_name ? "active" : ""}>Execute action</li>
          <li className={events.length ? "active" : ""}>Capture new state</li>
        </ol>
      </div>

      <div className="operations-section">
        <span className="eyebrow">URL + DOM Inspector</span>
        <dl className="compact-dl">
          <dt>Mode</dt>
          <dd>{profile.mode}</dd>
          <dt>Viewport</dt>
          <dd>{viewport.width}x{viewport.height}</dd>
          <dt>URL</dt>
          <dd>{currentUrl ?? "Not reported by runtime yet"}</dd>
          <dt>DOM path</dt>
          <dd>{profile.mode === "computer" ? "visual-first fallback" : "DOM-first when available"}</dd>
        </dl>
      </div>

      <div className="operations-section">
        <span className="eyebrow">Approval Queue</span>
        {run?.pending_confirmation_summary ? (
          <div className="approval-queue-item">{run.pending_confirmation_summary}</div>
        ) : (
          <div className="status-text">No pending approval requests.</div>
        )}
        <ul className="mini-list">
          {pendingApprovals.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      <div className="operations-section">
        <span className="eyebrow">Self-Healing Strategy</span>
        <ul className="mini-list">
          {recoveryStrategies.map((strategy) => (
            <li key={strategy}>{strategy}</li>
          ))}
        </ul>
      </div>

      <div className="operations-section">
        <span className="eyebrow">Recent Context</span>
        {recentEvents.length ? (
          <ul className="mini-list">
            {recentEvents.map((event, index) => (
              <li key={event.id ?? `${event.kind}-${index}`}>{summarizeRunEvent(event)}</li>
            ))}
          </ul>
        ) : (
          <div className="status-text">Run events will appear here.</div>
        )}
      </div>
    </section>
  );
}

function approvalRules(profile: ControlProfile): string[] {
  return [
    profile.actionPolicy.requireApprovalForSubmits ? "Submit/publish actions require approval." : null,
    profile.actionPolicy.requireApprovalForExternalNavigation
      ? "External navigation requires approval."
      : null,
    profile.actionPolicy.requireApprovalForDestructiveActions
      ? "Destructive actions require approval."
      : null,
  ].filter(Boolean) as string[];
}

function extractUrl(event: RunEvent | null): string | null {
  if (!event?.action_payload) return null;
  const value = event.action_payload.url ?? event.action_payload.current_url;
  return typeof value === "string" ? value : null;
}
