import { useEffect, useState } from "react";
import {
  approveRun,
  cancelRun,
  createRun,
  getApiHealth,
  getRun,
  listEvents,
  listRuns,
  pauseRun,
  rejectRun,
  resumeRun,
  startRun,
} from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { ComputerPanel } from "./components/ComputerPanel";
import { RunControls } from "./components/RunControls";
import { RunHistoryPanel } from "./components/RunHistoryPanel";
import { Timeline } from "./components/Timeline";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { getRunControlState, type RunAction } from "./components/runControlState";
import type { Run, RunEvent, RunHistoryItem } from "./types";
import "./styles.css";

const pollingStatuses = new Set(["created", "running", "waiting_for_confirmation", "paused"]);

export default function App() {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [finalText, setFinalText] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
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
    if (!apiReady) return;

    let active = true;

    async function refreshHistory() {
      try {
        const updatedHistory = await listRuns();
        if (active) setHistory(updatedHistory);
      } catch {
        // Keep the visible history stable while the API is temporarily unavailable.
      }
    }

    void refreshHistory();
    return () => {
      active = false;
    };
  }, [apiReady]);

  useEffect(() => {
    if (!runId || !pollingStatuses.has(status)) return;

    let active = true;

    async function refreshRunState() {
      try {
        const [updatedRun, updatedEvents, updatedHistory] = await Promise.all([
          getRun(runId!),
          listEvents(runId!),
          listRuns(),
        ]);
        if (!active) return;
        setRun(updatedRun);
        setStatus(updatedRun.status);
        setFinalText(updatedRun.final_text ?? null);
        setEvents(updatedEvents);
        setHistory(updatedHistory);
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
    const [createdEvents, updatedHistory] = await Promise.all([
      listEvents(createdRun.run_id),
      listRuns(),
    ]);
    setEvents(createdEvents);
    setHistory(updatedHistory);
  }

  async function updateRun(actionName: RunAction, action: (runId: string) => Promise<Run>) {
    if (!runId) return;
    setPendingRunAction(actionName);
    try {
      const updatedRun = await action(runId);
      setRun(updatedRun);
      setStatus(updatedRun.status);
      setFinalText(updatedRun.final_text ?? null);
      const [updatedEvents, updatedHistory] = await Promise.all([listEvents(runId), listRuns()]);
      setEvents(updatedEvents);
      setHistory(updatedHistory);
    } finally {
      setPendingRunAction(null);
    }
  }

  async function onVoiceRunCommand(
    actionName: Extract<RunAction, "start" | "pause" | "resume" | "cancel">,
  ): Promise<string | null> {
    if (!runId) return "Create a run before using voice run controls.";
    const controls = getRunControlState(status, Boolean(runId), pendingRunAction);
    const allowed = {
      start: controls.canStart,
      pause: controls.canPause,
      resume: controls.canResume,
      cancel: controls.canCancel,
    };
    if (!allowed[actionName]) {
      return `Voice command "${actionName}" is not available while the run is ${status}.`;
    }
    const actions = {
      start: startRun,
      pause: pauseRun,
      resume: resumeRun,
      cancel: cancelRun,
    };
    await updateRun(actionName, actions[actionName]);
    return null;
  }

  async function selectRun(selectedRunId: string) {
    const [selectedRun, selectedEvents] = await Promise.all([
      getRun(selectedRunId),
      listEvents(selectedRunId),
    ]);
    setRun(selectedRun);
    setRunId(selectedRun.run_id);
    setStatus(selectedRun.status);
    setFinalText(selectedRun.final_text ?? null);
    setEvents(selectedEvents);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>Computer Use for DeepSeek</h1>
        <ChatPanel
          onCreateRun={onCreateRun}
          onVoiceRunCommand={onVoiceRunCommand}
          apiReady={apiReady}
          runStatus={status}
          hasPendingConfirmation={status === "waiting_for_confirmation"}
        />
        <WorkspacePanel runId={runId} runStatus={status} runUpdatedAt={run?.updated_at ?? null} />
        <RunHistoryPanel history={history} activeRunId={runId} onSelectRun={(id) => void selectRun(id)} />
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
