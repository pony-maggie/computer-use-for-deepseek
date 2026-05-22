export type VoiceInputStatus = "idle" | "listening" | "transcribing" | "error";

export type VoiceCommand =
  | "create_run"
  | "start_run"
  | "pause_run"
  | "resume_run"
  | "cancel_run"
  | "clear_input"
  | "manual_confirmation_required";

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: {
      transcript?: string;
    };
  }>;
};

export type SpeechRecognitionErrorEventLike = {
  error?: string;
};

export type SpeechRecognitionWindow = {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

export function appendRecognizedText(currentTask: string, recognizedText: string): string {
  const normalizedText = recognizedText.trim();
  if (!normalizedText) return currentTask;
  const normalizedCurrent = currentTask.trimEnd();
  if (!normalizedCurrent) return normalizedText;
  return `${normalizedCurrent} ${normalizedText}`;
}

export function getDefaultVoiceLanguage(preferredLanguage?: string): string {
  const language = (preferredLanguage ?? "").trim().toLowerCase();
  if (language.startsWith("zh")) {
    return "zh-CN";
  }
  return "en-US";
}

const voiceCommandPhrases: Record<string, VoiceCommand> = {
  "创建任务": "create_run",
  "创建 run": "create_run",
  "create run": "create_run",
  "开始运行": "start_run",
  "启动任务": "start_run",
  "start run": "start_run",
  暂停: "pause_run",
  pause: "pause_run",
  继续: "resume_run",
  继续运行: "resume_run",
  resume: "resume_run",
  取消: "cancel_run",
  取消任务: "cancel_run",
  cancel: "cancel_run",
  清空输入: "clear_input",
  清空: "clear_input",
  "clear input": "clear_input",
  批准: "manual_confirmation_required",
  同意: "manual_confirmation_required",
  approve: "manual_confirmation_required",
  拒绝: "manual_confirmation_required",
  reject: "manual_confirmation_required",
};

export function parseVoiceCommand(recognizedText: string): VoiceCommand | null {
  const normalized = recognizedText.trim().toLowerCase().replace(/\s+/g, " ");
  return voiceCommandPhrases[normalized] ?? null;
}

export function getSpeechRecognitionConstructor(
  source: SpeechRecognitionWindow,
): BrowserSpeechRecognitionConstructor | null {
  return source.SpeechRecognition ?? source.webkitSpeechRecognition ?? null;
}

export function mapSpeechRecognitionError(error: string | undefined): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone permission was denied. Enable microphone access and try again.";
  }
  if (error === "no-speech") {
    return "No speech was detected. Try again.";
  }
  if (error === "aborted") {
    return "Speech recognition was interrupted. Try again when you are ready.";
  }
  return "Speech recognition failed. You can keep typing manually.";
}
