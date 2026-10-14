import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BrowserSpeech } from '../src/rumampu/browser-speech.ts';

class Recognizer extends EventTarget {
  lang = ''; interimResults = false; continuous = false; maxAlternatives = 1;
  autoStart = true; autoEnd = true; aborts = 0;
  start() { if (this.autoStart) this.dispatchEvent(new Event('start')); }
  stop() { if (this.autoEnd) this.dispatchEvent(new Event('end')); }
  abort() { this.aborts++; if (this.autoEnd) this.dispatchEvent(new Event('end')); }
  result(text: string, isFinal = true) {
    const alternatives = Object.assign([{ transcript: text, confidence: 1 }], { isFinal });
    this.dispatchEvent(Object.assign(new Event('result'), { resultIndex: 0, results: [alternatives] }));
  }
}

function setup() {
  const instances: Recognizer[] = [];
  const speech = new BrowserSpeech(() => {
    const recognizer = new Recognizer(); instances.push(recognizer); return recognizer;
  });
  const results: string[] = [];
  const errors: string[] = [];
  speech.addListener('result', event => results.push(event.results[0].transcript));
  speech.addListener('error', event => errors.push(event.error));
  return { speech, instances, results, errors };
}

describe('browser speech session recovery', () => {
  it('recognizes repeated recordings and ignores abandoned recognizer events', () => {
    const { speech, instances, results } = setup();
    speech.start({ lang: 'en-MY' });
    instances[0].result('first');
    speech.stop();
    speech.start({ lang: 'en-MY' });
    instances[0].result('stale');
    instances[0].dispatchEvent(new Event('end'));
    instances[1].result('second');
    speech.stop();
    assert.deepEqual(results, ['first', 'second']);
  });

  it('recovers when Safari never sends start or error', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const recognizer = new Recognizer(); recognizer.autoStart = false;
    const speech = new BrowserSpeech(() => recognizer);
    const errors: string[] = [];
    speech.addListener('error', event => errors.push(event.error));
    speech.start({ lang: 'en-MY' });
    context.mock.timers.tick(12000);
    assert.deepEqual(errors, ['no-speech']);
    assert.equal(recognizer.aborts, 1);
    recognizer.autoStart = true;
    speech.start({ lang: 'en-MY' });
    speech.abort();
  });

  it('times out a started recognizer that produces no results', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { speech, instances, errors } = setup();
    speech.start({ lang: 'en-MY' });
    context.mock.timers.tick(12000);
    assert.deepEqual(errors, ['no-speech']);
    assert.equal(instances[0].aborts, 1);
  });

  it('waits for abort end before accepting a new tap', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { speech, instances } = setup();
    speech.start({ lang: 'en-MY' });
    instances[0].autoEnd = false;
    speech.abort();
    assert.throws(() => speech.start({ lang: 'en-MY' }), /still closing/);
    instances[0].dispatchEvent(new Event('end'));
    speech.start({ lang: 'en-MY' });
    speech.abort();
  });

  it('recovers from a missing stop/end event without waiting forever', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { speech, instances } = setup();
    let ends = 0; speech.addListener('end', () => ends++);
    speech.start({ lang: 'en-MY' });
    instances[0].autoEnd = false;
    speech.stop();
    context.mock.timers.tick(5000);
    assert.equal(ends, 1);
    assert.equal(instances[0].aborts, 1);
    context.mock.timers.tick(1500);
    speech.start({ lang: 'en-MY' });
    speech.abort();
  });

  it('removes subscriptions and cleans up a synchronous start failure', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { speech, instances, results } = setup();
    let calls = 0;
    const subscription = speech.addListener('start', () => calls++);
    subscription.remove();
    speech.start({ lang: 'en-MY' });
    assert.equal(calls, 0);
    speech.abort();
    instances[0].result('discarded');
    assert.deepEqual(results, []);
    const broken = new Recognizer(); broken.start = () => { throw new Error('blocked'); };
    const failed = new BrowserSpeech(() => broken);
    assert.throws(() => failed.start({ lang: 'en-MY' }), /blocked/);
    assert.equal(broken.aborts, 1);
  });

  it('does not repeat earlier final results in continuous mode', () => {
    const { speech, instances, results } = setup();
    speech.start({ lang: 'en-MY', continuous: true });
    instances[0].result('first');
    const final = (text: string) => Object.assign([{ transcript: text, confidence: 1 }], { isFinal: true });
    instances[0].dispatchEvent(Object.assign(new Event('result'), {
      resultIndex: 1, results: [final('first'), final('second')],
    }));
    speech.abort();
    assert.deepEqual(results, ['first', 'second']);
  });
  it('maps Safari aborted/no-speech to a recoverable error', () => {
    const { speech, instances, errors } = setup();
    speech.start({ lang: 'en-MY' });
    instances[0].dispatchEvent(Object.assign(new Event('error'), {
      error: 'aborted', message: 'No speech detected',
    }));
    assert.deepEqual(errors, ['no-speech']);
    speech.start({ lang: 'en-MY' });
    speech.abort();
  });

  it('preserves Safari final results delivered more than 1.5 seconds after stop', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { speech, instances, results } = setup();
    speech.start({ lang: 'en-MY' });
    instances[0].autoEnd = false;
    speech.stop();
    context.mock.timers.tick(2000);
    instances[0].result('final words');
    instances[0].dispatchEvent(new Event('end'));
    assert.deepEqual(results, ['final words']);
    assert.equal(instances[0].aborts, 0);
  });

  it('keeps a bounded stop timeout even if interim results continue', context => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const { speech, instances } = setup();
    speech.start({ lang: 'en-MY' });
    instances[0].autoEnd = false;
    speech.stop();
    context.mock.timers.tick(4500);
    instances[0].result('interim', false);
    context.mock.timers.tick(500);
    assert.equal(instances[0].aborts, 1);
    context.mock.timers.tick(1500);
  });

});
