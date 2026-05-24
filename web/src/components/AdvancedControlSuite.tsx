import type { ControlProfile, ScenarioPack } from "./advancedControls";
import { scenarioPacks, viewportPresets } from "./advancedControls";

type Props = {
  profile: ControlProfile;
  onProfileChange: (profile: ControlProfile) => void;
  onApplyScenario: (scenario: ScenarioPack) => void;
};

const actionOptions = [
  ["allowClick", "Click"],
  ["allowType", "Type"],
  ["allowScroll", "Scroll"],
  ["allowDownload", "Download"],
  ["allowFileAccess", "File access"],
  ["allowShell", "Shell"],
] as const;

const approvalOptions = [
  ["requireApprovalForSubmits", "Submits"],
  ["requireApprovalForExternalNavigation", "External nav"],
  ["requireApprovalForDestructiveActions", "Destructive"],
] as const;

export function AdvancedControlSuite({ profile, onProfileChange, onApplyScenario }: Props) {
  function update(next: Partial<ControlProfile>) {
    onProfileChange({ ...profile, ...next });
  }

  function updatePolicy(key: keyof ControlProfile["actionPolicy"], value: boolean) {
    onProfileChange({
      ...profile,
      actionPolicy: { ...profile.actionPolicy, [key]: value },
    });
  }

  function addWorkflowNote() {
    const note = `Reuse the current procedure as a workflow step ${profile.workflowNotes.length + 1}.`;
    update({ workflowNotes: [...profile.workflowNotes, note] });
  }

  function clearWorkflowNotes() {
    update({ workflowNotes: [] });
  }

  return (
    <section className="panel advanced-control-suite">
      <div>
        <div className="panel-header">Advanced Control</div>
        <p className="status-text">
          Configure how the agent should see, act, recover, and evaluate this run.
        </p>
      </div>

      <div className="control-section">
        <span className="eyebrow">Mode</span>
        <div className="mode-grid">
          {(["browser", "computer", "hybrid"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={profile.mode === mode ? "mode-card active" : "mode-card"}
              onClick={() => update({ mode })}
            >
              <strong>{mode}</strong>
              <span>
                {mode === "browser"
                  ? "DOM and URL first"
                  : mode === "computer"
                    ? "Screenshot and UI first"
                    : "Use both paths"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">Action Policy</span>
        <div className="policy-grid">
          {actionOptions.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={profile.actionPolicy[key]}
                onChange={(event) => updatePolicy(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">Approval Queue Rules</span>
        <div className="policy-grid">
          {approvalOptions.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={profile.actionPolicy[key]}
                onChange={(event) => updatePolicy(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">Scenario Packs</span>
        <div className="scenario-list">
          {scenarioPacks.map((scenario) => (
            <button key={scenario.id} type="button" onClick={() => onApplyScenario(scenario)}>
              <strong>{scenario.label}</strong>
              <span>{scenario.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">Task Recorder</span>
        <div className="recorder-row">
          <button type="button" onClick={addWorkflowNote}>
            Add Workflow Note
          </button>
          <button type="button" onClick={clearWorkflowNotes} disabled={!profile.workflowNotes.length}>
            Clear
          </button>
        </div>
        {profile.workflowNotes.length ? (
          <ol className="workflow-notes">
            {profile.workflowNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ol>
        ) : (
          <div className="status-text">Record reusable workflow intent before creating a run.</div>
        )}
      </div>

      <div className="control-section">
        <span className="eyebrow">Viewport Lab</span>
        <div className="viewport-grid">
          {viewportPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={profile.viewportId === preset.id ? "viewport-card active" : "viewport-card"}
              onClick={() => update({ viewportId: preset.id })}
            >
              <strong>{preset.label}</strong>
              <span>
                {preset.width}x{preset.height}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
