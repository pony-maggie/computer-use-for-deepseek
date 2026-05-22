import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVoiceInput } from "./useVoiceInput";
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

  emitError(error: string) {
    this.onerror?.({ error });
  }

  emitEnd() {
    this.onend?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeRecognition.latest = null;
});

describe("useVoiceInput", () => {
  it("reports unsupported when no browser constructor exists", () => {
    vi.stubGlobal("window", {});

    const { result } = renderHook(() => useVoiceInput());

    expect(result.current.supported).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Voice input is not supported in this browser.");
  });

  it("moves to listening and inserts final recognized text", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onText = vi.fn();
    const { result } = renderHook(() => useVoiceInput({ onText }));

    act(() => {
      result.current.startListening();
    });

    expect(result.current.status).toBe("listening");
    expect(FakeRecognition.latest?.lang).toBe("en-US");

    act(() => {
      FakeRecognition.latest?.emitResult("open example.com");
    });

    expect(onText).toHaveBeenCalledWith("open example.com");
    expect(result.current.status).toBe("transcribing");

    act(() => {
      FakeRecognition.latest?.emitEnd();
    });

    expect(result.current.status).toBe("idle");
  });

  it("reports browser recognition errors", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.startListening();
      FakeRecognition.latest?.emitError("no-speech");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("No speech was detected. Try again.");
  });
});
