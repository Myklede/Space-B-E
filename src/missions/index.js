// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import { contract, events } from '/src/core/index.js';

const done = new Set();
let percent = 0;

/** Current Mars Exploration progress: { percent, completed }. */
export function getProgress() {
  return { percent, completed: [...done] };
}

export default {
  init() {
    events.on('task:completed', ({ taskId }) => {
      const task = contract.TASKS[taskId];
      if (!task || done.has(taskId)) return;
      done.add(taskId);
      percent = Math.min(100, percent + task.weight);
      events.emit('progress:changed', { percent });
    });
  },
};
