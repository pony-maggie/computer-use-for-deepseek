import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import type {
  BrowserSpeechRecognition,
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionResultEventLike,
} from "./voiceInput";

class FakeRecognition implements BrowserSpeechRecognition {
  static latest: FakeRecognition | null = null;
  static instances: FakeRecognition[] = [];

  continuous = false;
  interimResults = true;
  lang = "en-US";
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn();

  constructor() {
    FakeRecognition.latest = this;
    FakeRecognition.instances.push(this);
  }

  emitResult(transcript: string) {
    this.onresult?.({
      results: [
        {
          isFinal: true,
          0: { transcript },
        },
      ],
    });
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeRecognition.latest = null;
  FakeRecognition.instances = [];
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "en-US",
  });
});

function stubSpeechSynthesis() {
  const speak = vi.fn();
  class FakeUtterance {
    text: string;
    lang = "";

    constructor(text: string) {
      this.text = text;
    }
  }
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return speak;
}

function taskInput() {
  return screen.getByLabelText("Task") as HTMLTextAreaElement;
}

function emitVoiceResult(transcript: string) {
  act(() => {
    FakeRecognition.latest?.emitResult(transcript);
  });
}

function mockVoiceInterpretation(response: {
  task_text_delta: string;
  actions: Array<"create_run" | "start_run" | "pause_run" | "resume_run" | "cancel_run" | "clear_input">;
  manual_confirmation_required: boolean;
  needs_clarification?: boolean;
  message: string | null;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }),
  );
}

function setBrowserLanguage(language: string) {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: language,
  });
}

function renderPanel(
  props: Partial<{
    onCreateRun: (task: string) => Promise<void>;
    onVoiceRunCommand: (action: "start" | "pause" | "resume" | "cancel") => Promise<string | null>;
    runStatus: string;
    hasPendingConfirmation: boolean;
  }> = {},
) {
  return render(
    <ChatPanel
      apiReady={true}
      onCreateRun={props.onCreateRun ?? vi.fn().mockResolvedValue(undefined)}
      onVoiceRunCommand={props.onVoiceRunCommand ?? vi.fn().mockResolvedValue(undefined)}
      runStatus={props.runStatus ?? "created"}
      hasPendingConfirmation={props.hasPendingConfirmation ?? false}
    />,
  );
}

