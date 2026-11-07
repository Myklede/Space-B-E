// The engineering-bay UI layer (state HANGAR): the walking HUD (crosshair, prompt, status chip) and the station
// panels that open when the player uses a machine. It edits the Assembly directly and tells index.js via hooks.
import { SYMMETRIES } from './assembly.js';
import { autoAttach } from './autoplace.js';
import { createHandbook } from './handbook.js';
import { fmtInt, fmtKN, fmtMass, fmtMoney, fmtMoneyShort, fmtPct } from './format.js';

const WARNING_LABELS = {
  LOW_DV: 'Low Δv', LOW_TWR: 'Low TWR', NO_HEAT_SHIELD: 'No heat shield', NO_LEGS: 'No landing legs', UNSTABLE: 'Unstable',
  LOW_O2: 'No spare O₂', NO_ANTENNA: 'No antenna', NO_SHELTER: 'No radiation shelter', COLD_SEALS: 'Seals not cold-rated', LOW_RELIABILITY: 'Low reliability',
  NO_CAPSULE: 'No capsule', NO_ENGINE: 'No engine', NO_FUEL: 'No usable fuel', NOT_CONNECTED: 'Parts not connected', OVER_BUDGET: 'Over budget',
};
export const DESIGN_STATIONS = ['integration', 'propulsion', 'structures', 'crew', 'warehouse']; // these project the hologram
const STATION_FAMILIES = {
  propulsion: ['engines', 'tanks'],
  structures: ['structure', 'thermal', 'recovery', 'control'],
  crew: ['command', 'life', 'power', 'comms', 'protection', 'science', 'seals'],
  warehouse: null, // all
};

const h = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
};
const btn = (className, label, onClick, attrs = {}) => {
  const b = h('button', className, label);
  b.type = 'button';
  Object.assign(b.dataset, attrs);
  if (onClick) b.addEventListener('click', onClick);
  return b;
};

