import { useEffect, useState } from "react";
import {
  approveRun,
  cancelRun,
  createRun,
  getApiHealth,
  getRun,
  listEvents,
  pauseRun,
  rejectRun,
  resumeRun,
  startRun,
} from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { ComputerPanel } from "./components/ComputerPanel";
import { RunControls } from "./components/RunControls";
import { Timeline } from "./components/Timeline";
import { WorkspacePanel } from "./components/WorkspacePanel";
import type { RunAction } from "./components/runControlState";
import type { Run, RunEvent } from "./types";
import "./styles.css";

const pollingStatuses = new Set(["created", "running", "waiting_for_confirmation", "paused"]);

export default function App() {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [finalText, setFinalText] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [pendingRunAction, setPendingRunAction] = useState<RunAction | null>(null);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkApiHealth() {
      const healthy = await getApiHealth();
      if (active) setApiReady(healthy);
    }

    checkApiHealth();
    const interval = window.setInterval(checkApiHealth, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!runId || !pollingStatuses.has(status)) return;

    let active = true;

    async function refreshRunState() {
      try {
        const [updatedRun, updatedEvents] = await Promise.all([getRun(runId!), listEvents(runId!)]);
        if (!active) return;
        setRun(updatedRun);
        setStatus(updatedRun.status);
        setFinalText(updatedRun.final_text ?? null);
        setEvents(updatedEvents);
      } catch {
        // Keep the last known state; the health check already reports API reachability.
      }
    }

    const interval = window.setInterval(refreshRunState, 1500);
    void refreshRunState();
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [runId, status]);

  async function onCreateRun(task: string) {
    const createdRun = await createRun(task);
    setRun(createdRun);
    setRunId(createdRun.run_id);
    setStatus(createdRun.status);
    setFinalText(createdRun.final_text ?? null);
    setEvents(await listEvents(createdRun.run_id));
  }

  async function updateRun(actionName: RunAction, action: (runId: string) => Promise<Run>) {
    if (!runId) return;
    setPendingRunAction(actionName);
    try {
      const updatedRun = await action(runId);
      setRun(updatedRun);
      setStatus(updatedRun.status);
      setFinalText(updatedRun.final_text ?? null);
      setEvents(await listEvents(runId));
    } finally {
      setPendingRunAction(null);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>Computer Use for DeepSeek</h1>
        <ChatPanel onCreateRun={onCreateRun} apiReady={apiReady} />
        <WorkspacePanel runId={runId} runStatus={status} runUpdatedAt={run?.updated_at ?? null} />
      </aside>
      <section className="workspace">
        <RunControls
          runId={runId}
          status={status}
          run={run}
          pendingAction={pendingRunAction}
          onStart={() => updateRun("start", startRun)}
          onPause={() => updateRun("pause", pauseRun)}
          onResume={() => updateRun("resume", resumeRun)}
          onCancel={() => updateRun("cancel", cancelRun)}
          onApprove={() => updateRun("approve", approveRun)}
          onReject={() => updateRun("reject", rejectRun)}
        />
        <ComputerPanel />
        <Timeline events={events} finalText={finalText} />
      </section>
    </main>
  );
}
