import { Mic } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import type { RunAction } from "./runControlState";
import { appendRecognizedText, parseVoiceCommand } from "./voiceInput";
import { useVoiceInput } from "./useVoiceInput";

type Props = {
  onCreateRun: (task: string) => Promise<void>;
  onVoiceRunCommand: (
    action: Extract<RunAction, "start" | "pause" | "resume" | "cancel">,
  ) => Promise<string | null>;
  apiReady: boolean;
};

export function ChatPanel({ onCreateRun, onVoiceRunCommand, apiReady }: Props) {
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRunFromCurrentTask = useCallback(async () => {
    if (!task.trim() || !apiReady) {
      setError("Enter a task before creating a run.");
      return;
    }
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
  }, [apiReady, onCreateRun, task]);

  const handleVoiceRunCommand = useCallback(
    (action: Extract<RunAction, "start" | "pause" | "resume" | "cancel">) => {
      void onVoiceRunCommand(action).then((message) => {
        if (message) setError(message);
      });
    },
    [onVoiceRunCommand],
  );

  const handleRecognizedText = useCallback(
    (recognizedText: string) => {
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
        handleVoiceRunCommand("start");
        return;
      }
      if (command === "pause_run") {
        handleVoiceRunCommand("pause");
        return;
      }
      if (command === "resume_run") {
        handleVoiceRunCommand("resume");
        return;
      }
      if (command === "cancel_run") {
        handleVoiceRunCommand("cancel");
        return;
      }
      if (command === "clear_input") {
        setTask("");
        setError(null);
        return;
      }
      setTask((currentTask) => appendRecognizedText(currentTask, recognizedText));
    },
    [createRunFromCurrentTask, handleVoiceRunCommand],
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
