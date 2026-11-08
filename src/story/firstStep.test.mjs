// Node tests for the story side of the first step. Run: node src/story/firstStep.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import data from './data.json' with { type: 'json' };
import entries from '../guidebook/entries.json' with { type: 'json' };
import { createFirstStepWatcher } from './firstStep.js';

function setup(getWords) {
  const calls = [];
  const w = createFirstStepWatcher({ getWords, onWords: (x) => calls.push(['words', x]), onPlain: () => calls.push(['plain']) });
  return { w, calls };
}

test('through the airlock: silent until the words come, then answered once', () => {
  let words = null;
  const { w, calls } = setup(() => words);
  w.surface('INTERIOR');
  w.tick();
  assert.deepEqual(calls, []);
  assert.equal(w.waiting, true);
  words = '  One small step ';
  w.tick();
  w.tick();
  assert.deepEqual(calls, [['words', 'One small step']]);
  w.surface('INTERIOR'); // a second EVA
  assert.deepEqual(calls.at(-1), ['plain']);
});

test('debug start straight into SURFACE: no first step, plain orders', () => {
  const { w, calls } = setup(() => null);
  w.surface('LANDING');
  assert.deepEqual(calls, [['plain']]);
  assert.equal(w.waiting, false);
});

test('missing or broken Role 2 API never blocks the orders', () => {
  const a = setup(undefined);
  a.w.surface('INTERIOR');
  assert.deepEqual(a.calls, [['plain']]);
  const b = setup(() => { throw new Error('no surface'); });
  b.w.surface('INTERIOR');
  b.w.tick();
  assert.deepEqual(b.calls, []); // still waiting; the words may come
  b.w.leave();
  assert.equal(b.w.waiting, false);
});

test('reset starts a new mission', () => {
  const { w, calls } = setup(() => 'Hello, Mars.');
  w.surface('INTERIOR');
  w.reset();
  w.surface('INTERIOR');
  assert.deepEqual(calls, [['words', 'Hello, Mars.'], ['words', 'Hello, Mars.']]);
});

test('the radio line and the Guidebook entry exist', () => {
  assert.match(data.radio.firstWords.text, /\{words\}/);
  assert.equal(data.radio.firstWords.from, 'HQ');
  const e = entries['first-step'];
  assert.ok(e && e.title && e.body && e.source && e.numbers.length >= 2);
});
