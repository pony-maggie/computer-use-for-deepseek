import { Mic } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { interpretVoice } from "../api";
import type { RunAction } from "./runControlState";
import {
  appendRecognizedText,
  getDefaultVoiceLanguage,
  parseVoiceCommand,
} from "./voiceInput";
import { useVoiceInput } from "./useVoiceInput";

type Props = {
  onCreateRun: (task: string) => Promise<void>;
  onVoiceRunCommand: (
    action: Extract<RunAction, "start" | "pause" | "resume" | "cancel">,
  ) => Promise<string | null>;
  apiReady: boolean;
  runStatus: string;
  hasPendingConfirmation: boolean;
};

export function ChatPanel({
  onCreateRun,
  onVoiceRunCommand,
  apiReady,
  runStatus,
  hasPendingConfirmation,
}: Props) {
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRunFromCurrentTask = useCallback(
    async (taskText = task) => {
      if (!taskText.trim() || !apiReady) {
        setError("Enter a task before creating a run.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await onCreateRun(taskText.trim());
        setTask("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create run");
      } finally {
        setBusy(false);
      }
    },
    [apiReady, onCreateRun, task],
  );

  const handleVoiceRunCommand = useCallback(
    async (action: Extract<RunAction, "start" | "pause" | "resume" | "cancel">) => {
      const message = await onVoiceRunCommand(action);
      if (message) setError(message);
    },
    [onVoiceRunCommand],
  );

  const handleRecognizedText = useCallback(
    async (recognizedText: string) => {
      try {
        const interpretation = await interpretVoice({
          transcript: recognizedText,
          language: getDefaultVoiceLanguage(window.navigator.language),
          current_task: task,
          run_status: runStatus,
          has_pending_confirmation: hasPendingConfirmation,
        });

        if (interpretation.manual_confirmation_required) {
          setError(
            interpretation.message ?? "Please approve or reject pending confirmations manually.",
          );
          return;
        }

        const nextTask = interpretation.task_text_delta
          ? appendRecognizedText(task, interpretation.task_text_delta)
          : task;
        const shouldCreateRun = interpretation.actions.includes("create_run");

        if (!shouldCreateRun && nextTask !== task) {
          setTask(nextTask);
        }

        if (!interpretation.actions.length) {
          if (nextTask !== task) setTask(nextTask);
          return;
        }

        for (const action of interpretation.actions) {
          if (action === "clear_input") {
            setTask("");
            continue;
          }
          if (action === "create_run") {
            await createRunFromCurrentTask(nextTask);
            continue;
          }
          if (action === "start_run") {
            await handleVoiceRunCommand("start");
            continue;
          }
          if (action === "pause_run") {
            await handleVoiceRunCommand("pause");
            continue;
          }
          if (action === "resume_run") {
            await handleVoiceRunCommand("resume");
            continue;
          }
          if (action === "cancel_run") {
            await handleVoiceRunCommand("cancel");
          }
        }
      } catch {
        const command = parseVoiceCommand(recognizedText);
        if (command === "manual_confirmation_required") {
          setError("Please approve or reject pending confirmations manually.");
          return;
        }
        if (command === "create_run") {
          void createRunFromCurrentTask();
          return;
        }
        if (command === "start_run") {
          void handleVoiceRunCommand("start");
          return;
        }
        if (command === "pause_run") {
          void handleVoiceRunCommand("pause");
          return;
        }
        if (command === "resume_run") {
          void handleVoiceRunCommand("resume");
          return;
        }
        if (command === "cancel_run") {
          void handleVoiceRunCommand("cancel");
          return;
        }
        if (command === "clear_input") {
          setTask("");
          setError(null);
          return;
        }
        setTask((currentTask) => appendRecognizedText(currentTask, recognizedText));
      }
    },
    [
      createRunFromCurrentTask,
      handleVoiceRunCommand,
      hasPendingConfirmation,
      runStatus,
      task,
    ],
  );
  const voiceInput = useVoiceInput({ onText: handleRecognizedText });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await createRunFromCurrentTask();
  }

  const voiceStatus =
    voiceInput.status === "listening"
      ? "Listening..."
      : voiceInput.status === "transcribing"
        ? "Transcribing..."
        : voiceInput.error;

  return (
    <form className="panel chat-panel" onSubmit={submit}>
      <div className="task-header">
        <label htmlFor="task">Task</label>
        <button
          type="button"
          className="icon-button voice-button"
          disabled={!voiceInput.supported || voiceInput.status === "listening"}
          aria-label="Start voice input"
          title={voiceInput.supported ? "Start voice input" : "Voice input is unavailable"}
          onClick={voiceInput.startListening}
        >
          <Mic size={16} aria-hidden="true" />
          <span>Voice</span>
        </button>
      </div>
      <textarea id="task" value={task} onChange={(event) => setTask(event.target.value)} />
      {voiceStatus ? (
        <div className={voiceInput.status === "error" ? "error-text" : "status-text"}>
          {voiceStatus}
        </div>
      ) : null}
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
