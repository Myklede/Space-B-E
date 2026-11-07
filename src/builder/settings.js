// SEED: Sub-AI 2 replaces this file (keep the exports; see README-ARCH.md and the Sub-AI 2 prompt).
// Settings and the Esc pause menu. Persistent overlays through ui.mountPersistent; saved through save.
import { graphics } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';
import { events, input, save, ui } from '/src/core/index.js';

let settingsEl = null;
let pauseEl = null;

function panel(className, title) {
  const root = document.createElement('div');
  root.className = `${className}-root hud`;
  const box = document.createElement('div');
  box.className = `${className}-panel hud-panel`;
  const h = document.createElement('div');
  h.className = 'hud-label';
  h.textContent = title;
  box.append(h);
  root.append(box);
  return { root, box };
}

function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hud-button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** Opens the settings overlay. Returns a close() function. */
export function openSettings({ onClose } = {}) {
  if (settingsEl) return () => close();
  const s = save.load();
  const { root, box } = panel('settings', 'Settings');
  const row = (label, control) => {
    const r = document.createElement('label');
    r.className = 'settings-row';
    const l = document.createElement('span');
    l.textContent = label;
    r.append(l, control);
    box.append(r);
  };
  const range = (key, min, max, step, fallback, apply) => {
    const i = document.createElement('input');
    i.type = 'range';
    i.min = min; i.max = max; i.step = step;
    i.value = s[key] ?? fallback;
    i.addEventListener('input', () => { save.update({ [key]: Number(i.value) }); apply?.(Number(i.value)); });
    return i;
  };
  const check = (key, apply) => {
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = !!s[key];
    i.addEventListener('change', () => { save.update({ [key]: i.checked }); apply?.(i.checked); });
    return i;
  };
  row('Mouse sensitivity', range('sensitivity', 0.2, 3, 0.1, 1));
  row('Invert Y', check('invertY'));
  const quality = document.createElement('select');
  for (const q of ['high', 'low']) {
    const o = document.createElement('option');
    o.value = q; o.textContent = q;
    o.selected = (s.quality ?? 'high') === q;
    quality.append(o);
  }
  quality.addEventListener('change', () => { save.update({ quality: quality.value }); graphics.setQuality(quality.value); });
  row('Graphics quality', quality);
  row('Volume', range('volume', 0, 1, 0.05, 1, (v) => audio.setVolume(v)));
  row('Skip sensitive scenes', check('skipSensitive'));
  const actions = document.createElement('div');
  actions.className = 'bld-dialog-actions';
  actions.append(button('CLOSE', () => close()));
  box.append(actions);
  settingsEl = ui.mountPersistent(root);
  function close() {
    if (!settingsEl) return;
    ui.unmount(settingsEl);
    settingsEl = null;
    onClose?.();
  }
  return close;
}

/** Opens the Esc pause menu. Returns a close() function. */
export function openPauseMenu({ onResume } = {}) {
  if (pauseEl) return () => close();
  const { root, box } = panel('pause', 'Paused');
  const buttons = document.createElement('div');
  buttons.className = 'pause-buttons';
  buttons.append(
    button('RESUME', () => close()),
    button('GUIDEBOOK', () => events.emit('guidebook:open', { entryId: 'newtons-laws' })),
    button('SETTINGS', () => openSettings()),
    button('QUIT TO MENU', () => location.reload()),
  );
  box.append(buttons);
  pauseEl = ui.mountPersistent(root);
  input.onEscape(() => close());
  function close() {
    if (!pauseEl) return;
    ui.unmount(pauseEl);
    pauseEl = null;
    onResume?.();
  }
  return close;
}