export function createHangarScreen({ assembly, catalog, launch, text, scene, getMoney, insolvencyFloor = 0, icons, stations, hooks }) {
  const el = h('div', 'bay-root hud');
  el.dataset.screen = 'hangar';
  el.dataset.stub = 'hangar'; // check:boot looks for [data-stub] in every state
  const state = { family: null, node: null, part: null, station: null, detail: null, testResult: null, testStatus: '' };
  let last = null;

  // ---------- walking HUD ----------
  const hud = h('div', 'bay-hud');
  const crosshair = h('div', 'bay-crosshair');
  const prompt = h('div', 'bay-prompt');
  const chip = h('div', 'bay-chip hud-panel');
  const chipShip = h('span', 'bay-chip-ship');
  const chipStats = h('span', 'bay-chip-stats');
  const chipFunds = h('span', 'bay-chip-funds');
  chip.append(chipShip, chipStats, chipFunds);
  const hint = h('div', 'bay-hint', 'Click to look around · WASD walk · Shift run · E use a machine · H handbook · Esc menu');
  const toast = h('div', 'bay-toast');
  const testStatus = h('div', 'bay-test-status hud-panel hud-caution');
  testStatus.hidden = true;
  hud.append(crosshair, prompt, chip, hint, toast, testStatus);

  // ---------- markers (integration console) ----------
  const markers = h('div', 'bld-markers');
  markers.hidden = true;

  // ---------- station panel ----------
  const panel = h('section', 'bay-station hud-panel');
  panel.hidden = true;
  const head = h('header', 'bay-station-head');
  const title = h('div', 'bay-station-title');
  const role = h('div', 'bay-station-role');
  const closeBtn = btn('hud-button bay-station-close', 'CLOSE  [Esc]', () => closeStation());
  head.append(title, role, closeBtn);
  const body = h('div', 'bay-station-body');
  panel.append(head, body);
  const lensHost = h('div', 'bld-lens'); // the Formula Lens (index.js) lives here and moves into the integration panel

  // ---------- dialog ----------
  const backdrop = h('div', 'bld-dialog-backdrop');
  backdrop.hidden = true;
  const dialog = h('div', 'bld-dialog hud-panel');
  backdrop.append(dialog);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(); });

  el.append(hud, markers, panel, backdrop);

  let toastTimer = null;
  function say(message, kind = 'ok') {
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.classList.add('bay-toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('bay-toast--show'), 2600);
  }
  const sound = (id) => hooks.onSound?.(id);
  const changed = () => hooks.onChange?.();

  // ---------- selection on the stand ----------
  function selectNode(partId, node) {
    state.node = partId ? { partId, node } : null;
    state.part = null;
    scene.select(null);
    renderIntegration();
  }
  function selectPart(id) {
    state.part = id;
    state.node = null;
    scene.select(id);
    renderIntegration();
  }
  function removeSelected() {
    if (!state.part) return;
    const name = assembly.def(state.part)?.name;
    if (assembly.remove(state.part).length) {
      sound('ui.click');
      say(`${name} removed.`);
      state.part = null;
      scene.select(null);
      changed();
    }
  }
  function addAtNode(typeId) {
    const def = catalog.get(typeId);
    if (!def) return;
    let ids = [];
    if (!assembly.parts.length) ids = assembly.attach(typeId);
    else if (state.node) ids = assembly.attach(typeId, state.node.partId, state.node.node);
    if (!ids.length) { sound('ui.error'); say('That part does not fit there.', 'bad'); return; }
    sound('ui.snap');
    if (def.attach === 'axial') {
      const far = state.node?.node === 'top' ? 'top' : 'bottom';
      state.node = def.nodes.includes(far) ? { partId: ids[0], node: far } : null;
    }
    say(`${def.name} attached.`);
    changed();
  }
  function addAuto(typeId) {
    const { ids, message } = autoAttach(assembly, typeId);
    if (!ids.length) { sound('ui.error'); say(message, 'bad'); return; }
    sound('ui.snap');
    say(message);
    changed();
  }

  // ---------- markers ----------
  let dragging = null;
  const markerEls = new Map();
  function dropTarget(m, partId, node) {
    m.addEventListener('dragover', (e) => {
      if (!dragging || !assembly.canAttach(dragging, partId, node).ok) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      m.classList.add('bld-node--target');
    });
    m.addEventListener('dragleave', () => m.classList.remove('bld-node--target'));
    m.addEventListener('drop', (e) => {
      e.preventDefault();
      m.classList.remove('bld-node--target');
      const type = e.dataTransfer.getData('text/plain') || dragging;
      dragging = null;
      if (!type) return;
      state.node = { partId, node };
      state.part = null;
      addAtNode(type);
    });
  }
  // Markers sit on the hologram when a console projects one, otherwise on the real vehicle.
  const liveAnchors = () => (scene.hologram?.visible ? scene.hologram.worldAnchors() : scene.worldAnchors());
  function renderMarkers() {
    const anchors = liveAnchors();
    const keys = new Set();
    for (const a of anchors) {
      const key = a.kind === 'node' ? `n:${a.partId}:${a.node}` : `h:${a.partId}`;
      keys.add(key);
      let m = markerEls.get(key);
      if (!m) {
        if (a.kind === 'node') {
          m = btn('bld-node', '', () => { sound('ui.click'); selectNode(a.partId, a.node); }, { node: a.node, part: a.partId });
          m.title = `${a.node} node of ${assembly.def(a.partId)?.name ?? a.partId}: click, or drop a part here`;
          dropTarget(m, a.partId, a.node);
        } else {
          const name = assembly.def(a.partId)?.name ?? a.partId;
          const radial = assembly.part(a.partId)?.node === 'radial';
          m = btn(`bld-handle${radial ? ' bld-handle--radial' : ''}`, name, () => { sound('ui.click'); selectPart(a.partId); }, { part: a.partId });
          m.title = `${name}: click to select`;
        }
        markers.append(m);
        markerEls.set(key, m);
      }
      const pressed = a.kind === 'node' ? state.node?.partId === a.partId && state.node?.node === a.node : state.part === a.partId;
      m.setAttribute('aria-pressed', String(pressed));
    }
    for (const [key, m] of markerEls) if (!keys.has(key)) { m.remove(); markerEls.delete(key); }
  }
  function projectMarkers() {
    if (markers.hidden) return;
    const rect = markers.getBoundingClientRect();
    if (!rect.width) return;
    const cam = scene.camera;
    cam.updateMatrixWorld();
    const W = window.innerWidth, H = window.innerHeight;
    for (const a of liveAnchors()) {
      const key = a.kind === 'node' ? `n:${a.partId}:${a.node}` : `h:${a.partId}`;
      const m = markerEls.get(key);
      if (!m) continue;
      const p = a.world.project(cam);
      const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      m.classList.toggle('bld-marker-hidden', !visible);
      if (!visible) continue;
      m.style.left = `${((p.x + 1) / 2 * W - rect.left).toFixed(1)}px`;
      m.style.top = `${((1 - p.y) / 2 * H - rect.top).toFixed(1)}px`;
    }
  }

  // ---------- shared pieces ----------
  function partCard(def, { onClick, pressed = false } = {}) {
    const card = btn('bay-card', null, onClick, { part: def.id });
    card.setAttribute('aria-pressed', String(pressed));
    const img = h('img', 'bay-card-img');
    img.alt = def.name;
    img.src = icons?.iconFor(def) || '';
    img.draggable = false;
    const cost = def.engine ? 'engine: configure in the workshop' : fmtMoneyShort(def.cost);
    card.append(img, h('div', 'bay-card-name', def.name), h('div', 'bay-card-role', def.role ?? def.desc ?? ''), h('div', 'bay-card-meta', `${fmtMass(def.mass + (def.fuel?.mass ?? 0))} · ${cost}`));
    card.draggable = assembly.parts.length > 0;
    card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', def.id); e.dataTransfer.effectAllowed = 'copy'; dragging = def.id; card.classList.add('bld-part--dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('bld-part--dragging'); dragging = null; });
    return card;
  }

  function statsGrid(result) {
    const { spec, breakdown, blocks } = result;
    const s = spec.stats;
    const grid = h('div', 'bld-stat-grid');
    const fee = breakdown.slot?.fee ?? 0;
    const stat = (label, value, st = 'ok') => {
      const el_ = h('div', 'bld-stat');
      el_.dataset.state = st;
      el_.append(h('span', 'bld-stat-label', label), h('span', 'bld-stat-value', value));
      grid.append(el_);
    };
    stat('Cost', `${fmtMoney(s.cost)}${fee ? ` + ${fmtMoneyShort(fee)} pad` : ''}`, s.cost + fee > getMoney() ? 'bad' : 'ok');
    stat('Mass wet / dry', `${fmtMass(s.wetMass)} / ${fmtMass(s.dryMass)}`);
    stat('Propellant', `${fmtMass(s.fuelMass)}${breakdown.deadFuel ? ` (+${fmtMass(breakdown.deadFuel)} unusable)` : ''}`, s.fuelMass > 0 ? (breakdown.deadFuel ? 'warn' : 'ok') : 'bad');
    stat('Thrust at sea level', fmtKN(s.thrust * (s.ispVac ? s.ispSL / s.ispVac : 1)), s.thrust > 0 ? 'ok' : 'bad');
    stat('Δv', `${fmtInt(s.deltaV)} m/s`, s.deltaV >= breakdown.roundTrip ? 'good' : s.deltaV >= breakdown.oneWay ? 'ok' : 'bad');
    stat('TWR on Earth', s.twrEarth.toFixed(2), s.twrEarth >= 1.2 ? 'ok' : s.twrEarth >= 1 ? 'warn' : 'bad');
    stat('Reliability', fmtPct(s.reliability), s.reliability >= 0.9 ? 'good' : s.reliability >= 0.8 ? 'ok' : 'bad');
    stat('Stability', breakdown.copY < breakdown.comY ? 'Stable' : 'Unstable', breakdown.copY < breakdown.comY ? 'ok' : 'bad');
    const warnings = h('div', 'bld-warnings');
    warnings.append(
      ...blocks.map((id) => h('div', 'bld-warning hud-alert', `BLOCK: ${WARNING_LABELS[id] ?? id}`)),
      ...spec.warnings.map((id) => h('div', 'bld-warning hud-caution', WARNING_LABELS[id] ?? id)),
    );
    const wrap = h('div', 'bay-stats');
    wrap.append(grid, warnings);
    return wrap;
  }

  function installedList(families) {
    const list = h('div', 'bay-installed');
    const parts = assembly.layout().filter((e) => !families || families.includes(e.def.family));
    list.append(h('div', 'hud-label', `On the vehicle (${parts.length})`));
    if (!parts.length) list.append(h('div', 'bld-list-meta', 'Nothing from this trade yet.'));
    const seen = new Set();
    for (const e of parts) {
      if (e.group && seen.has(e.group)) continue;
      if (e.group) seen.add(e.group);
      const row = h('div', 'bay-installed-row');
      const twins = e.group ? assembly.parts.filter((p) => p.group === e.group).length : 1;
      row.append(h('span', 'bay-installed-name', `${e.def.name}${twins > 1 ? ` ×${twins}` : ''}${e.engine ? ` · ${e.engine.fuel} ${e.engine.nozzle} ${e.engine.pump}` : ''}`));
      if (e.def.engine) row.append(btn('bld-tool', 'WORKBENCH', () => hooks.onWorkbench?.(e.id), { tool: 'workbench' }));
      row.append(btn('bld-tool', 'REMOVE', () => { assembly.remove(e.id); sound('ui.click'); say(`${e.def.name} removed.`); changed(); }, { tool: 'remove' }));
      list.append(row);
    }
    return list;
  }

  // ---------- station bodies ----------
  function renderIntegration() {
    if (state.station !== 'integration' || !last) return;
    body.replaceChildren();
    body.className = 'bay-station-body bay-station-body--integration';
    const left = h('div', 'bay-col bay-col--left');
    const right = h('div', 'bay-col bay-col--right');
    // toolbar
    const toolbar = h('div', 'bld-toolbar bay-toolbar');
    const part = state.part ? assembly.part(state.part) : null;
    const def = part ? catalog.get(part.type) : null;
    const tool = (label, fn, attrs, disabled = false) => { const b = btn('bld-tool', label, fn, attrs); b.disabled = disabled; return b; };
    toolbar.append(
      tool('UNDO [Z]', () => { if (assembly.undo()) { sound('ui.click'); changed(); } }, { tool: 'undo' }, !assembly.canUndo),
      tool('REDO [Y]', () => { if (assembly.redo()) { sound('ui.click'); changed(); } }, { tool: 'redo' }, !assembly.canRedo),
      tool('REMOVE [Del]', removeSelected, { tool: 'remove' }, !part),
      tool('ROTATE 30°', () => { if (state.part && assembly.rotate(state.part, 30)) changed(); }, { tool: 'rotate' }, !(part && part.node === 'radial')),
      tool('SLIDE ▲', () => { if (state.part && assembly.slide(state.part, 0.1)) changed(); }, { tool: 'slideup' }, !(part && part.node === 'radial')),
      tool('SLIDE ▼', () => { if (state.part && assembly.slide(state.part, -0.1)) changed(); }, { tool: 'slidedown' }, !(part && part.node === 'radial')),
      tool('WORKBENCH', () => { const e = (def?.engine && state.part) || assembly.parts.find((p) => catalog.get(p.type)?.engine)?.id; if (e) hooks.onWorkbench?.(e); }, { tool: 'workbench' }, !assembly.parts.some((p) => catalog.get(p.type)?.engine)),
      tool('TURN ⟲ [Q]', () => scene.rotateBy(-30), { tool: 'viewleft' }),
      tool('⟳ [E]', () => scene.rotateBy(30), { tool: 'viewright' }),
      tool(scene.hologram?.exploded ? 'ASSEMBLE' : 'EXPLODE VIEW', () => { scene.hologram?.setExploded(!scene.hologram.exploded); renderIntegration(); }, { tool: 'explode' }),
      tool('CLEAR', () => openConfirm('Take the whole vehicle off the stand?', () => { assembly.clear(); state.part = null; state.node = null; changed(); }), { tool: 'clear' }, !assembly.parts.length),
    );
    const symmetry = h('div', 'bld-symmetry');
    symmetry.append(h('span', 'hud-label', 'Symmetry'));
    for (const n of SYMMETRIES) {
      const b = btn('bld-sym', `×${n}`, () => { assembly.setSymmetry(n); renderIntegration(); }, { sym: String(n) });
      b.setAttribute('aria-pressed', String(assembly.symmetry === n));
      symmetry.append(b);
    }
    toolbar.append(symmetry);
    const selection = h('div', 'bld-selection', part ? `Selected: ${def?.name ?? part.type}${part.group ? ' (symmetry group)' : ''}` : state.node ? `Node: ${state.node.node} of ${assembly.def(state.node.partId)?.name}` : 'Click a glowing node on the vehicle, then a part.');
    toolbar.append(selection);
    // quick-add palette
    const palette = h('div', 'bay-palette');
    const tabs = h('div', 'bld-family-tabs');
    state.family ??= catalog.families[0]?.id;
    for (const f of catalog.families) {
      const b = btn('bld-family-tab', f.name, () => { state.family = f.id; renderIntegration(); });
      b.setAttribute('aria-pressed', String(state.family === f.id));
      tabs.append(b);
    }
    const list = h('div', 'bld-part-list');
    const empty = assembly.parts.length === 0;
    for (const p of catalog.parts.filter((x) => x.family === state.family)) {
      const b = btn('bld-part', null, () => addAtNode(p.id), { part: p.id });
      b.append(h('span', 'bld-part-name', p.name), h('span', 'bld-part-meta', `${fmtMass(p.mass + (p.fuel?.mass ?? 0))} · ${p.engine ? 'workshop' : fmtMoneyShort(p.cost)}`));
      let reason = '';
      if (empty) reason = p.attach === 'axial' ? '' : 'Start with a capsule';
      else if (!state.node) reason = 'Select a node first, or drag me onto one';
      else reason = assembly.canAttach(p.id, state.node.partId, state.node.node).reason;
      b.disabled = !!reason && !reason.startsWith('Select a node');
      b.title = reason ? `${p.desc} (${reason})` : p.desc;
      b.draggable = !empty;
      b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.id); dragging = p.id; b.classList.add('bld-part--dragging'); });
      b.addEventListener('dragend', () => { b.classList.remove('bld-part--dragging'); dragging = null; });
      list.append(b);
    }
    palette.append(tabs, list);
    left.append(toolbar, palette, statsGrid(last));
    // right: ship tools + lens
    const tools = h('div', 'bay-ship-tools');
    tools.append(
      btn('bld-tool', 'RENAME', () => openRename(), { tool: 'rename' }),
      btn('bld-tool', 'PRESETS', () => hooks.onPresets?.(), { tool: 'presets' }),
      btn('bld-tool', 'BLUEPRINTS', () => hooks.onBlueprints?.(), { tool: 'blueprints' }),
      btn('bld-tool', 'SHARE CODE', () => hooks.onShare?.(), { tool: 'share' }),
      btn('hud-button bld-go', 'READINESS POLL →', () => hooks.onGonogo?.(), { tool: 'gonogo' }),
    );
    right.append(tools, lensHost);
    body.append(left, right);
    renderMarkers();
  }

  function renderCatalog(stationId) {
    const families = STATION_FAMILIES[stationId];
    body.replaceChildren();
    body.className = 'bay-station-body bay-station-body--catalog';
    const left = h('div', 'bay-col bay-col--catalog');
    const right = h('div', 'bay-col bay-col--detail');
    const fams = catalog.families.filter((f) => !families || families.includes(f.id));
    if (!fams.some((f) => f.id === state.family)) state.family = fams[0]?.id;
    const tabs = h('div', 'bld-family-tabs');
    for (const f of fams) {
      const b = btn('bld-family-tab', f.name, () => { state.family = f.id; renderCatalog(stationId); });
      b.setAttribute('aria-pressed', String(state.family === f.id));
      tabs.append(b);
    }
    const grid = h('div', 'bay-card-grid');
    const parts = catalog.parts.filter((p) => p.family === state.family);
    if (!state.detail || !parts.some((p) => p.id === state.detail)) state.detail = parts[0]?.id ?? null;
    for (const p of parts) grid.append(partCard(p, { onClick: () => { state.detail = p.id; renderCatalog(stationId); }, pressed: state.detail === p.id }));
    left.append(tabs, grid);
    // detail pane
    const def = catalog.get(state.detail);
    if (def) {
      const detail = h('div', 'bay-detail');
      const img = h('img', 'bay-detail-img');
      img.src = icons?.iconFor(def) || '';
      img.alt = def.name;
      detail.append(img, h('h3', 'bay-detail-name', def.name), h('div', 'bay-detail-role', def.role ?? ''), h('p', 'bay-detail-text', def.detail ?? def.desc ?? ''));
      const facts = h('div', 'bay-detail-facts');
      const fact = (k, v) => { const r = h('div', 'bay-fact'); r.append(h('span', 'bay-fact-k', k), h('span', 'bay-fact-v', v)); facts.append(r); };
      fact('Mass', fmtMass(def.mass));
      if (def.fuel) fact('Propellant', `${fmtMass(def.fuel.mass)} ${def.fuel.type}`);
      fact('Cost', def.engine ? 'pump + chamber + nozzle' : fmtMoney(def.cost));
      fact('Reliability', fmtPct(def.reliability));
      fact('Mounts', def.attach === 'axial' ? `in the stack (${def.nodes.join(', ')})` : 'on the side of a body');
      if (def.size) fact('Size', def.size.toUpperCase());
      detail.append(facts);
      const actions = h('div', 'bay-detail-actions');
      actions.append(btn('hud-button hud-good', 'ADD TO VEHICLE', () => { addAuto(def.id); renderCatalog(stationId); }, { tool: 'add' }));
      if (def.guidebook) actions.append(btn('bld-tool', 'GUIDEBOOK', () => hooks.onGuidebook?.(def.guidebook), { tool: 'guidebook' }));
      detail.append(actions, h('div', 'bld-list-meta', 'Drag a card onto a glowing node at the integration console to place it by hand.'));
      right.append(detail);
    }
    right.append(installedList(families));
    body.append(left, right);
  }

  function renderTest() {
    body.replaceChildren();
    body.className = 'bay-station-body bay-station-body--test';
    const r = state.testResult;
    const intro = h('p', 'bay-test-intro', 'The stand holds the vehicle down with four clamps. We light the engine, run it at full throttle, then release the clamps for two seconds: a vehicle that cannot lift here will not lift on the pad.');
    const actions = h('div', 'bay-detail-actions');
    const fire = btn('hud-button hud-caution', 'STATIC FIRE + HOLD-DOWN TEST', () => hooks.onStartTest?.(), { tool: 'test' });
    fire.disabled = !assembly.parts.some((p) => catalog.get(p.type)?.engine) || !(last?.spec.stats.fuelMass > 0);
    const poll = btn('hud-button hud-good', 'READINESS POLL →', () => hooks.onGonogo?.(), { tool: 'gonogo' });
    poll.disabled = !assembly.parts.length;
    actions.append(fire, poll);
    body.append(intro, actions);
    if (last) body.append(statsGrid(last));
    if (r) {
      const res = h('div', 'bay-test-result hud-panel');
      res.classList.add(r.lifted ? 'hud-good' : 'hud-alert');
      const line = (k, v, st) => { const row = h('div', 'bay-fact'); row.append(h('span', 'bay-fact-k', k), h('span', `bay-fact-v ${st ?? ''}`, v)); res.append(row); };
      res.append(h('div', 'hud-label', 'Test report'));
      line('Hold-down release', r.lifted ? 'VEHICLE LIFTED' : 'VEHICLE STAYED ON THE STAND', r.lifted ? 'hud-good' : 'hud-alert');
      line('Thrust at sea level', fmtKN(r.thrustSL));
      line('Weight on the pad', fmtKN(r.weight));
      line('Thrust ÷ weight', `${r.twr.toFixed(2)} ${r.twr >= 1.2 ? '(brisk)' : r.twr > 1 ? '(barely)' : '(cannot lift)'}`);
      line('Net acceleration', `${r.netAccel.toFixed(2)} m/s²`);
      line('Propellant flow', `${r.mdot.toFixed(0)} kg/s · full tank in ${fmtInt(r.burnTime)} s`);
      line('Δv available', `${fmtInt(r.deltaV)} m/s`);
      line('Reaches Mars', r.reachesMars ? 'yes' : `no, ${fmtInt(r.oneWay - r.deltaV)} m/s short`, r.reachesMars ? 'hud-good' : 'hud-alert');
      line('Comes home on its own fuel', r.comesHome ? 'yes' : 'no (make methane on Mars)', r.comesHome ? 'hud-good' : 'hud-caution');
      line('Aerodynamically stable', r.stable ? 'yes' : 'no: add fins low on the stack', r.stable ? 'hud-good' : 'hud-alert');
      body.append(res);
    }
  }

  function renderLaunchWindow() {
    body.replaceChildren();
    body.className = 'bay-station-body bay-station-body--range';
    const list = h('div', 'bld-list');
    for (const slot of launch.slots) {
      const item = btn('bld-list-item', null, () => { assembly.setLaunchSlot(slot.id); sound('ui.click'); changed(); renderLaunchWindow(); });
      item.setAttribute('aria-pressed', String(assembly.launch.slot === slot.id));
      item.append(h('span', null, `${slot.name} · ${fmtInt(slot.tempC)} °C`), h('span', 'bld-list-meta', `${slot.fee ? fmtMoneyShort(slot.fee) + ' pad fees' : 'no fees'} · ${slot.note}`));
      list.append(item);
    }
    body.append(h('p', 'bay-test-intro', 'The range gives you three windows. The first is tomorrow at dawn, free, and cold. Seals that are not rated for cold lose their flexibility below 5 °C. That is the whole story of Challenger.'), list);
  }

  let handbook = null;
  function renderHandbook() {
    body.replaceChildren();
    body.className = 'bay-station-body bay-station-body--handbook';
    handbook?.dispose();
    handbook = createHandbook({ parent: body });
  }

  function openStation(id) {
    const st = stations.find((s) => s.id === id);
    if (!st) return;
    state.station = id;
    title.textContent = st.name;
    role.textContent = st.role;
    panel.hidden = false;
    panel.dataset.station = id;
    markers.hidden = !DESIGN_STATIONS.includes(id);
    hud.classList.add('bay-hud--station');
    if (id === 'integration') renderIntegration();
    else if (id === 'teststand') renderTest();
    else if (id === 'launchwindow') renderLaunchWindow();
    else if (id === 'handbook') renderHandbook();
    else renderCatalog(id);
    hooks.onStationOpen?.(id);
    if (!markers.hidden) renderMarkers();
  }

  function closeStation() {
    if (!state.station) return;
    const id = state.station;
    state.station = null;
    panel.hidden = true;
    markers.hidden = true;
    hud.classList.remove('bay-hud--station');
    handbook?.dispose();
    handbook = null;
    closeDialog();
    hooks.onStationClose?.(id);
  }

  // ---------- dialogs ----------
  function openDialog({ title: t, body: content, actions = [] }) {
    dialog.replaceChildren(h('div', 'bld-dialog-title', t));
    const b = h('div', 'bld-dialog-body');
    if (typeof content === 'function') content(b); else if (content) b.append(content);
    dialog.append(b);
    if (actions.length) {
      const row = h('div', 'bld-dialog-actions');
      for (const a of actions) row.append(btn('hud-button', a.label, () => { a.onClick?.(); if (a.close !== false) closeDialog(); }));
      dialog.append(row);
    }
    backdrop.hidden = false;
    return b;
  }
  function closeDialog() {
    backdrop.hidden = true;
    dialog.replaceChildren();
  }
  function openConfirm(question, onYes) {
    openDialog({ title: 'Confirm', body: h('div', null, question), actions: [{ label: 'CANCEL' }, { label: 'YES', onClick: onYes }] });
  }
  function openRename() {
    const input = h('input', 'bld-input');
    input.value = assembly.name;
    input.maxLength = 40;
    openDialog({ title: 'Vehicle name', body: input, actions: [{ label: 'CANCEL' }, { label: 'OK', onClick: () => { assembly.rename(input.value); changed(); } }] });
    input.focus();
    input.select();
  }

  // ---------- refresh ----------
  function renderMoney() {
    const m = getMoney();
    chipFunds.textContent = fmtMoney(m);
    chipFunds.dataset.state = last && m < last.spec.stats.cost + (last.breakdown.slot?.fee ?? 0) ? 'bad' : m < insolvencyFloor * 1.5 ? 'low' : 'ok';
  }
  let insolventEl = null;
  function renderInsolvency() {
    const broke = getMoney() < insolvencyFloor;
    if (broke && !insolventEl) {
      insolventEl = h('div', 'bay-insolvent hud-panel hud-alert');
      insolventEl.append(h('span', null, text.hangar?.insolvent ?? 'Insolvent.'), btn('hud-button', 'DECLARE BANKRUPTCY', () => hooks.onBankrupt?.(), { tool: 'bankrupt' }));
      hud.append(insolventEl);
    } else if (!broke && insolventEl) {
      insolventEl.remove();
      insolventEl = null;
    }
  }
  function refresh(result) {
    last = result;
    scene.setLayout(assembly.layout(), assembly.freeNodes());
    if (state.part && !assembly.part(state.part)) state.part = null;
    if (state.node && !assembly.freeNodes().some((n) => n.partId === state.node.partId && n.node === state.node.node)) state.node = null;
    scene.select(state.part);
    const s = result.spec.stats;
    chipShip.textContent = assembly.name;
    chipStats.textContent = `${fmtMoney(s.cost)} · Δv ${fmtInt(s.deltaV)} · TWR ${s.twrEarth.toFixed(2)} · ${result.blocks.length ? `${result.blocks.length} block(s)` : result.spec.warnings.length ? `${result.spec.warnings.length} warning(s)` : 'ready'}`;
    renderMoney();
    renderInsolvency();
    if (state.station === 'integration') renderIntegration();
    else if (state.station === 'teststand') renderTest();
    else if (state.station && STATION_FAMILIES[state.station] !== undefined) renderCatalog(state.station);
  }

  function update(dt, { prompt: p = null } = {}) {
    void dt;
    if (!state.station) {
      prompt.textContent = p ? `E · ${p}` : '';
      prompt.classList.toggle('bay-prompt--show', !!p);
    } else projectMarkers();
  }

  function setTestStatus(txt) {
    state.testStatus = txt;
    testStatus.hidden = !txt;
    testStatus.textContent = txt;
  }
  function showTestResult(result) {
    state.testResult = result;
    setTestStatus('');
    say(result.lifted ? 'Hold-down test: the vehicle lifted.' : 'Hold-down test: the vehicle stayed on the stand.', result.lifted ? 'ok' : 'bad');
  }

  function dispose() {
    clearTimeout(toastTimer);
    handbook?.dispose();
    el.remove();
    markerEls.clear();
  }

  return {
    el, lensHost, update, refresh, openStation, closeStation, openDialog, closeDialog, openConfirm, dispose, renderMoney, say, setTestStatus, showTestResult,
    get station() { return state.station; },
    get selectedPart() { return state.part; },
    removeSelected,
  };
}
