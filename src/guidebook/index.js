// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import { events, ui } from '/src/core/index.js';

let overlay = null;

function close() {
  if (overlay) ui.unmount(overlay);
  overlay = null;
}

export default {
  init() {
    events.on('guidebook:open', ({ entryId }) => {
      close();
      overlay = document.createElement('div');
      overlay.className = 'hud-panel';
      overlay.style.cssText = 'position:absolute;right:24px;top:24px;width:min(360px,calc(100vw - 48px));display:grid;gap:10px';
      const label = document.createElement('div');
      label.className = 'hud-label';
      label.textContent = 'STUB screen. Owner: Role 4 (Guidebook)';
      const text = document.createElement('div');
      text.textContent = `Guidebook entry: ${entryId}`;
      const button = document.createElement('button');
      button.className = 'hud-button';
      button.type = 'button';
      button.textContent = 'Close';
      button.addEventListener('click', close);
      overlay.append(label, text, button);
      ui.mountPersistent(overlay);
    });
  },
};
