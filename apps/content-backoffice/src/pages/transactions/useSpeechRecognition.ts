import { useCallback, useEffect, useRef, useState } from 'react';

/** Minimal Web Speech API surface (not in lib.dom for every browser). */
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionErrorEventLike = { error: string };

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function speechRecognitionCtor(
  win: unknown = typeof window !== 'undefined' ? window : undefined,
): SpeechRecognitionCtor | null {
  if (!win || typeof win !== 'object') return null;
  const w = win as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** i18n key for a recognition error code. */
export function speechErrorKey(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'app.voice_error_mic_denied';
    case 'no-speech':
      return 'app.voice_error_no_speech';
    case 'audio-capture':
      return 'app.voice_error_no_mic';
    case 'network':
      return 'app.voice_error_network';
    default:
      return 'app.voice_error_generic';
  }
}

/**
 * Hungarian dictation. `onFinal` gets the whole final transcript once the
 * recognizer stops (user pressed stop, or the browser ended the session).
 */
export function useSpeechRecognition({
  lang = 'hu-HU',
  onFinal,
}: {
  lang?: string;
  onFinal: (transcript: string) => void;
}) {
  const Ctor = speechRecognitionCtor();
  const supported = Ctor != null;
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  const start = useCallback(() => {
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    finalRef.current = '';
    setFinalText('');
    setInterim('');
    setErrorKey(null);

    recognition.onresult = (event) => {
      let finals = '';
      let pending = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const res = event.results[i]!;
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) finals += text;
        else pending += text;
      }
      finalRef.current = finals.trim();
      setFinalText(finalRef.current);
      setInterim(pending.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      setErrorKey(speechErrorKey(event.error));
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      const text = finalRef.current.trim();
      if (text) onFinalRef.current(text);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setErrorKey('app.voice_error_generic');
    }
  }, [Ctor, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { supported, listening, interim, finalText, errorKey, start, stop };
}
