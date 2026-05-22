import { describe, expect, it, vi } from "vitest";
import {
  appendRecognizedText,
  getSpeechRecognitionConstructor,
  mapSpeechRecognitionError,
  parseVoiceCommand,
} from "./voiceInput";

describe("appendRecognizedText", () => {
  it("inserts recognized text into an empty task", () => {
    expect(appendRecognizedText("", "open example.com")).toBe("open example.com");
  });

  it("appends recognized text to an existing task with one separating space", () => {
    expect(appendRecognizedText("open example.com", "and tell me the title")).toBe(
      "open example.com and tell me the title",
    );
  });

  it("ignores blank recognized text", () => {
    expect(appendRecognizedText("open example.com", "   ")).toBe("open example.com");
  });
});

describe("parseVoiceCommand", () => {
  it("parses allowed Chinese command phrases", () => {
    expect(parseVoiceCommand("创建任务")).toBe("create_run");
    expect(parseVoiceCommand("开始运行")).toBe("start_run");
    expect(parseVoiceCommand("暂停")).toBe("pause_run");
    expect(parseVoiceCommand("继续")).toBe("resume_run");
    expect(parseVoiceCommand("取消")).toBe("cancel_run");
    expect(parseVoiceCommand("清空输入")).toBe("clear_input");
  });

  it("parses allowed English command phrases", () => {
    expect(parseVoiceCommand("create run")).toBe("create_run");
    expect(parseVoiceCommand("start run")).toBe("start_run");
    expect(parseVoiceCommand("pause")).toBe("pause_run");
    expect(parseVoiceCommand("resume")).toBe("resume_run");
    expect(parseVoiceCommand("cancel")).toBe("cancel_run");
    expect(parseVoiceCommand("clear input")).toBe("clear_input");
  });

  it("refuses approval and rejection commands", () => {
    expect(parseVoiceCommand("批准")).toBe("manual_confirmation_required");
    expect(parseVoiceCommand("approve")).toBe("manual_confirmation_required");
    expect(parseVoiceCommand("拒绝")).toBe("manual_confirmation_required");
    expect(parseVoiceCommand("reject")).toBe("manual_confirmation_required");
  });

  it("treats non-command speech as task text", () => {
    expect(parseVoiceCommand("打开 example.com 然后告诉我标题")).toBeNull();
    expect(parseVoiceCommand("start run after opening the browser")).toBeNull();
  });
});

describe("getSpeechRecognitionConstructor", () => {
  it("returns null when browser speech recognition is unavailable", () => {
    expect(getSpeechRecognitionConstructor({})).toBeNull();
  });

  it("returns the standard constructor when available", () => {
    const SpeechRecognition = vi.fn();
    expect(getSpeechRecognitionConstructor({ SpeechRecognition })).toBe(SpeechRecognition);
  });

  it("returns the webkit constructor when the standard constructor is unavailable", () => {
    const webkitSpeechRecognition = vi.fn();
    expect(getSpeechRecognitionConstructor({ webkitSpeechRecognition })).toBe(
      webkitSpeechRecognition,
    );
  });
});

describe("mapSpeechRecognitionError", () => {
  it("maps permission errors to a clear message", () => {
    expect(mapSpeechRecognitionError("not-allowed")).toBe(
      "Microphone permission was denied. Enable microphone access and try again.",
    );
  });

  it("maps no-speech errors to a clear message", () => {
    expect(mapSpeechRecognitionError("no-speech")).toBe("No speech was detected. Try again.");
  });

  it("maps unknown errors to a generic message", () => {
    expect(mapSpeechRecognitionError("network")).toBe(
      "Speech recognition failed. You can keep typing manually.",
    );
  });
});
