import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';
import { RecordedSpeech } from '../src/rumampu/recorded-speech.ts';

class Recorder {
  static isTypeSupported(type: string) { return type === 'audio/mp4'; }
  mimeType = 'audio/mp4'; state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['encoded audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function setup(context: TestContext, getMedia?: () => Promise<unknown>) {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const oldRecorder = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
  let stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: getMedia ?? (() => Promise.resolve(stream)) } } });
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder });
  context.after(() => {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (oldRecorder) Object.defineProperty(globalThis, 'MediaRecorder', oldRecorder);
    else Reflect.deleteProperty(globalThis, 'MediaRecorder');
  });
  return { stream, stopped: () => stopped };
}

describe('iPhone recording lifecycle', () => {
  it('uploads only after Stop and permits repeated recordings', async context => {
    const media = setup(context);
    let uploads = 0;
    const speech = new RecordedSpeech(async () => { uploads++; return `words ${uploads}`; });
    const results: string[] = [];
    speech.addListener('result', event => results.push(event.results[0].transcript));
    for (let attempt = 1; attempt <= 2; attempt++) {
      speech.start({ lang: 'en-MY' });
      await flush();
      assert.equal(uploads, attempt - 1);
      speech.stop();
      await flush();
    }
    assert.deepEqual(results, ['words 1', 'words 2']);
    assert.equal(uploads, 2);
    assert.ok(media.stopped() >= 2);
  });

  it('discards a cancelled recording without uploading it', async context => {
    setup(context);
    let uploads = 0;
    const speech = new RecordedSpeech(async () => { uploads++; return 'words'; });
    speech.start({ lang: 'en-MY' });
    await flush();
    speech.abort();
    await flush();
    assert.equal(uploads, 0);
  });

  it('stops a permission request that resolves after cancellation', async context => {
    let resolve!: (stream: unknown) => void;
    const media = setup(context, () => new Promise(done => { resolve = done; }));
    const speech = new RecordedSpeech(async () => { assert.fail('Cancelled permission must not upload'); return ''; });
    speech.start({ lang: 'en-MY' });
    speech.abort();
    resolve(media.stream);
    await flush();
    assert.equal(media.stopped(), 1);
  });

  it('cancels in-flight transcription and ignores late words', async context => {
    setup(context);
    let resolve!: (text: string) => void;
    let signal: AbortSignal | undefined;
    const speech = new RecordedSpeech(async (_audio, _language, cancellation) => {
      signal = cancellation;
      return new Promise(done => { resolve = done; });
    });
    let results = 0;
    speech.addListener('result', () => results++);
    speech.start({ lang: 'en-MY' });
    await flush();
    speech.stop();
    speech.abort();
    assert.equal(signal!.aborted, true);
    resolve('late words');
    await flush();
    assert.equal(results, 0);
  });

  it('caps a recording at 30 seconds and handles quota failure', async context => {
    setup(context);
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const speech = new RecordedSpeech(async () => { throw { status: 429, code: 'speech_rate_limited' }; });
    const errors: string[] = [];
    speech.addListener('error', event => errors.push(event.error));
    speech.start({ lang: 'en-MY' });
    await flush();
    context.mock.timers.tick(30000);
    await flush();
    assert.deepEqual(errors, ['busy']);
  });
});
