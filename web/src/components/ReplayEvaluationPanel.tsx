import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import type { RunHistoryItem } from "../types";

type Props = {
  history: RunHistoryItem[];
  activeRunId: string | null;
  onReplayTask: (task: string) => void;
};

const storageKey = "computer-use-benchmark-runs";

export function ReplayEvaluationPanel({ history, activeRunId, onReplayTask }: Props) {
  const { t } = useI18n();
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
      <div className="panel-header">{t("replay.header")}</div>
      {active ? (
        <>
          <div className="status-text">
            {active.status} · {formatRunTime(active.updated_at)}
          </div>
          <p>{active.task}</p>
          <div className="replay-actions">
            <button type="button" onClick={() => onReplayTask(active.task)}>
              {t("replay.replay")}
            </button>
            <button type="button" onClick={() => toggleBenchmark(active.run_id)}>
              {benchmarks.includes(active.run_id) ? t("replay.unmark") : t("replay.mark")}
            </button>
          </div>
          {benchmarks.length ? (
            <div className="benchmark-lab">
              <span className="eyebrow">{t("benchmark.header")}</span>
              <dl className="compact-dl">
                <dt>{t("benchmark.marked")}</dt>
                <dd>{benchmarks.length}</dd>
                <dt>{t("benchmark.active")}</dt>
                <dd>{active.run_id}</dd>
                <dt>{t("benchmark.status")}</dt>
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
        <div className="status-text">{t("replay.empty")}</div>
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
