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
import { ArtifactCenter } from "./components/ArtifactCenter";
import { AdvancedControlSuite } from "./components/AdvancedControlSuite";
import { AgentOperationsPanel } from "./components/AgentOperationsPanel";
import { ReferenceContextPanel } from "./components/ReferenceContextPanel";
import { ReplayEvaluationPanel } from "./components/ReplayEvaluationPanel";
import { RunControls } from "./components/RunControls";
import { RunHistoryPanel } from "./components/RunHistoryPanel";
import { RunInspector } from "./components/RunInspector";
import { TaskTemplatesPanel, type TaskTemplate } from "./components/TaskTemplatesPanel";
import { WorkspacePanel } from "./components/WorkspacePanel";
import {
  defaultControlProfile,
  formatExecutionProfile,
  stripExecutionBlocks,
  type ControlProfile,
  type ScenarioPack,
} from "./components/advancedControls";
import { getRunControlState, type RunAction } from "./components/runControlState";
import { createOverlayModel } from "./components/runEventView";
import { LanguageSwitcher, useI18n } from "./i18n";
import type { Run, RunEvent, RunHistoryItem } from "./types";
import "./styles.css";

const pollingStatuses = new Set(["created", "running", "waiting_for_confirmation", "paused"]);

export default function App() {
  const { t, locale } = useI18n();
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [finalText, setFinalText] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RunEvent | null>(null);
  const [history, setHistory] = useState<RunHistoryItem[]>([]);
  const [pendingRunAction, setPendingRunAction] = useState<RunAction | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [referenceContext, setReferenceContext] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [taskDraftRevision, setTaskDraftRevision] = useState(0);
  const [controlProfile, setControlProfile] = useState<ControlProfile>(defaultControlProfile);
  const [runActionError, setRunActionError] = useState<string | null>(null);

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
        setSelectedEvent((current) => current ?? updatedEvents[updatedEvents.length - 1] ?? null);
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
    const createdRun = await createRun(
      buildTaskWithRunContext(task, referenceContext, controlProfile),
    );
    setRun(createdRun);
    setRunId(createdRun.run_id);
    setStatus(createdRun.status);
    setFinalText(createdRun.final_text ?? null);
    setSelectedEvent(null);
    const [createdEvents, updatedHistory] = await Promise.all([
      listEvents(createdRun.run_id),
      listRuns(),
    ]);
    setEvents(createdEvents);
    setSelectedEvent(createdEvents[createdEvents.length - 1] ?? null);
    setHistory(updatedHistory);
  }

  async function updateRun(actionName: RunAction, action: (runId: string) => Promise<Run>) {
    if (!runId) return;
    setPendingRunAction(actionName);
    setRunActionError(null);
    try {
      const updatedRun = await action(runId);
      setRun(updatedRun);
      setStatus(updatedRun.status);
      setFinalText(updatedRun.final_text ?? null);
      const [updatedEvents, updatedHistory] = await Promise.all([listEvents(runId), listRuns()]);
      setEvents(updatedEvents);
      setSelectedEvent(updatedEvents[updatedEvents.length - 1] ?? null);
      setHistory(updatedHistory);
    } catch (err) {
      setRunActionError(err instanceof Error ? err.message : `${t("app.failedRunAction")}: ${actionName}`);
      try {
        const [updatedRun, updatedEvents, updatedHistory] = await Promise.all([
          getRun(runId),
          listEvents(runId),
          listRuns(),
        ]);
        setRun(updatedRun);
        setStatus(updatedRun.status);
        setFinalText(updatedRun.final_text ?? null);
        setEvents(updatedEvents);
        setSelectedEvent(updatedEvents[updatedEvents.length - 1] ?? null);
        setHistory(updatedHistory);
      } catch {
        // Keep the visible state stable when a follow-up refresh also fails.
      }
    } finally {
      setPendingRunAction(null);
    }
  }

  async function onVoiceRunCommand(
    actionName: Extract<RunAction, "start" | "pause" | "resume" | "cancel">,
  ): Promise<string | null> {
    if (!runId) return t("app.voiceRunRequired");
    const controls = getRunControlState(status, Boolean(runId), pendingRunAction);
    const allowed = {
      start: controls.canStart,
      pause: controls.canPause,
      resume: controls.canResume,
      cancel: controls.canCancel,
    };
    if (!allowed[actionName]) {
      return `${t("app.voiceCommandUnavailable")} (${actionName}, ${status})`;
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
    setSelectedEvent(selectedEvents[selectedEvents.length - 1] ?? null);
  }

  const activeEvent = selectedEvent ?? events[events.length - 1] ?? null;

  function selectTemplate(template: TaskTemplate) {
    updateTaskDraft(`${template.task}\n\n${taskScaffold(locale)}`);
  }

  function replayTask(task: string) {
    updateTaskDraft(stripExecutionBlocks(task));
  }

  function applyScenario(scenario: ScenarioPack) {
    setControlProfile((current) => ({ ...current, mode: scenario.recommendedMode }));
    updateTaskDraft(`${scenario.task}\n\n${taskScaffold(locale)}`);
  }

  function updateTaskDraft(nextTask: string) {
    setTaskDraft(nextTask);
    setTaskDraftRevision((current) => current + 1);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar setup-rail">
        <h1>{t("app.title")}</h1>
        <LanguageSwitcher />
        <ChatPanel
          onCreateRun={onCreateRun}
          onVoiceRunCommand={onVoiceRunCommand}
          apiReady={apiReady}
          runStatus={status}
          hasPendingConfirmation={status === "waiting_for_confirmation"}
          taskDraft={taskDraft}
          taskDraftRevision={taskDraftRevision}
        />
        <TaskTemplatesPanel onSelectTemplate={selectTemplate} />
        <AdvancedControlSuite
          profile={controlProfile}
          onProfileChange={setControlProfile}
          onApplyScenario={applyScenario}
        />
        <ReferenceContextPanel
          onContextChange={(context) => {
            setReferenceContext(context);
          }}
        />
        <WorkspacePanel runId={runId} runStatus={status} runUpdatedAt={run?.updated_at ?? null} />
      </aside>

      <section className="sandbox-stage" aria-label="Sandbox computer stage">
        <ComputerPanel overlay={createOverlayModel(activeEvent)} />
      </section>

      <aside className="inspector-rail" aria-label="Run inspector">
        <RunControls
          runId={runId}
          status={status}
          run={run}
          pendingAction={pendingRunAction}
          error={runActionError}
          onStart={() => updateRun("start", startRun)}
          onPause={() => updateRun("pause", pauseRun)}
          onResume={() => updateRun("resume", resumeRun)}
          onCancel={() => updateRun("cancel", cancelRun)}
          onApprove={() => updateRun("approve", approveRun)}
          onReject={() => updateRun("reject", rejectRun)}
        />
        <RunHistoryPanel history={history} activeRunId={runId} onSelectRun={(id) => void selectRun(id)} />
        <ReplayEvaluationPanel history={history} activeRunId={runId} onReplayTask={replayTask} />
        <RunInspector
          run={run}
          events={events}
          selectedEventId={activeEvent?.id ?? null}
          onSelectEvent={setSelectedEvent}
        />
        <AgentOperationsPanel
          run={run}
          events={events}
          activeEvent={activeEvent}
          profile={controlProfile}
        />
        <ArtifactCenter run={run} events={events} />
      </aside>
    </main>
  );
}

function buildTaskWithRunContext(
  task: string,
  referenceContext: string,
  controlProfile: ControlProfile,
) {
  const trimmedTask = task.trim();
  const executionProfile = formatExecutionProfile(controlProfile);
  if (!referenceContext.trim()) return `${trimmedTask}${executionProfile}`;
  return `${trimmedTask}${executionProfile}${referenceContext}`;
}

function taskScaffold(locale: string) {
  return locale === "zh-CN" ? "目标：\n输出：\n约束：" : "Target:\nOutput:\nConstraints:";
}
