import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  getDefaultVoiceLanguage,
  mapSpeechRecognitionError,
  type BrowserSpeechRecognition,
  type SpeechRecognitionWindow,
  type VoiceInputStatus,
} from "./voiceInput";

type UseVoiceInputOptions = {
  active?: boolean;
  lang?: string;
  onText?: (text: string) => void;
};

type UseVoiceInputResult = {
  supported: boolean;
  status: VoiceInputStatus;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
  const { active = false, lang, onText } = options;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const activeRef = useRef(active);
  const restartTimerRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  const constructor = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getSpeechRecognitionConstructor(window as unknown as SpeechRecognitionWindow);
  }, []);
  const supported = constructor !== null;
  const defaultLanguage = getDefaultVoiceLanguage(
    typeof window === "undefined"
      ? undefined
      : window.navigator?.language ?? globalThis.navigator?.language,
  );
  const [status, setStatus] = useState<VoiceInputStatus>(supported ? "idle" : "error");
  const [error, setError] = useState<string | null>(
    supported ? null : "Voice input is not supported in this browser.",
  );

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current === null) return;
    globalThis.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Some browser implementations throw if stop is called after end.
      }
    }
    setStatus((currentStatus) => (currentStatus === "error" ? "error" : "idle"));
  }, [clearRestartTimer]);

  const startRecognition = useCallback((persistent: boolean) => {
    if (!constructor) {
      setStatus("error");
      setError("Voice input is not supported in this browser.");
      return;
    }
    if (recognitionRef.current) return;

    clearRestartTimer();
    const recognition = new constructor();
    recognitionRef.current = recognition;
    recognition.continuous = persistent;
    recognition.interimResults = true;
    recognition.lang = lang ?? defaultLanguage;
    recognition.onstart = () => {
      setError(null);
      setStatus("listening");
    };
    recognition.onresult = (event) => {
      const finalText = Array.from(event.results)
        .filter((result) => result.isFinal !== false)
        .map((result) => result[0]?.transcript?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (finalText) {
        setStatus("transcribing");
        onTextRef.current?.(finalText);
      }
    };
    recognition.onerror = (event) => {
      setStatus("error");
      setError(mapSpeechRecognitionError(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (persistent && activeRef.current) {
        setStatus("idle");
        restartTimerRef.current = globalThis.setTimeout(() => {
          restartTimerRef.current = null;
          if (activeRef.current) startRecognition(true);
        }, 100);
        return;
      }
      setStatus((currentStatus) => (currentStatus === "error" ? "error" : "idle"));
    };

    try {
      recognition.start();
    } catch {
      setStatus("error");
      setError("Speech recognition could not start. You can keep typing manually.");
    }
  }, [clearRestartTimer, constructor, defaultLanguage, lang]);

  const startListening = useCallback(() => {
    startRecognition(false);
  }, [startRecognition]);

  useEffect(() => {
    if (!active) {
      stopListening();
      activeRef.current = false;
      return;
    }
    activeRef.current = true;
    startRecognition(true);
    return () => {
      activeRef.current = false;
      clearRestartTimer();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // Ignore browsers that reject stop during teardown.
        }
      }
    };
  }, [active, clearRestartTimer, startRecognition, stopListening]);

  return {
    supported,
    status,
    error,
    startListening,
    stopListening,
  };
}
