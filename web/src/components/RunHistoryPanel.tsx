import type { RunHistoryItem } from "../types";

type Props = {
  history: RunHistoryItem[];
  activeRunId: string | null;
  onSelectRun: (runId: string) => void;
};

export function RunHistoryPanel({ history, activeRunId, onSelectRun }: Props) {
  return (
    <section className="panel history-panel">
      <div className="panel-header">History</div>
      {history.length === 0 ? (
        <div className="status-text">No previous runs yet.</div>
      ) : (
        <ol className="history-list">
          {history.map((item) => (
            <li key={item.run_id}>
              <button
                type="button"
                className={item.run_id === activeRunId ? "history-item active" : "history-item"}
                aria-label={`Open ${item.run_id}`}
                onClick={() => onSelectRun(item.run_id)}
              >
                <span className="history-row">
                  <strong>{item.run_id}</strong>
                  <span>{item.status}</span>
                </span>
                <span className="history-task">{item.task}</span>
                <span className="history-time">{formatRunTime(item.updated_at)}</span>
                {item.final_text ? <span className="history-result">{item.final_text}</span> : null}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatRunTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
