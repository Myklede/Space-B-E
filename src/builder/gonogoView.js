// SEED: Sub-AI 2 replaces this file (keep the export and its arguments; see README-ARCH.md and the Sub-AI 2 prompt).
// Reveals the Go/No-Go console lines one by one, driven by update(dt) from the module loop (no timers, no rAF).
import { events } from '/src/core/index.js';

const STATUS_CLASS = { GO: 'hud-good', 'NO-GO': 'hud-caution', BLOCK: 'hud-alert' };
const INTERVAL = 0.7; // seconds between consoles

export function createGonogoView({ parent, lines, onReveal, onDone }) {
  const root = document.createElement('div');
  root.className = 'gng-lines';
  parent.append(root);
  const cursor = document.createElement('span');
  cursor.className = 'gng-cursor';
  root.append(cursor);
  let shown = 0;
  let clock = 0;
  let done = false;

  function reveal() {
    const line = lines[shown];
    const el = document.createElement('div');
    el.className = `gng-line ${STATUS_CLASS[line.status] ?? 'hud-ok'}`;
    el.dataset.status = line.status;
    const console_ = document.createElement('span');
    console_.className = 'gng-line-console';
    console_.textContent = `${line.console}…`;
    const status = document.createElement('span');
    status.className = 'gng-status';
    status.textContent = line.status;
    const text = document.createElement('span');
    text.className = 'gng-line-text';
    text.textContent = line.text;
    if (line.guidebook) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'gng-link';
      link.textContent = '?';
      link.title = 'Open the Guidebook';
      link.addEventListener('click', () => events.emit('guidebook:open', { entryId: line.guidebook }));
      text.append(link);
    }
    el.append(console_, status, text);
    root.insertBefore(el, cursor);
    onReveal?.(line, shown);
    shown += 1;
    if (shown >= lines.length) finish();
  }

  function finish() {
    if (done) return;
    done = true;
    cursor.remove();
    onDone?.();
  }

  return {
    update(dt) {
      if (done) return;
      clock += dt;
      if (clock >= INTERVAL || shown === 0) {
        clock = 0;
        reveal();
      }
    },
    skip() {
      while (!done && shown < lines.length) reveal();
      finish();
    },
    dispose() {
      root.remove();
    },
  };
}
