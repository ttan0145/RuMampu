import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyVoiceIntent, isQuestionWithoutRecordInstruction } from '../src/rumampu/voice-intent.ts';

describe('voice intent boundary', () => {
  it('keeps a housing question out of the entry reader', () => {
    assert.deepEqual(classifyVoiceIntent('Can I afford a house?'), {
      kind: 'question', questionText: 'Can I afford a house?',
    });
    assert.equal(classifyVoiceIntent('How much did I spend this month?').kind, 'question');
  });

  it('reads polite recording requests without asking for intent again', () => {
    const said = 'can you help me add 50 ringgit into income from grab today';
    assert.deepEqual(classifyVoiceIntent(said), { kind: 'entry', entryText: said });
    assert.equal(classifyVoiceIntent('Can you record RM 20 for lunch?').kind, 'entry');
    assert.equal(classifyVoiceIntent('Boleh tolong tambah pendapatan RM15 hari ini?').kind, 'entry');
    assert.equal(classifyVoiceIntent('可以帮我添加15令吉收入吗？').kind, 'entry');
  });

  it('asks for intent when a stated entry is phrased as an uncertain question', () => {
    assert.equal(classifyVoiceIntent('I spent RM 20 on lunch?').kind, 'ambiguous');
    assert.equal(classifyVoiceIntent('Should I save RM 50 today?').kind, 'ambiguous');
  });

  it('carries a separate question alongside the exact entry clause', () => {
    assert.deepEqual(classifyVoiceIntent('I spent RM 20 on lunch. Can I afford a house?'), {
      kind: 'mixed', entryText: 'I spent RM 20 on lunch.', questionText: 'Can I afford a house?',
    });
    assert.deepEqual(classifyVoiceIntent('I earned 47 from Grab and how much can I save?'), {
      kind: 'mixed', entryText: 'I earned 47 from Grab', questionText: 'how much can I save?',
    });
  });

  it('keeps two stated entries together', () => {
    assert.equal(classifyVoiceIntent('Earned 47 from Grab and spent 12 on lunch').kind, 'entry');
  });

  it('keeps Ask Ruma questions out of action preview while allowing explicit changes', () => {
    assert.equal(isQuestionWithoutRecordInstruction('Did I spend RM200 on food?'), true);
    assert.equal(isQuestionWithoutRecordInstruction('I spent RM200 on food?'), true);
    assert.equal(isQuestionWithoutRecordInstruction('Can you record RM20 for lunch?'), false);
    assert.equal(isQuestionWithoutRecordInstruction('can you help add 50 ringgit as income'), false);
    assert.equal(isQuestionWithoutRecordInstruction('Boleh tolong tambah pendapatan RM15 hari ini?'), false);
    assert.equal(isQuestionWithoutRecordInstruction('可以帮我添加15令吉收入吗？'), false);
    assert.equal(isQuestionWithoutRecordInstruction('Can you help me enter an income?'), false);
    assert.equal(isQuestionWithoutRecordInstruction('Can you help me understand income?'), true);
    assert.equal(isQuestionWithoutRecordInstruction('Boleh saya tahu pendapatan bulan ini?'), true);
    assert.equal(isQuestionWithoutRecordInstruction('可以帮我了解这个月的收入吗？'), true);
    assert.equal(isQuestionWithoutRecordInstruction('Could you set my food limit to RM300?'), false);
    assert.equal(isQuestionWithoutRecordInstruction('I spent RM20 on food. Did I overspend?'), false);
  });
});
