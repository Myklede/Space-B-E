// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import { contract, events } from '/src/core/index.js';

const TASK_IDS = Object.keys(contract.TASKS);
const done = new Set();
let percent = 0;

// Recompute from the finished set instead of adding weights one by one: the three samples weigh 25/3 each, and
// summing floats in some orders ends at 99.99999999999999, which would block the return (it needs percent >= 100).
function computePercent() {
  if (done.size === TASK_IDS.length) return 100;
  let sum = 0;
  for (const id of done) sum += contract.TASKS[id].weight;
  return Math.min(100, Math.round(sum * 100) / 100);
}

/** Current Mars Exploration progress: { percent, completed }. percent is exactly 100 once every task is done. */
export function getProgress() {
  return { percent, completed: [...done] };
}

export default {
  init() {
    events.on('task:completed', ({ taskId }) => {
      if (!(taskId in contract.TASKS) || done.has(taskId)) return;
      done.add(taskId);
      percent = computePercent();
      events.emit('progress:changed', { percent });
      if (percent === 100) events.emit('mission:complete', {});
    });
    // A new ship is a new mission: Mars progress starts again from 0.
    events.on('ship:built', () => {
      done.clear();
      percent = 0;
      events.emit('progress:changed', { percent });
    });
  },
};
