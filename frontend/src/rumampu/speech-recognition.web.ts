import React from 'react';
import { RecordedSpeech } from './recorded-speech';
import { transcribeSpeechAudio } from './api';
import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import { BrowserSpeech, type BrowserRecognizer, type BrowserSpeechEvents } from './browser-speech';

function recognitionClass() {
  if (typeof window === 'undefined') return undefined;
  const browser = window as unknown as { webkitSpeechRecognition?: new () => BrowserRecognizer; SpeechRecognition?: new () => BrowserRecognizer };
  return browser.webkitSpeechRecognition ?? browser.SpeechRecognition;
}

export function speechUsesAudioUpload(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPod/.test(navigator.userAgent);
}

const browserSpeech = new BrowserSpeech(() => {
  const Recognizer = recognitionClass();
  if (!Recognizer) throw new Error('Speech recognition is unavailable.');
  return new Recognizer();
}, 12000, (event, details) => {
  const log = event === 'browser error' ? console.warn : console.info;
  log(`[RuMampu speech] ${event}`, JSON.stringify(details));
});

const recordedSpeech = new RecordedSpeech(transcribeSpeechAudio);
const speech = speechUsesAudioUpload() ? recordedSpeech : browserSpeech;

// Log lifecycle metadata only, never spoken words or result transcripts.
if (typeof window !== 'undefined') console.info('[RuMampu speech] web wrapper ready');
export const ExpoSpeechRecognitionModule = {
  start: (options: ExpoSpeechRecognitionOptions) => {
    console.info('[RuMampu speech] browser context', JSON.stringify({
      secureContext: window.isSecureContext,
      userActivation: navigator.userActivation?.isActive,
      lang: options.lang, continuous: options.continuous,
    }));
    try { speech.start(options); } catch (error) {
      console.warn('[RuMampu speech] start failed', error);
      throw error;
    }
  },
  stop: speech.stop.bind(speech),
  abort: speech.abort.bind(speech),
  isRecognitionAvailable: () => speechUsesAudioUpload()
    ? Boolean(typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined')
    : Boolean(recognitionClass()),
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
