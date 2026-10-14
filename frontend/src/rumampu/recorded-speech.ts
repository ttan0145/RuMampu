import type { ExpoSpeechRecognitionOptions } from 'expo-speech-recognition';
import type { BrowserSpeechEvents } from './browser-speech';

type Listener = (event: BrowserSpeechEvents[keyof BrowserSpeechEvents]) => void;
type Session = {
  id: number; stream?: MediaStream; recorder?: MediaRecorder; chunks: Blob[];
  controller: AbortController; timer?: ReturnType<typeof setTimeout>; stopping: boolean;
};
type Transcribe = (audio: Blob, language: string, signal: AbortSignal) => Promise<string>;

/** iPhone capture uses MediaRecorder, never Safari's SpeechRecognition service.
 * Audio stays in memory until Stop; cancellation discards it without upload. */
export class RecordedSpeech {
  private session: Session | null = null;
  private nextId = 0;
  private listeners = new Map<keyof BrowserSpeechEvents, Set<Listener>>();
  private transcribe: Transcribe;
  constructor(transcribe: Transcribe) { this.transcribe = transcribe; }

  addListener<K extends keyof BrowserSpeechEvents>(name: K, callback: (event: BrowserSpeechEvents[K]) => void) {
    const listener = callback as Listener;
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
    return { remove: () => { this.listeners.get(name)?.delete(listener); } };
  }
  private emit<K extends keyof BrowserSpeechEvents>(name: K, event: BrowserSpeechEvents[K]) {
    for (const listener of [...(this.listeners.get(name) ?? [])]) listener(event);
  }
  private stopTracks(session: Session) {
    session.stream?.getTracks().forEach(track => track.stop());
    if (session.timer) clearTimeout(session.timer);
  }
  private fail(session: Session, error: unknown) {
    if (this.session !== session) return;
    this.dispose();
    const failure = error as { name?: string; code?: string; status?: number; message?: string };
    const code = failure.name === 'NotAllowedError' ? 'not-allowed'
      : failure.code === 'speech_no_speech' ? 'no-speech'
        : failure.status === 429 ? 'busy'
        : failure.name === 'NotFoundError' || failure.name === 'NotReadableError' ? 'audio-capture' : 'network';
    console.warn('[RuMampu speech] recorded error', JSON.stringify({ sessionId: session.id, code, status: failure.status, name: failure.name, message: failure.message }));
    this.emit('error', { error: code, message: failure.message ?? 'Recording or transcription failed.' });
    this.emit('end', null);
  }
  start(options: ExpoSpeechRecognitionOptions) {
    if (this.session) throw new Error('A recording or transcription is already in progress.');
    const session: Session = { id: ++this.nextId, chunks: [], controller: new AbortController(), stopping: false };
    this.session = session;
    // Invoke getUserMedia immediately inside the microphone tap, before awaiting.
    let request: Promise<MediaStream>;
    try { request = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
    catch (error) { this.session = null; throw error; }
    void request.then(stream => {
      if (this.session !== session) { stream.getTracks().forEach(track => track.stop()); return; }
      session.stream = stream;
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser cannot record a supported audio format.');
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
      session.recorder = recorder;
      recorder.ondataavailable = event => {
        if (this.session === session && event.data.size) session.chunks.push(event.data);
      };
      recorder.onerror = () => this.fail(session, new Error('The microphone recording failed.'));
      recorder.onstop = () => {
        this.stopTracks(session);
        if (this.session !== session) return;
        void this.finish(session, recorder.mimeType || mimeType, options.lang?.split('-')[0] ?? 'en');
      };
      recorder.start();
      console.info('[RuMampu speech] recording started', JSON.stringify({ sessionId: session.id, mimeType: recorder.mimeType }));
      // Bound free-tier usage; no 12-second recognition or 3-second silence timer.
      session.timer = setTimeout(() => this.stop(), 30000);
      this.emit('start', null);
    }).catch(error => this.fail(session, error));
  }
  private async finish(session: Session, mimeType: string, language: string) {
    const audio = new Blob(session.chunks, { type: mimeType });
    session.chunks = [];
    if (!audio.size || audio.size > 2 * 1024 * 1024) {
      this.fail(session, { code: 'speech_no_speech', message: 'No usable recording was captured.' });
      return;
    }
    this.emit('processing', null);
    console.info('[RuMampu speech] transcription requested', JSON.stringify({ sessionId: session.id, bytes: audio.size }));
    try {
      const text = (await this.transcribe(audio, language, session.controller.signal)).trim();
      if (this.session !== session) return;
      if (!text) { this.fail(session, { code: 'speech_no_speech', message: 'No speech was recognised.' }); return; }
      this.emit('result', { isFinal: true, results: [{ transcript: text, confidence: 1, segments: [] }] });
      if (this.session !== session) return;
      this.session = null;
      this.emit('end', null);
    } catch (error) { this.fail(session, error); }
  }
  stop() {
    const session = this.session;
    if (!session || session.stopping) return;
    session.stopping = true;
    if (!session.recorder) { this.abort(); return; }
    if (session.timer) clearTimeout(session.timer);
    if (session.recorder.state !== 'inactive') session.recorder.stop();
    this.stopTracks(session);
  }
  private dispose() {
    const session = this.session;
    if (!session) return;
    this.session = null; // invalidate handlers before stopping or resolving requests
    session.controller.abort();
    session.chunks = [];
    if (session.recorder) {
      session.recorder.ondataavailable = null;
      session.recorder.onstop = null;
      session.recorder.onerror = null;
      if (session.recorder.state !== 'inactive') { try { session.recorder.stop(); } catch { /* already stopped */ } }
    }
    this.stopTracks(session);
  }
  abort() {
    if (!this.session) return;
    this.dispose();
    this.emit('end', null);
  }
}
