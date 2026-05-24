import { useEffect, useState } from "react";
import type { RunHistoryItem } from "../types";

type Props = {
  history: RunHistoryItem[];
  activeRunId: string | null;
  onReplayTask: (task: string) => void;
};

const storageKey = "computer-use-benchmark-runs";

export function ReplayEvaluationPanel({ history, activeRunId, onReplayTask }: Props) {
  const [benchmarks, setBenchmarks] = useState<string[]>(() => readBenchmarks());
  const active = history.find((item) => item.run_id === activeRunId) ?? history[0] ?? null;

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(benchmarks));
  }, [benchmarks]);

  function toggleBenchmark(runId: string) {
    setBenchmarks((current) =>
      current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId],
    );
  }

  return (
    <section className="panel replay-panel">
      <div className="panel-header">Replay & Eval</div>
      {active ? (
        <>
          <div className="status-text">
            {active.status} · {formatRunTime(active.updated_at)}
          </div>
          <p>{active.task}</p>
          <div className="replay-actions">
            <button type="button" onClick={() => onReplayTask(active.task)}>
              Replay Task
            </button>
            <button type="button" onClick={() => toggleBenchmark(active.run_id)}>
              {benchmarks.includes(active.run_id) ? "Unmark Benchmark" : "Mark Benchmark"}
            </button>
          </div>
          {benchmarks.length ? (
            <div className="benchmark-lab">
              <span className="eyebrow">Benchmark Lab</span>
              <dl className="compact-dl">
                <dt>Marked</dt>
                <dd>{benchmarks.length}</dd>
                <dt>Active</dt>
                <dd>{active.run_id}</dd>
                <dt>Status</dt>
                <dd>{active.status}</dd>
              </dl>
              <ul className="mini-list">
                {benchmarks.map((runId) => (
                  <li key={runId}>{runId}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="status-text">Run history will become replay candidates.</div>
      )}
    </section>
  );
}

function readBenchmarks() {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
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
