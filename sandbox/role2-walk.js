import { graphics } from '../src/graphics/index.js';
import '../src/ui/theme.css';
import { createIntegratedWalkScene } from '../src/flight/scenes/role3Bridge.js';
import { createBodyStats } from '../src/surface/bodyStats.js';
import { createOxygen } from '../src/surface/oxygen.js';
import { MOCK_PLANETS } from '../src/flight/presets.js';

graphics.init({ quality: new URLSearchParams(location.search).get('q') ?? 'high' });

let current;
let pendingMode;
let mode;
let last = performance.now();
const message = document.getElementById('message');
const bus = {
  emit(name, payload) {
    if (name === 'state:request') {
      if (payload.to === 'SURFACE') pendingMode = 'eva';
      else if (payload.to === 'INTERIOR') pendingMode = 'cabin';
      else message.textContent = `Pilot seat requested ${payload.to}; flight demo: /sandbox/role2-scenes.html`;
    } else if (name === 'interior:interact') {
      message.textContent = `Station: ${payload.stationId}`;
    }
  },
};
const oxygen = createOxygen({ bus, tankSeconds: 300, spareTanks: 2 });
const session = { suited: false };
const bodyStats = createBodyStats({ bus });
const nav = document.querySelector('nav');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function select(next) {
  current?.dispose();
  mode = next;
  current = createIntegratedWalkScene({
    bus,
    planets: MOCK_PLANETS,
    kind: mode,
    session,
    oxygen,
    bodyStats,
    reducedMotion,
    onOxygenLevel({ level }) { message.textContent = `O₂ status: ${level}`; },
  });
  if (mode === 'eva') {
    // Demonstrates Role 4's public registration hook without awarding mission rewards.
    current.interactables.register({
      id: 'debug-scanner',
      position: { x: 2, y: 1.2, z: 6 },
      radius: 2.5,
      hold: 2,
      prompt: 'Hold E: test scanner (debug)',
      onUse() { message.textContent = 'Scanner hold completed'; },
    });
  }
  window.walkScene = current;
  history.replaceState(null, '', `?mode=${mode}&debug=1`);
  for (const button of nav.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
}

function button(text, onClick) {
  const element = document.createElement('button');
  element.textContent = text;
  element.onclick = onClick;
  nav.append(element);
  return element;
}
for (const kind of ['cabin', 'eva']) button(kind, () => { pendingMode = kind; }).dataset.mode = kind;
for (const percent of [25, 10, 3, 0]) {
  button(`O₂ ${percent}%`, () => {
    oxygen.refill();
    oxygen.update(300 * (1 - percent / 100), { inside: false, suited: true });
  });
}
button('Refill', () => oxygen.refill());

const query = new URLSearchParams(location.search);
select(query.get('mode') === 'eva' ? 'eva' : 'cabin');
function frame(now) {
  const dt = document.hidden ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;
  // Change scenes between frames; interactions never dispose their own active update.
  if (pendingMode) {
    const next = pendingMode;
    pendingMode = null;
    select(next);
  }
  try {
    current.update(dt);
  } catch (error) {
    document.getElementById('error').textContent = error.message;
    throw error;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('pagehide', () => {
  current?.dispose();
}, { once: true });
