import { useCallback, useMemo, useRef, useState } from "react";
import {
  getSpeechRecognitionConstructor,
  getDefaultVoiceLanguage,
  mapSpeechRecognitionError,
  type BrowserSpeechRecognition,
  type SpeechRecognitionWindow,
  type VoiceInputStatus,
} from "./voiceInput";

type UseVoiceInputOptions = {
  lang?: string;
  onText?: (text: string) => void;
};

type UseVoiceInputResult = {
  supported: boolean;
  status: VoiceInputStatus;
  error: string | null;
  startListening: () => void;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputResult {
  const { lang, onText } = options;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
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

  const startListening = useCallback(() => {
    if (!constructor) {
      setStatus("error");
      setError("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new constructor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
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
        onText?.(finalText);
        setStatus("transcribing");
      }
    };
    recognition.onerror = (event) => {
      setStatus("error");
      setError(mapSpeechRecognitionError(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((currentStatus) => (currentStatus === "error" ? "error" : "idle"));
    };

    try {
      recognition.start();
    } catch {
      setStatus("error");
      setError("Speech recognition could not start. You can keep typing manually.");
    }
  }, [constructor, defaultLanguage, lang, onText]);

  return {
    supported,
    status,
    error,
    startListening,
  };
}
