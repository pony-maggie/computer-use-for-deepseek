import { FormEvent, useState } from "react";

type Props = {
  onCreateRun: (task: string) => Promise<void>;
  apiReady: boolean;
};

export function ChatPanel({ onCreateRun, apiReady }: Props) {
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!task.trim() || !apiReady) return;
    setBusy(true);
    setError(null);
    try {
      await onCreateRun(task.trim());
      setTask("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel chat-panel" onSubmit={submit}>
      <label htmlFor="task">Task</label>
      <textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} />
      {!apiReady ? (
        <div className="status-text">Backend API is starting. Create Run will be enabled when ready.</div>
      ) : null}
      {error ? <div className="error-text">{error}</div> : null}
      <button type="submit" disabled={busy || !apiReady}>
        {busy ? "Creating" : "Create Run"}
      </button>
    </form>
  );
}
