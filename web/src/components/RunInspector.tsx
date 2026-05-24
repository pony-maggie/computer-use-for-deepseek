import type { Run, RunEvent } from "../types";
import { buildRunReport, eventDomId, summarizeRunEvent } from "./runEventView";

type Props = {
  run: Run | null;
  events: RunEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: RunEvent) => void;
};

export function RunInspector({ run, events, selectedEventId, onSelectEvent }: Props) {
  const selected =
    events.find((event, index) => eventDomId(event, index) === selectedEventId) ??
    events[events.length - 1] ??
    null;
  const report = buildRunReport(run, events);

  return (
    <section className="panel run-inspector">
      <div className="inspector-column">
        <div className="panel-header">Audit Trail</div>
        <div className="step-timeline">
          {events.length === 0 ? (
            <div className="status-text">Run audit events will appear here.</div>
          ) : null}
          {events.map((event, index) => {
            const id = eventDomId(event, index);
            const selectedClass = selected && eventDomId(selected, index) === id ? " selected" : "";
            return (
              <button
                key={id}
                type="button"
                className={`step-card${selectedClass}`}
                aria-label={summarizeRunEvent(event)}
                onClick={() => onSelectEvent(event)}
              >
                <span className="step-card-topline">
                  <span className={`step-status ${event.status ?? "completed"}`}>
                    {event.status ?? "completed"}
                  </span>
                  {event.step ? <span>Step {event.step}</span> : null}
                </span>
                <strong>{summarizeRunEvent(event)}</strong>
                <span className="step-message">{event.message}</span>
                {event.screenshot?.base64 ? (
                  <img
                    alt=""
                    src={`data:${event.screenshot.mime_type};base64,${event.screenshot.base64}`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="inspector-column">
        <div className="panel-header">Step Details</div>
        <div className="step-details">
          {selected ? (
            <pre>{JSON.stringify(selected, null, 2)}</pre>
          ) : (
            <div className="status-text">Select a step to inspect it.</div>
          )}
        </div>
      </div>
      <div className="run-report">
        <div className="panel-header">Run Report</div>
        <dl>
          <dt>Steps</dt>
          <dd>{report.steps}</dd>
          <dt>Tokens</dt>
          <dd>{report.totalTokens}</dd>
          <dt>Cost</dt>
          <dd>${report.estimatedCostUsd.toFixed(4)}</dd>
          <dt>Screenshots</dt>
          <dd>{report.screenshotCount}</dd>
          <dt>Cache hits</dt>
          <dd>{report.promptCacheHitTokens}</dd>
          <dt>Errors</dt>
          <dd>{report.errorCount}</dd>
        </dl>
        {report.finalText ? <p>{report.finalText}</p> : null}
      </div>
    </section>
  );
}
