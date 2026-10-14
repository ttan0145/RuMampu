import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Adapter = typeof import('../src/rumampu/speech-recognition');

function load(native: unknown) {
  const exports = {};
  const cleanups: Array<() => void> = [];
  const source = readFileSync(new URL('../src/rumampu/speech-recognition.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  runInNewContext(outputText, {
    exports,
    require(name: string) {
      if (name === 'expo') return {
        requireOptionalNativeModule(moduleName: string) {
          assert.equal(moduleName, 'ExpoSpeechRecognition');
          return native;
        },
      };
      if (name === 'react') return {
        useRef: (value: unknown) => ({ current: value }),
        useEffect: (effect: () => (() => void) | undefined) => {
          const cleanup = effect();
          if (cleanup) cleanups.push(cleanup);
        },
      };
      throw new Error(`Unexpected runtime import: ${name}`);
    },
  });
  return { adapter: exports as Adapter, cleanups };
}

describe('native speech availability', () => {
  it('opens without the speech module and reports voice unavailable in Expo Go', async () => {
    const { adapter, cleanups } = load(null);
    assert.equal(adapter.ExpoSpeechRecognitionModule.isRecognitionAvailable(), false);
    assert.equal((await adapter.ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted, false);
    adapter.ExpoSpeechRecognitionModule.stop();
    adapter.ExpoSpeechRecognitionModule.abort();
    adapter.useSpeechRecognitionEvent('start', () => assert.fail('No native events should fire'));
    assert.equal(cleanups.length, 0);
    assert.throws(() => adapter.ExpoSpeechRecognitionModule.start({ lang: 'en-MY' }), /requires a native build/);
  });

  it('forwards recognition, permissions and subscriptions when a build includes the module', async () => {
    const calls: string[] = [];
    let listener: ((event: null) => void) | undefined;
    const native = {
      isRecognitionAvailable: () => true,
      requestPermissionsAsync: async () => ({ granted: true }),
      start: (options: { lang?: string }) => calls.push(`start:${options.lang}`),
      stop: () => calls.push('stop'),
      abort: () => calls.push('abort'),
      addListener(name: string, callback: (event: null) => void) {
        assert.equal(name, 'start');
        listener = callback;
        return { remove: () => calls.push('unsubscribe') };
      },
    };
    const { adapter, cleanups } = load(native);
    assert.equal(adapter.ExpoSpeechRecognitionModule.isRecognitionAvailable(), true);
    assert.equal((await adapter.ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted, true);
    adapter.ExpoSpeechRecognitionModule.start({ lang: 'en-MY' });
    adapter.ExpoSpeechRecognitionModule.stop();
    adapter.ExpoSpeechRecognitionModule.abort();
    let starts = 0;
    adapter.useSpeechRecognitionEvent('start', () => starts++);
    listener!(null);
    assert.equal(starts, 1);
    cleanups[0]();
    assert.deepEqual(calls, ['start:en-MY', 'stop', 'abort', 'unsubscribe']);
  });
});
