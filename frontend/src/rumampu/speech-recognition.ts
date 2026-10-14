import React from 'react';
import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionNativeEventMap, ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';

type AppSpeechEvents = ExpoSpeechRecognitionNativeEventMap & { processing: null };
export const speechUsesAudioUpload = () => false;

type NativeSpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

// Expo Go and older installed builds may not contain this custom native module.
// Avoid importing the library at runtime: its eager requireNativeModule throws
// before React can render the existing typed-entry fallback.
const native = requireOptionalNativeModule<NativeSpeechModule>('ExpoSpeechRecognition');

export const ExpoSpeechRecognitionModule = {
  isRecognitionAvailable: () => native?.isRecognitionAvailable() ?? false,
  requestPermissionsAsync: async () => native
    ? native.requestPermissionsAsync()
    : { granted: false, canAskAgain: false, status: 'denied' as const, expires: 'never' as const },
  start: (options: ExpoSpeechRecognitionOptions) => {
    if (!native) throw new Error('Voice input requires a native build containing expo-speech-recognition.');
    native.start(options);
  },
  stop: () => native?.stop(),
  abort: () => native?.abort(),
};

export function useSpeechRecognitionEvent<K extends keyof AppSpeechEvents>(
  name: K, listener: (event: AppSpeechEvents[K]) => void,
) {
  const latest = React.useRef(listener);
  latest.current = listener;
  React.useEffect(() => {
    if (!native || name === 'processing') return;
    const subscribe = native.addListener.bind(native) as (eventName: keyof ExpoSpeechRecognitionNativeEventMap, callback: (event: unknown) => void) => { remove(): void };
    const subscription = subscribe(name, event => latest.current(event as AppSpeechEvents[K]));
    return () => subscription.remove();
  }, [name]);
}