describe("ChatPanel voice input", () => {
  it("shows a visible voice entry point near the task field", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");

    renderPanel();

    expect(screen.getByRole("button", { name: "Turn voice mode on" })).toBeTruthy();
    expect(screen.getByText("Voice")).toBeTruthy();
  });

  it("keeps voice mode on, uses the selected language, and speaks the parsed intent", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const speak = stubSpeechSynthesis();
    setBrowserLanguage("en-US");
    mockVoiceInterpretation({
      task_text_delta: "打开浏览器，访问 baidu.com",
      actions: ["create_run", "start_run"],
      manual_confirmation_required: false,
      message: null,
    });
    const onCreateRun = vi.fn().mockResolvedValue(undefined);
    const onVoiceRunCommand = vi.fn().mockResolvedValue(undefined);

    renderPanel({ onCreateRun, onVoiceRunCommand, runStatus: "created" });

    fireEvent.change(screen.getByLabelText("Voice language"), {
      target: { value: "zh-CN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));

    expect(FakeRecognition.latest?.lang).toBe("zh-CN");
    expect(screen.getByRole("button", { name: "Turn voice mode off" })).toBeTruthy();

    emitVoiceResult("打开浏览器，访问 baidu.com，开始运行");

    await waitFor(() => expect(onCreateRun).toHaveBeenCalledWith("打开浏览器，访问 baidu.com"));
    await waitFor(() => expect(onVoiceRunCommand).toHaveBeenCalledWith("start"));
    expect(speak).toHaveBeenCalled();
    expect((speak.mock.calls[0][0] as { text: string; lang: string }).lang).toBe("zh-CN");
    expect((speak.mock.calls[0][0] as { text: string }).text).toContain("我理解为");
  });

  it("adds recognized speech to the task field without creating a run", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");
    mockVoiceInterpretation({
      task_text_delta: "open example.com",
      actions: [],
      manual_confirmation_required: false,
      message: null,
    });
    const onCreateRun = vi.fn();

    renderPanel({ onCreateRun });

    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("open example.com");

    await waitFor(() => expect(taskInput().value).toBe("open example.com"));
    expect(onCreateRun).not.toHaveBeenCalled();
  });

  it("appends recognized speech to existing task text", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");
    mockVoiceInterpretation({
      task_text_delta: "and tell me the page title",
      actions: [],
      manual_confirmation_required: false,
      message: null,
    });

    renderPanel();

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("and tell me the page title");

    await waitFor(() =>
      expect(taskInput().value).toBe("open example.com and tell me the page title"),
    );
  });

  it("keeps manual create-run behavior unchanged", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");

    const onCreateRun = vi.fn().mockResolvedValue(undefined);
    renderPanel({ onCreateRun });

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Run" }));

    expect(onCreateRun).toHaveBeenCalledWith("open example.com");
  });

  it("creates a run when the user says an explicit create command", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");
    mockVoiceInterpretation({
      task_text_delta: "",
      actions: ["create_run"],
      manual_confirmation_required: false,
      message: null,
    });
    const onCreateRun = vi.fn().mockResolvedValue(undefined);

    renderPanel({ onCreateRun });

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("创建任务");

    await waitFor(() => expect(onCreateRun).toHaveBeenCalledWith("open example.com"));
  });

  it("creates and starts a run when the voice request contains task text and start run", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("zh-CN");
    mockVoiceInterpretation({
      task_text_delta: "打开浏览器，访问 baidu.com",
      actions: ["create_run", "start_run"],
      manual_confirmation_required: false,
      message: null,
    });
    const onCreateRun = vi.fn().mockResolvedValue(undefined);
    const onVoiceRunCommand = vi.fn().mockResolvedValue(undefined);

    renderPanel({ onCreateRun, onVoiceRunCommand, runStatus: "created" });

    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("打开浏览器，访问 baidu.com，开始运行");

    await waitFor(() => expect(onCreateRun).toHaveBeenCalledWith("打开浏览器，访问 baidu.com"));
    await waitFor(() => expect(onVoiceRunCommand).toHaveBeenCalledWith("start"));
  });

  it("routes explicit run control commands to App", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");
    mockVoiceInterpretation({
      task_text_delta: "",
      actions: ["start_run"],
      manual_confirmation_required: false,
      message: null,
    });
    const onVoiceRunCommand = vi.fn().mockResolvedValue(undefined);

    renderPanel({ onVoiceRunCommand });

    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("开始运行");

    await waitFor(() => expect(onVoiceRunCommand).toHaveBeenCalledWith("start"));
  });

  it("clears the task field when the user says an explicit clear command", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("en-US");
    mockVoiceInterpretation({
      task_text_delta: "",
      actions: ["clear_input"],
      manual_confirmation_required: false,
      message: null,
    });

    renderPanel();

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("清空输入");

    await waitFor(() => expect(taskInput().value).toBe(""));
  });

  it("refuses approval by voice", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    setBrowserLanguage("zh-CN");
    mockVoiceInterpretation({
      task_text_delta: "",
      actions: [],
      manual_confirmation_required: true,
      message: "Please approve or reject pending confirmations manually.",
    });
    const onVoiceRunCommand = vi.fn();

    renderPanel({ onVoiceRunCommand, runStatus: "waiting_for_confirmation", hasPendingConfirmation: true });

    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("批准");

    await waitFor(() =>
      expect(screen.getByText("Please approve or reject pending confirmations manually.")).toBeTruthy(),
    );
    expect(onVoiceRunCommand).not.toHaveBeenCalled();
  });

  it("speaks a clarifying question when the model is unsure", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const speak = stubSpeechSynthesis();
    setBrowserLanguage("zh-CN");
    mockVoiceInterpretation({
      task_text_delta: "",
      actions: [],
      manual_confirmation_required: false,
      needs_clarification: true,
      message: "你想创建任务，还是直接开始运行？",
    });
    const onCreateRun = vi.fn();
    const onVoiceRunCommand = vi.fn();

    renderPanel({ onCreateRun, onVoiceRunCommand, runStatus: "idle" });

    fireEvent.change(screen.getByLabelText("Voice language"), {
      target: { value: "zh-CN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Turn voice mode on" }));
    emitVoiceResult("那个开始一下");

    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect((speak.mock.calls[0][0] as { text: string }).text).toBe(
      "你想创建任务，还是直接开始运行？",
    );
    expect(onCreateRun).not.toHaveBeenCalled();
    expect(onVoiceRunCommand).not.toHaveBeenCalled();
  });
});
