import assert from 'node:assert/strict';
import test from 'node:test';
import { canQuickStart, finalMessage, quickStartData, stepIndex } from './prelaunchFlow.js';

test('first visit with an empty save runs the full ritual', () => {
  assert.equal(canQuickStart({ visits: 1, saved: {} }), false);
  assert.equal(canQuickStart({ visits: 1, saved: { familyPhoto: 'sister' } }), false);
  assert.equal(canQuickStart({ visits: 1, saved: { messageHome: '   ' , familyPhoto: 'sister' } }), false);
  assert.equal(canQuickStart(), false);
});
test('second visit in a session can skip', () => {
  assert.equal(canQuickStart({ visits: 2, saved: {} }), true);
});
test('a previous save does not skip the first visit in a new session', () => {
  assert.equal(canQuickStart({ visits: 1, saved: { familyPhoto: 'parents', messageHome: 'Love you' } }), false);
});
test('quickStart data and message fallback', () => {
  assert.deepEqual(quickStartData(), { quickStart: true });
  assert.equal(finalMessage('  hi ', 'x'), 'hi');
  assert.equal(finalMessage('   ', 'x'), 'x');
  assert.equal(finalMessage(undefined, 'x'), 'x');
});
test('stepIndex wraps', () => {
  assert.equal(stepIndex(0, -1, 3), 2);
  assert.equal(stepIndex(2, 1, 3), 0);
});
