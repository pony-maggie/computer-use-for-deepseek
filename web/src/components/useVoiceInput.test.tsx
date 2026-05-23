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
  FakeRecognition.instances = [];
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

  it("defaults to zh-CN for Chinese browser locales", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    vi.stubGlobal("navigator", { language: "zh-CN" });

    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.startListening();
    });

    expect(FakeRecognition.latest?.lang).toBe("zh-CN");
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

  it("keeps recognition running while voice mode is active", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeRecognition });
    const onText = vi.fn();
    const { result, rerender } = renderHook(
      ({ active }) => useVoiceInput({ active, lang: "zh-CN", onText }),
      { initialProps: { active: true } },
    );

    expect(result.current.status).toBe("listening");
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(FakeRecognition.latest?.continuous).toBe(true);
    expect(FakeRecognition.latest?.lang).toBe("zh-CN");

    act(() => {
      FakeRecognition.latest?.emitResult("打开浏览器");
      FakeRecognition.latest?.emitEnd();
    });

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(onText).toHaveBeenCalledWith("打开浏览器");
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(result.current.status).toBe("listening");

    act(() => {
      rerender({ active: false });
    });

    expect(FakeRecognition.latest?.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
