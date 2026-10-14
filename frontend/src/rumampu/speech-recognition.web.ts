import React from 'react';
import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import { BrowserSpeech, type BrowserRecognizer, type BrowserSpeechEvents } from './browser-speech';

function recognitionClass() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as unknown as { webkitSpeechRecognition?: new () => BrowserRecognizer; SpeechRecognition?: new () => BrowserRecognizer };
  return browser.webkitSpeechRecognition ?? browser.SpeechRecognition;
}

const speech = new BrowserSpeech(() => {
  const Recognizer = recognitionClass();
  if (!Recognizer) throw new Error('Speech recognition is unavailable.');
  return new Recognizer();
});

// Log lifecycle metadata only, never spoken words or result transcripts.
if (typeof window !== 'undefined') console.info('[RuMampu speech] web wrapper ready');
speech.addListener('start', () => console.info('[RuMampu speech] start'));
speech.addListener('end', () => console.info('[RuMampu speech] end'));
speech.addListener('result', event => console.info('[RuMampu speech] result', {
  isFinal: event.isFinal, alternatives: event.results.length,
}));
speech.addListener('error', event => console.warn('[RuMampu speech] error', event.error, event.message));

export const ExpoSpeechRecognitionModule = {
  start: (options: ExpoSpeechRecognitionOptions) => {
    console.info('[RuMampu speech] start requested', {
      secureContext: window.isSecureContext,
      userActivation: navigator.userActivation?.isActive,
      lang: options.lang,
    });
    try { speech.start(options); } catch (error) {
      console.warn('[RuMampu speech] start failed', error);
      throw error;
    }
  },
  stop: speech.stop.bind(speech),
  abort: speech.abort.bind(speech),
  isRecognitionAvailable: () => Boolean(recognitionClass()),
  requestPermissionsAsync: async () => ({ granted: true }),
};

export function useSpeechRecognitionEvent<K extends keyof BrowserSpeechEvents>(
  name: K, listener: (event: BrowserSpeechEvents[K]) => void,
) {
  const latest = React.useRef(listener);
  latest.current = listener;
  React.useEffect(() => {
    const subscription = speech.addListener(name, event => latest.current(event));
    return () => subscription.remove();
  }, [name]);
}
