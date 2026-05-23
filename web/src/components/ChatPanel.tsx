import { Mic } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { interpretVoice } from "../api";
import type { VoiceInterpretation } from "../api";
import type { RunAction } from "./runControlState";
import {
  appendRecognizedText,
  getDefaultVoiceLanguage,
  parseVoiceCommand,
  speakVoiceFeedback,
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

const voiceModeStorageKey = "computer-use-voice-mode";
const voiceLanguageStorageKey = "computer-use-voice-language";

const voiceLanguageOptions = [
  { value: "zh-CN", label: "中文" },
  { value: "en-US", label: "English" },
];

function readStoredValue(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be blocked in private browsing; the UI still works.
  }
}

function formatVoiceFeedback(
  interpretation: VoiceInterpretation,
  nextTask: string,
  language: string,
): string {
  if (interpretation.message) return interpretation.message;
  const isChinese = language.toLowerCase().startsWith("zh");
  const taskPart = interpretation.task_text_delta
    ? isChinese
      ? `我理解为：${nextTask}。`
      : `I understood: ${nextTask}.`
    : "";
  const actionLabels: Record<string, string> = isChinese
    ? {
        create_run: "创建任务",
        start_run: "开始运行",
        pause_run: "暂停",
        resume_run: "继续运行",
        cancel_run: "取消任务",
        clear_input: "清空输入",
      }
    : {
        create_run: "create the run",
        start_run: "start the run",
        pause_run: "pause",
        resume_run: "resume",
        cancel_run: "cancel",
        clear_input: "clear the input",
      };
  const actionText = interpretation.actions.map((action) => actionLabels[action]).join(isChinese ? "，" : ", ");
  if (actionText) {
    return isChinese ? `${taskPart}我将${actionText}。` : `${taskPart}I will ${actionText}.`;
  }
  if (taskPart) return taskPart;
  return isChinese ? "我没有听清楚，请再说一遍。" : "I did not catch that. Please say it again.";
}

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
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(
    () => readStoredValue(voiceModeStorageKey, "off") === "on",
  );
  const [voiceLanguage, setVoiceLanguage] = useState(() =>
    readStoredValue(
      voiceLanguageStorageKey,
      getDefaultVoiceLanguage(
        typeof window === "undefined" ? undefined : window.navigator.language,
      ),
    ),
  );

  const speak = useCallback(
    (message: string) => {
      speakVoiceFeedback(message, voiceLanguage);
    },
    [voiceLanguage],
  );

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
      return message;
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
          speak(
            interpretation.message ??
              (voiceLanguage.startsWith("zh")
                ? "请手动批准或拒绝当前确认。"
                : "Please approve or reject pending confirmations manually."),
          );
          return;
        }

        if (interpretation.needs_clarification) {
          const message =
            interpretation.message ??
            (voiceLanguage.startsWith("zh")
              ? "我不确定你的意思，请再说明一下。"
              : "I am not sure what you mean. Please clarify.");
          setError(message);
          speak(message);
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
          speak(formatVoiceFeedback(interpretation, nextTask, voiceLanguage));
          return;
        }

        speak(formatVoiceFeedback(interpretation, nextTask, voiceLanguage));

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
            const message = await handleVoiceRunCommand("start");
            if (message) speak(message);
            continue;
          }
          if (action === "pause_run") {
            const message = await handleVoiceRunCommand("pause");
            if (message) speak(message);
            continue;
          }
          if (action === "resume_run") {
            const message = await handleVoiceRunCommand("resume");
            if (message) speak(message);
            continue;
          }
          if (action === "cancel_run") {
            const message = await handleVoiceRunCommand("cancel");
            if (message) speak(message);
          }
        }
      } catch {
        const command = parseVoiceCommand(recognizedText);
        if (command === "manual_confirmation_required") {
          setError("Please approve or reject pending confirmations manually.");
          speak(
            voiceLanguage.startsWith("zh")
              ? "请手动批准或拒绝当前确认。"
              : "Please approve or reject pending confirmations manually.",
          );
          return;
        }
        if (command === "create_run") {
          speak(voiceLanguage.startsWith("zh") ? "我将创建任务。" : "I will create the run.");
          void createRunFromCurrentTask();
          return;
        }
        if (command === "start_run") {
          speak(voiceLanguage.startsWith("zh") ? "我将开始运行。" : "I will start the run.");
          void handleVoiceRunCommand("start");
          return;
        }
        if (command === "pause_run") {
          speak(voiceLanguage.startsWith("zh") ? "我将暂停。" : "I will pause.");
          void handleVoiceRunCommand("pause");
          return;
        }
        if (command === "resume_run") {
          speak(voiceLanguage.startsWith("zh") ? "我将继续运行。" : "I will resume.");
          void handleVoiceRunCommand("resume");
          return;
        }
        if (command === "cancel_run") {
          speak(voiceLanguage.startsWith("zh") ? "我将取消任务。" : "I will cancel the run.");
          void handleVoiceRunCommand("cancel");
          return;
        }
        if (command === "clear_input") {
          setTask("");
          setError(null);
          speak(voiceLanguage.startsWith("zh") ? "已清空输入。" : "Input cleared.");
          return;
        }
        setTask((currentTask) => appendRecognizedText(currentTask, recognizedText));
        speak(
          voiceLanguage.startsWith("zh")
            ? `我理解为：${recognizedText}`
            : `I understood: ${recognizedText}`,
        );
      }
    },
    [
      createRunFromCurrentTask,
      handleVoiceRunCommand,
      hasPendingConfirmation,
      runStatus,
      speak,
      task,
      voiceLanguage,
    ],
  );
  const voiceInput = useVoiceInput({
    active: voiceModeEnabled,
    lang: voiceLanguage,
    onText: handleRecognizedText,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await createRunFromCurrentTask();
  }

  function toggleVoiceMode() {
    setVoiceModeEnabled((current) => {
      const next = !current;
      writeStoredValue(voiceModeStorageKey, next ? "on" : "off");
      return next;
    });
  }

  function updateVoiceLanguage(language: string) {
    setVoiceLanguage(language);
    writeStoredValue(voiceLanguageStorageKey, language);
  }

  const voiceStatus =
    voiceInput.status === "listening"
      ? voiceModeEnabled
        ? "Voice mode is listening..."
        : "Listening..."
      : voiceInput.status === "transcribing"
        ? "Transcribing..."
        : voiceInput.error;

  return (
    <form className="panel chat-panel" onSubmit={submit}>
      <div className="task-header">
        <label htmlFor="task">Task</label>
        <div className="voice-controls">
          <label className="sr-only" htmlFor="voice-language">
            Voice language
          </label>
          <select
            id="voice-language"
            value={voiceLanguage}
            aria-label="Voice language"
            onChange={(event) => updateVoiceLanguage(event.target.value)}
          >
            {voiceLanguageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`icon-button voice-button ${voiceModeEnabled ? "active" : ""}`}
            disabled={!voiceInput.supported}
            aria-label={voiceModeEnabled ? "Turn voice mode off" : "Turn voice mode on"}
            title={voiceInput.supported ? "Toggle voice mode" : "Voice input is unavailable"}
            onClick={toggleVoiceMode}
          >
            <Mic size={16} aria-hidden="true" />
            <span>{voiceModeEnabled ? "Voice On" : "Voice"}</span>
          </button>
        </div>
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
