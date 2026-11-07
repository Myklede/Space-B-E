// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
// Shows a Guidebook card from entries.json on guidebook:open. The full Guidebook (index, unlocks) comes later.
import { events, input, ui } from '/src/core/index.js';
import entries from './entries.json';

let overlay = null;
let offKey = null;
let timer = null;

function close() {
  if (overlay) ui.unmount(overlay);
  offKey?.();
  clearTimeout(timer);
  overlay = offKey = timer = null;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function card(entryId) {
  const entry = entries[entryId];
  const panel = el('div', 'hud-panel');
  panel.dataset.guidebook = entryId;
  // The card never blocks the game (the player is usually walking with the mouse locked); only the button is clickable.
  panel.style.cssText = 'position:absolute;right:24px;top:24px;width:min(380px,calc(100vw - 48px));display:grid;gap:10px;pointer-events:none';

  panel.append(el('div', 'hud-label', `Guidebook · ${entry?.category ?? 'Entry'}`));
  panel.append(el('div', 'hud-value', entry?.title ?? entryId));
  if (!entry) {
    console.warn(`[guidebook] no entry "${entryId}" in src/guidebook/entries.json`);
    panel.append(el('div', null, 'This entry has not been written yet.'));
  } else {
    panel.append(el('div', null, entry.body));
    if (entry.numbers?.length) {
      const box = el('div', 'hud-panel');
      box.style.cssText = 'display:grid;gap:4px;padding:8px 10px';
      box.append(el('div', 'hud-label', 'Real numbers'));
      for (const line of entry.numbers) box.append(el('div', null, line));
      panel.append(box);
    }
    if (entry.source) {
      const source = el('div', 'hud-label', `Source: ${entry.source}`);
      source.style.textTransform = 'none';
      panel.append(source);
    }
  }

  const button = el('button', 'hud-button', 'Close [Q]');
  button.type = 'button';
  button.style.pointerEvents = 'auto';
  button.style.justifySelf = 'start';
  button.addEventListener('click', close);
  panel.append(button);
  return panel;
}

export default {
  init() {
    events.on('guidebook:open', ({ entryId }) => {
      close();
      overlay = card(entryId);
      ui.mount(overlay); // removed on the next state change
      offKey = input.onPress('KeyQ', close); // input handlers are also cleared on state change
      timer = setTimeout(close, 20000);
    });
  },
};
