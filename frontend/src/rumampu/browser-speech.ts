import type { ExpoSpeechRecognitionNativeEventMap, ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';

export type BrowserSpeechEvents = Pick<ExpoSpeechRecognitionNativeEventMap, 'start' | 'end' | 'result' | 'error'>;
export interface BrowserRecognizer extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
}

type Listener = (event: BrowserSpeechEvents[keyof BrowserSpeechEvents]) => void;

/** Own each browser recognizer and its listeners separately. Never reuse an
 * abandoned instance or deliver its late events to the next recording. */
export class BrowserSpeech {
  private listeners = new Map<keyof BrowserSpeechEvents, Set<Listener>>();
  private session: { recognizer: BrowserRecognizer; detach: () => void; timer: ReturnType<typeof setTimeout> | null } | null = null;
  private retiring: BrowserRecognizer | null = null;

  private factory: () => BrowserRecognizer;
  private timeoutMs: number;
  constructor(factory: () => BrowserRecognizer, timeoutMs = 12000) {
    this.factory = factory;
    this.timeoutMs = timeoutMs;
  }

  addListener<K extends keyof BrowserSpeechEvents>(name: K, callback: (event: BrowserSpeechEvents[K]) => void) {
    const listener = callback as Listener;
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
    return { remove: () => { this.listeners.get(name)?.delete(listener); } };
  }

  private emit<K extends keyof BrowserSpeechEvents>(name: K, event: BrowserSpeechEvents[K]) {
    for (const listener of [...(this.listeners.get(name) ?? [])]) listener(event);
  }

  private retire(recognizer: BrowserRecognizer) {
    this.retiring = recognizer;
    // Wait for the browser to release the previous session. A missing end event
    // must not lock the app forever; the next attempt still requires a tap.
    const release = () => {
      clearTimeout(timer);
      recognizer.removeEventListener('end', release);
      if (this.retiring === recognizer) this.retiring = null;
    };
    const timer = setTimeout(release, 1500);
    recognizer.addEventListener('end', release);
    try { recognizer.abort(); } catch { release(); }
  }

  private close(cancel: boolean) {
    const session = this.session;
    if (!session) return;
    this.session = null;
    if (session.timer) clearTimeout(session.timer);
    session.detach();
    if (cancel) this.retire(session.recognizer);
  }

  start(options: ExpoSpeechRecognitionOptions) {
    if (this.session || this.retiring) throw new Error('The microphone is still closing. Tap again.');
    const recognizer = this.factory();
    recognizer.lang = options.lang ?? 'en-MY';
    recognizer.interimResults = options.interimResults ?? false;
    recognizer.continuous = options.continuous ?? false;
    recognizer.maxAlternatives = options.maxAlternatives ?? 1;
    const handlers: Array<[string, EventListener]> = [];
    const session = { recognizer, timer: null as ReturnType<typeof setTimeout> | null, detach: () => {
      for (const [name, handler] of handlers) recognizer.removeEventListener(name, handler);
    } };
    this.session = session;
    const armTimeout = () => {
      if (session.timer) clearTimeout(session.timer);
      session.timer = setTimeout(() => {
        if (this.session !== session) return;
        this.close(true);
        this.emit('error', { error: 'no-speech', message: 'No speech received. Tap the microphone to try again.' });
        this.emit('end', null);
      }, this.timeoutMs);
    };
    const on = (name: string, handler: EventListener) => {
      const guarded: EventListener = event => { if (this.session === session) handler(event); };
      handlers.push([name, guarded]);
      recognizer.addEventListener(name, guarded);
    };
    on('start', () => this.emit('start', null));
    on('end', () => { this.close(false); this.emit('end', null); });
    on('error', event => {
      const error = event as SpeechRecognitionErrorEvent;
      this.close(true);
      this.emit('error', { error: error.error === 'phrases-not-supported' ? 'unknown' : error.error, message: error.message ?? '' });
      this.emit('end', null);
    });
    on('result', event => {
      const result = event as SpeechRecognitionEvent;
      armTimeout();
      // Emit changed results only: continuous mode's result list also contains
      // earlier final utterances, which must not be appended a second time.
      for (let i = result.resultIndex; i < result.results.length; i++) {
        const item = result.results[i];
        this.emit('result', {
          isFinal: item.isFinal,
          results: Array.from(item, alternative => ({
            transcript: alternative.transcript, confidence: alternative.confidence, segments: [],
          })),
        });
      }
    });
    // Arm before start: Safari can fail to send even the start event.
    armTimeout();
    try { recognizer.start(); } catch (error) { this.close(true); throw error; }
  }

  stop() {
    const session = this.session;
    if (!session) return;
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      if (this.session !== session) return;
      this.close(true);
      this.emit('end', null);
    }, 1500);
    try { session.recognizer.stop(); } catch { this.abort(); }
  }

  abort() {
    if (!this.session) return;
    this.close(true);
    this.emit('end', null);
  }
}
