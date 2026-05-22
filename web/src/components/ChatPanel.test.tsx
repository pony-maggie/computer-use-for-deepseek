import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";
import type {
  BrowserSpeechRecognition,
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionResultEventLike,
} from "./voiceInput";

class FakeRecognition implements BrowserSpeechRecognition {
  static latest: FakeRecognition | null = null;

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
});

function taskInput() {
  return screen.getByLabelText("Task") as HTMLTextAreaElement;
}

function emitVoiceResult(transcript: string) {
  act(() => {
    FakeRecognition.latest?.emitResult(transcript);
  });
}

describe("ChatPanel voice input", () => {
  it("adds recognized speech to the task field without creating a run", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onCreateRun = vi.fn();

    render(<ChatPanel apiReady={true} onCreateRun={onCreateRun} onVoiceRunCommand={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    emitVoiceResult("open example.com");

    expect(taskInput().value).toBe("open example.com");
    expect(onCreateRun).not.toHaveBeenCalled();
  });

  it("appends recognized speech to existing task text", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });

    render(<ChatPanel apiReady={true} onCreateRun={vi.fn()} onVoiceRunCommand={vi.fn()} />);

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    emitVoiceResult("and tell me the page title");

    expect(taskInput().value).toBe("open example.com and tell me the page title");
  });

  it("keeps manual create-run behavior unchanged", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onCreateRun = vi.fn().mockResolvedValue(undefined);

    render(<ChatPanel apiReady={true} onCreateRun={onCreateRun} onVoiceRunCommand={vi.fn()} />);

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Run" }));

    expect(onCreateRun).toHaveBeenCalledWith("open example.com");
  });

  it("creates a run when the user says an explicit create command", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onCreateRun = vi.fn().mockResolvedValue(undefined);

    render(<ChatPanel apiReady={true} onCreateRun={onCreateRun} onVoiceRunCommand={vi.fn()} />);

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    emitVoiceResult("创建任务");

    expect(onCreateRun).toHaveBeenCalledWith("open example.com");
  });

  it("routes explicit run control commands to App", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onVoiceRunCommand = vi.fn().mockResolvedValue(undefined);

    render(
      <ChatPanel apiReady={true} onCreateRun={vi.fn()} onVoiceRunCommand={onVoiceRunCommand} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    emitVoiceResult("开始运行");

    expect(onVoiceRunCommand).toHaveBeenCalledWith("start");
  });

  it("clears the task field when the user says an explicit clear command", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });

    render(<ChatPanel apiReady={true} onCreateRun={vi.fn()} onVoiceRunCommand={vi.fn()} />);

    fireEvent.change(taskInput(), {
      target: { value: "open example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    emitVoiceResult("清空输入");

    expect(taskInput().value).toBe("");
  });

  it("refuses approval by voice", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onVoiceRunCommand = vi.fn();

    render(<ChatPanel apiReady={true} onCreateRun={vi.fn()} onVoiceRunCommand={onVoiceRunCommand} />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    emitVoiceResult("批准");

    expect(onVoiceRunCommand).not.toHaveBeenCalled();
    expect(screen.getByText("Please approve or reject pending confirmations manually.")).toBeTruthy();
  });
});
