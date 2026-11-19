import { describe, expect, it } from 'vitest';

import { speechErrorKey, speechRecognitionCtor } from './useSpeechRecognition';

describe('speechRecognitionCtor', () => {
  it('prefers the standard constructor and falls back to webkit', () => {
    class Standard {}
    class Webkit {}
    expect(speechRecognitionCtor({ SpeechRecognition: Standard })).toBe(
      Standard,
    );
    expect(speechRecognitionCtor({ webkitSpeechRecognition: Webkit })).toBe(
      Webkit,
    );
  });

  it('returns null when the browser has no Web Speech API', () => {
    expect(speechRecognitionCtor({})).toBeNull();
    expect(speechRecognitionCtor(undefined)).toBeNull();
  });
});

describe('speechErrorKey', () => {
  it('maps recognizer errors to Hungarian message keys', () => {
    expect(speechErrorKey('not-allowed')).toBe('app.voice_error_mic_denied');
    expect(speechErrorKey('no-speech')).toBe('app.voice_error_no_speech');
    expect(speechErrorKey('audio-capture')).toBe('app.voice_error_no_mic');
    expect(speechErrorKey('something-else')).toBe('app.voice_error_generic');
  });
});
