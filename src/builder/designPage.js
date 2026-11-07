// The vehicle design page: the ship in 3D in the middle (drag to turn, wheel to zoom, click a part), a strip of
// small cards along the top (picture, name, price: the choices for whatever is selected), and a panel on the right
// that tells the whole story of the card or part you clicked, with the one button that acts. Zoom into a selected
// part and it opens up: its internals slide out, each one a choice of its own. Few buttons, one idea at a time.
import { autoAttach } from './autoplace.js';
import { engineStats, partFigures } from './stats.js';
import { internalsArt } from './bay/internalsArt.js';
import { BASE_RADIUS, SIZE_SCALE } from './assembly.js';
import { fmtInt, fmtKN, fmtMass, fmtMoney, fmtMoneyShort, fmtPct } from './format.js';

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
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const signed = (n, f) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${f(Math.abs(n))}`;

const ZONES = [
  { id: 'head', name: 'HEAD', hint: 'Nose cone or crew capsule. The trip starts here.', families: ['fairing', 'command'] },
  { id: 'body', name: 'BODY', hint: 'Guidance ring, tanks, heat shield, stage structure.', families: ['stages', 'tanks', 'thermal'] },
  { id: 'tail', name: 'TAIL', hint: 'The engine. Legs, fins and solids clamp around it.', families: ['engines'] },
];
const CHECKLIST = [
  { id: 'nose', label: 'Nose cone', test: (s, l) => l.some((e) => /nose/.test(e.type)), pick: (p) => p.family === 'fairing' },
  { id: 'capsule', label: 'Crew capsule', test: (s) => s.parts.some((p) => /capsule/.test(p.type)), pick: (p) => !!p.flags.capsule },
  { id: 'avionics', label: 'Guidance electronics', test: (s, l) => l.some((e) => e.def.flags?.avionics), pick: (p) => !!p.flags.avionics || !!p.flags.navigation },
  { id: 'shield', label: 'Heat shield', test: (s) => s.stats.hasHeatShield, pick: (p) => !!p.flags.heatShield },
  { id: 'tank', label: 'Propellant tanks', test: (s) => s.stats.fuelMass > 0, pick: (p) => !!p.fuel },
  { id: 'engine', label: 'Engine', test: (s) => s.engines.length > 0, pick: (p) => !!p.engine },
  { id: 'boosters', label: 'Solid motors (optional)', test: (s, l) => l.some((e) => e.def.booster), pick: (p) => !!p.booster, optional: true },
  { id: 'legs', label: 'Landing legs', test: (s) => s.stats.hasLegs, pick: (p) => !!p.flags.legs },
  { id: 'fins', label: 'Fins', test: (s, l) => l.some((e) => /fin/.test(e.type)), pick: (p) => /fin/.test(p.id) },
  { id: 'rcs', label: 'Thrusters (RCS)', test: (s) => s.stats.hasRCS, pick: (p) => !!p.flags.rcs },
  { id: 'antenna', label: 'Antenna', test: (s) => s.stats.hasAntenna, pick: (p) => !!p.flags.antenna },
  { id: 'o2', label: 'Spare oxygen', test: (s) => s.stats.spareO2Tanks > 0, pick: (p) => !!p.flags.spareO2Tanks },
  { id: 'shelter', label: 'Radiation shelter', test: (s) => s.stats.hasShelter, pick: (p) => !!p.flags.shelter },
  { id: 'chute', label: 'Parachute', test: (s) => s.stats.hasParachute, pick: (p) => !!p.flags.parachute },
  { id: 'power', label: 'Power', test: (s) => s.stats.power >= 1500, pick: (p) => !!p.flags.power && !p.flags.capsule },
  { id: 'science', label: 'Science instruments', test: (s, l) => l.some((e) => e.def.flags?.science), pick: (p) => !!p.flags.science },
];
const WARN = { LOW_DV: 'Not enough Δv to reach Mars', LOW_TWR: 'Too heavy for the engine (TWR < 1.2)', NO_HEAT_SHIELD: 'No heat shield', NO_LEGS: 'No landing legs', UNSTABLE: 'Unstable: fins too high or missing', LOW_O2: 'No spare oxygen', NO_ANTENNA: 'No antenna', NO_SHELTER: 'No radiation shelter', COLD_SEALS: 'Cheap seals in a cold launch window', LOW_RELIABILITY: 'Reliability below 80 %', NO_CAPSULE: 'No crew capsule', NO_ENGINE: 'No engine', NO_FUEL: 'No usable propellant', NOT_CONNECTED: 'Parts not connected', OVER_BUDGET: 'Over budget' };
const LABEL_H = 30;

export function createDesignPage({ assembly, catalog, materials, engines, text, icons, scene3d, g0, getMoney, hooks }) {
  const el = h('section', 'vd-root hud');
  el.hidden = true;
  // mode: idle | part | slot | zone | family | internal | browse
  const state = { mode: 'idle', selected: null, slot: null, zone: null, item: null, internal: null, focus: null, family: null, collapsed: false, candidates: [], onInstall: null, stripLabel: 'INSTALL' };
  let last = null;

  // ---------- header ----------
  const top = h('header', 'vd-top');
  const title = h('div', 'vd-title');
  const shipName = btn('vd-ship-name', assembly.name, () => hooks.onRename?.());
  title.append(h('span', 'vd-kicker', 'Vehicle design'), shipName);
  const stats = h('div', 'vd-stats');
  const actions = h('div', 'vd-actions');
  const undoBtn = btn('vd-btn', 'UNDO', () => { if (assembly.undo()) { sound('ui.click'); changed(); } }, { tool: 'undo' });
  actions.append(
    undoBtn,
    btn('vd-btn', 'MORE ▾', () => hooks.onMore?.(), { tool: 'more' }),
    btn('vd-btn vd-btn--test', 'TEST FIRE', () => hooks.onTest?.(), { tool: 'test' }),
    btn('vd-btn vd-btn--go', 'READINESS POLL →', () => hooks.onGonogo?.(), { tool: 'gonogo' }),
    btn('vd-btn vd-btn--ghost', 'CLOSE  [Esc]', () => hooks.onClose?.(), { tool: 'close' }),
  );
  top.append(title, stats, actions);

  // ---------- the strip of cards ----------
  const strip = h('section', 'vd-strip');
  strip.hidden = true;
  const stripHead = h('div', 'vd-strip-head');
  const stripBack = btn('vd-btn vd-btn--ghost', '◂ BACK', () => backFromInternal(), { tool: 'back' });
  stripBack.hidden = true;
  const stripTitle = h('div', 'vd-strip-title');
  const stripTabs = h('div', 'vd-strip-tabs');
  const stripFold = btn('vd-btn vd-btn--ghost vd-fold', '▴ HIDE CARDS', () => setCollapsed(!state.collapsed), { tool: 'fold' });
  const stripClose = btn('vd-btn vd-btn--ghost', '✕', () => closeStrip(), { tool: 'stripclose' });
  stripHead.append(stripBack, stripTitle, stripTabs, stripFold, stripClose);
  const cards = h('div', 'vd-cards');
  strip.append(stripHead, cards);

  // ---------- stage: the 3D view with labels, and the side panel ----------
  const stage = h('main', 'vd-stage');
  const view = h('div', 'vd-view');
  view.draggable = true; // HTML5 drag turns the vehicle: the only pointer stream allowed outside core/input.js
  const overlay = svgEl('svg', { class: 'vd-overlay' });
  const labels = h('div', 'vd-labels');
  const empty = h('div', 'vd-empty');
  empty.hidden = true;
  const viewbar = h('div', 'vd-viewbar');
  const autoBtn = btn('vd-btn vd-btn--ghost', '⟲ AUTO', () => { scene3d.orbit.auto = !scene3d.orbit.auto; autoBtn.setAttribute('aria-pressed', String(scene3d.orbit.auto)); }, { tool: 'auto' });
  autoBtn.setAttribute('aria-pressed', 'true');
  const turn = h('input', 'vd-turn');
  turn.type = 'range';
  turn.min = '0'; turn.max = '360'; turn.step = '1'; turn.value = '0';
  turn.title = 'Turn the vehicle';
  turn.addEventListener('input', () => { scene3d.orbit.yaw = (Number(turn.value) * Math.PI) / 180; scene3d.orbit.idle = 0; });
  const clampBtn = btn('vd-btn', '+ CLAMP EQUIPMENT', null, { tool: 'clamp' });
  viewbar.append(
    btn('vd-btn vd-btn--ghost', 'FIT', () => { scene3d.fit(); sound('ui.click'); }, { tool: 'zoomfit' }),
    btn('vd-btn vd-btn--ghost', '−', () => scene3d.zoomBy(1.25), { tool: 'zoomout' }),
    btn('vd-btn vd-btn--ghost', '+', () => scene3d.zoomBy(1 / 1.25), { tool: 'zoomin' }),
    turn, autoBtn, clampBtn,
    h('span', 'vd-view-hint', 'drag: turn · wheel: zoom · click a part · zoom in on it to look inside'),
  );
  view.append(overlay, labels, empty, viewbar);
  const side = h('aside', 'vd-side');
  const sideHead = h('div', 'vd-side-head');
  const sideBack = btn('vd-btn vd-btn--ghost', '◂', () => sideBackAction(), { tool: 'sideback' });
  const sideKicker = h('span', 'vd-side-kicker', 'Vehicle');
  sideHead.append(sideBack, sideKicker);
  const sideBody = h('div', 'vd-side-body');
  const lensHost = h('div', 'bld-lens'); // the Formula Lens lives here (index.js mounts it); shown in the summary
  side.append(sideHead, sideBody);
  stage.append(view, side);
  el.append(top, strip, stage);

  // ---------- helpers ----------
  const sound = (id) => hooks.onSound?.(id);
  const changed = () => hooks.onChange?.();
  const toast = (m, kind) => hooks.onToast?.(m, kind);
  const kitOf = (def) => catalog.kit?.(def) ?? null;
  const materialFamily = (def) => materials?.families?.[def.materialFamily] ?? null;
  const materialOf = (part, def) => { const fam = materialFamily(def); return fam ? (fam.options.find((o) => o.id === part?.material) ?? fam.options[0]) : null; };
  const figuresOf = (def, part = null) => partFigures(def, { engines, g0, materials, catalog, materialId: part?.material ?? null, options: part?.options ?? null, engineDef: part?.engine ?? null });
  const entryFor = (def) => ({ def, radius: BASE_RADIUS * (SIZE_SCALE[def.size] ?? 1), height: def.height });
  const optionIcon = (def, slot, option) => icons.objectIcon(`int:${def.internals}:${slot.key}:${option.id}`, () => {
    const opts = { ...catalog.optionsOf(def, null), [slot.key]: option };
    const piece = internalsArt(def, opts, entryFor(def)).find((p) => p.key === slot.key);
    return piece?.object ?? internalsArt(def, opts, entryFor(def))[0]?.object;
  }, { pad: 1.25 });
  scene3d.setOptionsResolver((id) => assembly.options(id));

  function layoutEntry(id) { return assembly.layout().find((e) => e.id === id) ?? null; }

  const BODY = ['tanks', 'stages', 'thermal', 'boosters'];
  const sameJob = (a, b) => a.family === b.family || (BODY.includes(a.family) && BODY.includes(b.family)) || (a.engine && b.booster) || (a.booster && b.engine);
  function canReplace(part, def, to) {
    if (!to || def.attach !== to.attach || to.id === def.id || !sameJob(def, to)) return false;
    if (to.attach === 'axial') {
      if (part.parent !== null && !to.nodes.includes(part.node === 'top' ? 'bottom' : 'top')) return false;
      for (const c of assembly.children(part.id)) if (!to.nodes.includes(c.node)) return false;
    }
    return true;
  }

  // ---------- the strip ----------
  function card({ id, img, name, meta, note, on = false, focus = false, onClick }) {
    const c = btn(`vd-card${on ? ' vd-card--on' : ''}${focus ? ' vd-card--focus' : ''}`, null, onClick, { card: id });
    if (img != null) {
      const im = h('img', 'vd-card-img');
      im.alt = name;
      im.src = img;
      im.draggable = false;
      c.append(im);
    }
    c.append(h('span', 'vd-card-name', name), h('span', 'vd-card-meta', meta ?? ''), h('span', 'vd-card-note', note ?? ''));
    if (on) c.append(h('span', 'vd-card-tag', 'INSTALLED'));
    return c;
  }
  function openStrip({ title: t, subtitle, items, tabs = null, back = false }) {
    strip.hidden = false;
    stripBack.hidden = !back;
    stripTitle.replaceChildren(h('strong', null, t), h('span', null, subtitle ?? ''));
    stripTabs.replaceChildren();
    if (tabs && tabs.length > 1) {
      const all = btn('vd-tab', 'ALL', () => { state.family = null; renderStrip(); });
      all.setAttribute('aria-pressed', String(state.family === null));
      stripTabs.append(all);
      for (const f of tabs) {
        const b = btn('vd-tab', f.name, () => { state.family = f.id; renderStrip(); });
        b.setAttribute('aria-pressed', String(state.family === f.id));
        stripTabs.append(b);
      }
    }
    state.stripItems = items;
    state.stripTabs = tabs;
    state.stripTitleArgs = { t, subtitle, back };
    renderStrip();
    setCollapsed(false);
  }
  function renderStrip() {
    const items = state.stripItems ?? [];
    const shown = items.filter((it) => !state.family || it.family === state.family);
    if (state.stripTabs?.length > 1) {
      for (const b of stripTabs.querySelectorAll('.vd-tab')) b.setAttribute('aria-pressed', String((b.textContent === 'ALL' && state.family === null) || state.stripTabs.some((f) => f.id === state.family && f.name === b.textContent)));
    }
    cards.replaceChildren(...shown.map((it) => card({ ...it, focus: state.focus === it.id })));
    if (!shown.length) cards.append(h('div', 'vd-empty-note', 'Nothing fits here.'));
    const focused = cards.querySelector('.vd-card--focus');
    if (focused) focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function setCollapsed(on) {
    state.collapsed = on;
    strip.classList.toggle('vd-strip--collapsed', on);
    stripFold.textContent = on ? '▾ SHOW CARDS' : '▴ HIDE CARDS';
  }
  function closeStrip() {
    strip.hidden = true;
    state.mode = 'idle';
    state.selected = null;
    state.slot = null;
    state.zone = null;
    state.item = null;
    state.internal = null;
    state.focus = null;
    scene3d.select(null);
    renderSide();
    refreshLabels(true);
  }

  // ---------- candidate strips (replace, slot, zone, family, browse) ----------
  function candidateItems(defs, { installedId = null, onInstall }) {
    return defs.map((def) => {
      const fig = figuresOf(def);
      const meta = def.fuel ? `${fmtMass(def.fuel.mass)} prop · ${fmtMoneyShort(fig.cost)}` : def.booster ? `${fmtKN(fig.booster.thrust)} · ${fmtMoneyShort(fig.cost)}` : `${fmtMass(fig.mass)} · ${def.engine ? 'from ' : ''}${fmtMoneyShort(fig.cost)}`;
      return { id: def.id, family: def.family, img: icons.iconFor(def), name: def.name, meta, note: def.desc || def.role || '', on: def.id === installedId, onClick: () => focusCandidate(def, { installedId, onInstall }) };
    });
  }
  function focusCandidate(def, { installedId, onInstall }) {
    state.focus = def.id;
    sound('ui.click');
    renderStrip();
    renderCandidateDetail(def, { installedId, onInstall });
  }
  function familiesOf(defs) {
    return catalog.families.filter((f) => defs.some((d) => d.family === f.id));
  }

  function openPickerForPart(id, { keepFocus = false } = {}) {
    const part = assembly.part(id);
    const def = part && catalog.get(part.type);
    if (!def) return;
    state.mode = 'part';
    state.selected = id;
    state.slot = null; state.zone = null; state.item = null; state.internal = null;
    if (!keepFocus) state.focus = null;
    scene3d.select(id);
    const defs = catalog.parts.filter((p) => canReplace(part, def, p) || p.id === def.id);
    if (!familiesOf(defs).some((f) => f.id === state.family)) state.family = null;
    const onInstall = (to) => {
      if (assembly.replace(id, to.id)) { sound('ui.snap'); toast(`${def.name} → ${to.name}`); changed(); openPickerForPart(id); } else { sound('ui.error'); toast('That part does not fit in this place.', 'bad'); }
    };
    openStrip({ title: def.name, subtitle: 'Swap it for another: click a card to compare', items: candidateItems(defs, { installedId: def.id, onInstall }), tabs: familiesOf(defs) });
    renderPartDetail(id);
    refreshLabels(true);
  }

  function openPickerForSlot(partId, node) {
    state.mode = 'slot';
    state.selected = null; state.zone = null; state.item = null; state.internal = null; state.focus = null;
    state.slot = { partId, node };
    scene3d.select(null);
    const host = assembly.def(partId);
    const defs = catalog.parts.filter((p) => assembly.canAttach(p.id, partId, node).ok);
    if (!familiesOf(defs).some((f) => f.id === state.family)) state.family = null;
    const onInstall = (to) => {
      const ids = node === 'radial' ? assembly.attach(to.id, partId, node, { symmetry: /fin/.test(to.id) ? 4 : to.booster ? 2 : 1 }) : assembly.attach(to.id, partId, node);
      if (!ids.length) { sound('ui.error'); return; }
      sound('ui.snap');
      toast(`${to.name} attached.`);
      changed();
      if (to.attach === 'axial') {
        const far = node === 'top' ? 'top' : 'bottom';
        if (to.nodes.includes(far)) { openPickerForSlot(ids[0], far); return; }
      }
      openPickerForPart(ids[0]);
    };
    openStrip({ title: node === 'radial' ? `Clamp something to the ${host?.name}` : `Add ${node === 'top' ? 'above' : 'below'} the ${host?.name}`, subtitle: 'Click a card to read about it, then INSTALL', items: candidateItems(defs, { onInstall }), tabs: familiesOf(defs) });
    renderHint(node === 'radial' ? 'Side-mounted equipment clamps to the body. Pick a card.' : 'Pick the next part of the stack. After it is installed, the strip moves on to the next slot.');
    refreshLabels(true);
  }

  function openPickerForZone(zone) {
    state.mode = 'zone';
    state.selected = null; state.slot = null; state.item = null; state.internal = null; state.focus = null;
    state.zone = zone.id;
    const defs = catalog.parts.filter((p) => p.attach === 'axial' && zone.families.includes(p.family)).sort((a, b) => zone.families.indexOf(a.family) - zone.families.indexOf(b.family));
    state.family = null;
    const onInstall = (to) => {
      const ids = assembly.attach(to.id);
      if (!ids.length) { sound('ui.error'); return; }
      sound('ui.snap');
      toast(`${to.name} placed on the stand.`);
      changed();
      if (to.nodes.includes('bottom')) openPickerForSlot(ids[0], 'bottom'); else openPickerForPart(ids[0]);
    };
    openStrip({ title: `${zone.name}: ${zone.hint}`, subtitle: 'Pick the first part. The rest stacks under it.', items: candidateItems(defs, { onInstall }), tabs: familiesOf(defs) });
    renderHint('A rocket is built from the top down. Choose the first part and the page walks you down the stack.');
    refreshLabels(true);
  }

  function openPickerForFamily(item) {
    state.mode = 'family';
    state.selected = null; state.slot = null; state.zone = null; state.internal = null; state.focus = null;
    state.item = item.id;
    scene3d.select(null);
    const defs = catalog.parts.filter((p) => item.pick(p));
    state.family = null;
    const onInstall = (to) => {
      const { ids, message } = autoAttach(assembly, to.id);
      if (!ids.length) { sound('ui.error'); toast(message, 'bad'); return; }
      sound('ui.snap');
      toast(message);
      changed();
      openPickerForPart(ids[0]);
    };
    openStrip({ title: item.label, subtitle: 'Pick one and it goes where a technician would put it.', items: candidateItems(defs, { onInstall }), tabs: familiesOf(defs) });
    renderHint(`${item.label}: click a card to read what it does and what it costs.`);
    refreshLabels(true);
  }

  function openBrowse() {
    state.mode = 'browse';
    state.selected = null; state.slot = null; state.zone = null; state.item = null; state.internal = null; state.focus = null;
    scene3d.select(null);
    const defs = catalog.parts;
    const onInstall = (to) => {
      const { ids, message } = autoAttach(assembly, to.id);
      if (!ids.length) { sound('ui.error'); toast(message, 'bad'); return; }
      sound('ui.snap');
      toast(message);
      changed();
      openPickerForPart(ids[0]);
    };
    openStrip({ title: 'Parts warehouse', subtitle: `${defs.length} parts the agency can buy. Pick a family, click a card.`, items: candidateItems(defs, { onInstall }), tabs: familiesOf(defs) });
    renderHint('Everything in stock, by family. INSTALL puts a part where a technician would; move or swap it afterwards by clicking it on the vehicle.');
    refreshLabels(true);
  }

  // ---------- internals ----------
  function openInternal(id, key) {
    const part = assembly.part(id);
    const def = part && catalog.get(part.type);
    const slot = def && kitOf(def)?.slots.find((s) => s.key === key);
    if (!slot) return;
    state.mode = 'internal';
    state.selected = id;
    state.internal = key;
    state.focus = null;
    scene3d.select(id);
    scene3d.focusOn(id, { exploded: true });
    const current = assembly.options(id)[key];
    const items = slot.options.map((o) => ({
      id: o.id, img: optionIcon(def, slot, o), name: o.name, meta: deltaLine(o), note: o.real ? `as on ${o.real}` : o.note, on: o.id === current?.id,
      onClick: () => { state.focus = o.id; sound('ui.click'); renderStrip(); renderOptionDetail(id, slot, o, current); },
    }));
    openStrip({ title: `${def.name}: ${slot.name}`, subtitle: slot.role, items, back: true });
    renderOptionDetail(id, slot, current, current);
    refreshLabels(true);
  }
  function backFromInternal() {
    scene3d.relax();
    if (state.selected) openPickerForPart(state.selected); else closeStrip();
  }
  function deltaLine(o) {
    const bits = [];
    if (o.massF && o.massF !== 1) bits.push(`mass ×${o.massF}`);
    if (o.massD) bits.push(`${signed(o.massD, fmtMass)}`);
    if (o.costF && o.costF !== 1) bits.push(`cost ×${o.costF}`);
    if (o.costD) bits.push(`${signed(o.costD, fmtMoneyShort)}`);
    if (o.isp) bits.push(`Isp ${signed(o.isp, (n) => `${n} s`)}`);
    if (o.thrustF && o.thrustF !== 1) bits.push(`thrust ×${o.thrustF}`);
    if (o.powerF && o.powerF !== 1) bits.push(`power ×${o.powerF}`);
    if (o.chuteF && o.chuteF !== 1) bits.push(`drag ×${o.chuteF}`);
    if (o.rel) bits.push(`reliability ${signed(o.rel * 100, (n) => `${n.toFixed(1)} %`)}`);
    return bits.length ? bits.join(' · ') : 'baseline';
  }

  // ---------- the side panel ----------
  function sideBackAction() {
    if (state.mode === 'internal') backFromInternal();
    else if (state.mode !== 'idle') closeStrip();
  }
  function setSide(kicker, ...nodes) {
    sideKicker.textContent = kicker;
    sideBack.hidden = state.mode === 'idle';
    sideBody.replaceChildren(...nodes);
    sideBody.scrollTop = 0;
  }
  function fact(k, v, cls) {
    const row = h('div', 'vd-fact');
    row.append(h('span', 'vd-fact-k', k), h('span', `vd-fact-v${cls ? ` ${cls}` : ''}`, v));
    return row;
  }
  function prosCons(pros = [], cons = []) {
    const wrap = h('div', 'vd-proscons');
    const p = h('ul', 'vd-pros');
    for (const x of pros) p.append(h('li', null, x));
    const c = h('ul', 'vd-cons');
    for (const x of cons) c.append(h('li', null, x));
    wrap.append(p, c);
    return wrap;
  }
  function bigImage(src, alt) {
    const img = h('img', 'vd-detail-img');
    img.src = src || '';
    img.alt = alt;
    img.draggable = false;
    return img;
  }
  function figureFacts(def, fig, part = null) {
    const facts = h('div', 'vd-facts');
    if (def.engine && fig.engine) {
      const e = fig.engine;
      facts.append(fact('Thrust (sea level / vacuum)', `${fmtKN(e.thrustSL)} / ${fmtKN(e.thrust)}`), fact('Isp (sea level / vacuum)', `${fmtInt(e.ispSL)} / ${fmtInt(e.ispVac)} s`), fact('Engine', `${e.fuel} · ${e.nozzle === 'sl' ? 'sea-level' : 'vacuum'} nozzle · pump ${e.pump}`));
    }
    if (def.booster && fig.booster) {
      const b = fig.booster;
      facts.append(fact('Thrust', fmtKN(b.thrust)), fact('Isp (sea level / vacuum)', `${fmtInt(b.ispSL)} / ${fmtInt(b.ispVac)} s`), fact('Propellant · burn', `${fmtMass(b.propellant)} · ${fmtInt(b.burnTime)} s`));
    }
    if (def.fuel) facts.append(fact('Propellant', `${fmtMass(def.fuel.mass)} of ${def.fuel.type}`));
    facts.append(fact(def.fuel || def.booster ? 'Dry mass' : 'Mass', fmtMass(fig.mass)), fact('Price', fmtMoney(fig.cost)), fact('Reliability', fmtPct(fig.reliability), fig.reliability < 0.95 ? 'vd-fact-v--warn' : ''));
    if (fig.power) facts.append(fact('Power', `${fmtInt(fig.power)} W at Earth`));
    if (fig.chuteCdA) facts.append(fact('Parachute drag area', `${fmtInt(fig.chuteCdA)} m²`));
    if (def.flags?.spareO2Tanks) facts.append(fact('Spare oxygen', `${def.flags.spareO2Tanks} refill${def.flags.spareO2Tanks > 1 ? 's' : ''}`));
    if (def.flags?.armorHits) facts.append(fact('Debris hits absorbed', String(def.flags.armorHits)));
    if (def.flags?.reliabilityBonus) facts.append(fact('Whole-ship reliability', `+${(def.flags.reliabilityBonus * 100).toFixed(1)} %`));
    if (def.aero?.cdA) facts.append(fact('Drag area on ascent', `${def.aero.cdA} m²`));
    if (def.aero?.entryCdA) facts.append(fact('Drag area on entry', `${def.aero.entryCdA} m²`));
    facts.append(fact('Size', `${def.height.toFixed(2)} m tall · ${def.attach === 'axial' ? 'in the stack' : 'side-mounted'}`));
    if (def.real) facts.append(fact('Real-world reference', def.real));
    if (part) {
      const mat = materialOf(part, def);
      if (mat) facts.append(fact('Material', mat.name));
    }
    return facts;
  }

  function renderHint(message) {
    setSide('Choose', h('p', 'vd-side-text', message), h('p', 'vd-side-muted', 'Cards show the picture, the name and the price. Click one and its story appears here.'));
  }

  function renderCandidateDetail(def, { installedId, onInstall }) {
    const installed = installedId ? catalog.get(installedId) : null;
    const fig = figuresOf(def);
    const wrap = h('div', 'vd-detail');
    wrap.append(bigImage(icons.iconFor(def), def.name), h('h3', 'vd-detail-name', def.name), h('div', 'vd-detail-role', def.role ?? ''), h('p', 'vd-detail-text', def.detail ?? def.desc ?? ''));
    wrap.append(prosCons(def.pros, def.cons), figureFacts(def, fig));
    if (installed && installed.id !== def.id) {
      const cur = figuresOf(installed, assembly.part(state.selected));
      const cmp = h('div', 'vd-compare');
      cmp.append(h('div', 'hud-label', `Compared with the ${installed.name}`));
      cmp.append(fact('Mass', signed(fig.mass - cur.mass, fmtMass), fig.mass - cur.mass > 0 ? 'vd-fact-v--warn' : 'vd-fact-v--good'));
      cmp.append(fact('Price', signed(fig.cost - cur.cost, fmtMoneyShort), fig.cost - cur.cost > 0 ? 'vd-fact-v--warn' : 'vd-fact-v--good'));
      cmp.append(fact('Reliability', signed((fig.reliability - cur.reliability) * 100, (n) => `${n.toFixed(1)} %`), fig.reliability < cur.reliability ? 'vd-fact-v--warn' : 'vd-fact-v--good'));
      if (def.fuel && installed.fuel) cmp.append(fact('Propellant', signed(def.fuel.mass - installed.fuel.mass, fmtMass)));
      if (fig.engine && cur.engine) cmp.append(fact('Thrust', signed(fig.engine.thrust - cur.engine.thrust, fmtKN)));
      wrap.append(cmp);
    }
    const act = h('div', 'vd-detail-actions');
    if (installed?.id === def.id) act.append(h('div', 'vd-side-muted', 'This one is installed.'));
    else act.append(btn('vd-btn vd-btn--choose', state.mode === 'part' ? `INSTALL INSTEAD · ${fmtMoneyShort(fig.cost)}` : `INSTALL · ${fmtMoneyShort(fig.cost)}`, () => onInstall(def), { tool: 'install' }));
    wrap.append(act);
    setSide(state.mode === 'part' ? 'Replacement' : 'Part', wrap);
  }

  function renderPartDetail(id) {
    const part = assembly.part(id);
    const def = part && catalog.get(part.type);
    if (!def) { closeStrip(); return; }
    const fig = figuresOf(def, part);
    const wrap = h('div', 'vd-detail');
    wrap.append(bigImage(icons.iconFor(def), def.name), h('h3', 'vd-detail-name', def.name), h('div', 'vd-detail-role', def.role ?? ''), h('p', 'vd-detail-text', def.detail ?? def.desc ?? ''));
    wrap.append(prosCons(def.pros, def.cons), figureFacts(def, fig, part));
    // material
    const fam = materialFamily(def);
    if (fam) {
      const cur = materialOf(part, def);
      const box = h('div', 'vd-block');
      box.append(h('div', 'hud-label', `${fam.name}: material`));
      const chips = h('div', 'vd-chips');
      for (const o of fam.options) {
        const c = btn('vd-chip-btn', o.name, () => { assembly.setMaterial(id, o.id); sound('ui.click'); changed(); openPickerForPart(id, { keepFocus: true }); }, { material: o.id });
        c.setAttribute('aria-pressed', String(cur?.id === o.id));
        chips.append(c);
      }
      box.append(chips);
      if (cur) {
        box.append(h('p', 'vd-side-text', cur.note ?? ''));
        if (cur.facts) box.append(h('div', 'vd-side-muted', cur.facts));
        box.append(h('div', 'vd-side-muted', `mass ×${cur.mass} · cost ×${cur.cost} · reliability ${signed(cur.reliability * 100, (n) => `${n.toFixed(1)} %`)}`));
        box.append(prosCons(cur.pros, cur.cons));
      }
      wrap.append(box);
    }
    // internals
    const kit = kitOf(def);
    if (kit) {
      const box = h('div', 'vd-block');
      box.append(h('div', 'hud-label', kit.name), h('p', 'vd-side-muted', 'Zoom in on the part to see these slide out. Click one to change it.'));
      const opts = assembly.options(id);
      const list = h('div', 'vd-slots');
      for (const slot of kit.slots) {
        const row = btn('vd-slot-row', null, () => { sound('ui.click'); openInternal(id, slot.key); }, { slot: slot.key });
        row.append(h('span', 'vd-slot-k', slot.name), h('span', 'vd-slot-v', opts[slot.key]?.name ?? '—'), h('span', 'vd-slot-arrow', '▸'));
        list.append(row);
      }
      box.append(list);
      wrap.append(box);
    }
    // engine: templates and the workbench
    if (def.engine) {
      const box = h('div', 'vd-block');
      box.append(h('div', 'hud-label', 'Real engines as templates'), h('p', 'vd-side-muted', 'Set the chamber, nozzle, pump and internals the way a real engine is built.'));
      const chips = h('div', 'vd-chips');
      for (const ref of engines.references ?? []) {
        const c = btn('vd-chip-btn', ref.name, () => {
          assembly.setEngine(id, { fuel: ref.fuel, nozzle: ref.nozzle, pump: ref.pump });
          for (const [k, v] of Object.entries(ref.options ?? {})) assembly.setOption(id, k, v);
          sound('ui.snap');
          toast(`${ref.name}: ${ref.maker}`);
          changed();
          openPickerForPart(id, { keepFocus: true });
          const facts = sideBody.querySelector('.vd-template-facts');
          if (facts) facts.textContent = ref.facts;
        }, { template: ref.id });
        c.title = ref.facts;
        chips.append(c);
      }
      box.append(chips, h('div', 'vd-side-muted vd-template-facts', 'Click a template to read its real numbers.'));
      box.append(btn('vd-btn', 'ENGINE WORKBENCH: chamber · nozzle · pump', () => hooks.onWorkbench?.(id), { tool: 'workbench' }));
      wrap.append(box);
    }
    const act = h('div', 'vd-detail-actions');
    act.append(btn('vd-btn vd-btn--danger', 'REMOVE THIS PART', () => { assembly.remove(id); sound('ui.click'); toast(`${def.name} removed.`); closeStrip(); changed(); }, { tool: 'remove' }));
    wrap.append(act);
    setSide('Installed part', wrap);
  }

  function renderOptionDetail(id, slot, option, current) {
    const part = assembly.part(id);
    const def = part && catalog.get(part.type);
    if (!def || !option) return;
    const wrap = h('div', 'vd-detail');
    wrap.append(bigImage(optionIcon(def, slot, option), option.name), h('h3', 'vd-detail-name', option.name), h('div', 'vd-detail-role', slot.name), h('p', 'vd-detail-text', option.note ?? ''));
    wrap.append(prosCons(option.pros, option.cons));
    const facts = h('div', 'vd-facts');
    facts.append(fact('Effect on this part', deltaLine(option)));
    if (option.real) facts.append(fact('Real-world reference', option.real));
    // the whole part with this option vs now
    const now = figuresOf(def, part);
    const then = figuresOf(def, { ...part, options: { ...(part.options ?? {}), [slot.key]: option.id } });
    facts.append(fact('Part mass', `${fmtMass(now.mass)} → ${fmtMass(then.mass)}`), fact('Part price', `${fmtMoneyShort(now.cost)} → ${fmtMoneyShort(then.cost)}`), fact('Part reliability', `${fmtPct(now.reliability)} → ${fmtPct(then.reliability)}`));
    if (then.engine && now.engine) facts.append(fact('Thrust · Isp (vac)', `${fmtKN(now.engine.thrust)} · ${fmtInt(now.engine.ispVac)} s → ${fmtKN(then.engine.thrust)} · ${fmtInt(then.engine.ispVac)} s`));
    if (then.booster && now.booster) facts.append(fact('Thrust · Isp (vac)', `${fmtKN(now.booster.thrust)} · ${fmtInt(now.booster.ispVac)} s → ${fmtKN(then.booster.thrust)} · ${fmtInt(then.booster.ispVac)} s`));
    wrap.append(facts);
    const act = h('div', 'vd-detail-actions');
    if (current?.id === option.id) act.append(h('div', 'vd-side-muted', 'This is what the part has now.'));
    else act.append(btn('vd-btn vd-btn--choose', 'USE THIS', () => { assembly.setOption(id, slot.key, option.id); sound('ui.snap'); changed(); openInternal(id, slot.key); }, { tool: 'useoption' }));
    wrap.append(act);
    setSide(`Inside the ${def.name}`, wrap);
  }

  function renderSummary() {
    if (!last) return;
    const { spec, breakdown, blocks } = last;
    const s = spec.stats;
    const wrap = h('div', 'vd-summary');
    // anatomy: the stack from the top down, with clamped equipment under its host
    const lay = assembly.layout();
    const axial = lay.filter((e) => e.attach === 'axial').sort((a, b) => b.y - a.y);
    const stageName = (def) => catalog.families.find((f) => f.id === def.family)?.stage ?? 'Equipment';
    const anatomy = h('div', 'vd-anatomy');
    anatomy.append(h('div', 'hud-label', `Anatomy · ${fmtInt(breakdown.stackHeight * 10) / 10} m · ${fmtMass(s.wetMass)} on the pad`));
    let lastStage = null;
    const seenGroups = new Set();
    for (const e of axial) {
      const st = stageName(e.def);
      if (st !== lastStage) { anatomy.append(h('div', 'vd-anatomy-stage', st)); lastStage = st; }
      const row = btn(`vd-anatomy-row${state.selected === e.id ? ' vd-anatomy-row--on' : ''}`, null, () => { sound('ui.click'); openPickerForPart(e.id); }, { part: e.id });
      const mat = materialOf(assembly.part(e.id), e.def);
      row.append(h('span', 'vd-anatomy-name', e.def.name), h('span', 'vd-anatomy-sub', e.engine ? `${e.engine.fuel} · ${e.engine.nozzle} · pump ${e.engine.pump}` : mat?.name ?? ''));
      anatomy.append(row);
      for (const c of lay.filter((x) => x.attach === 'radial' && x.parentId === e.id)) {
        if (c.group && seenGroups.has(c.group)) continue;
        if (c.group) seenGroups.add(c.group);
        const twins = c.group ? lay.filter((x) => x.group === c.group).length : 1;
        const sub = btn(`vd-anatomy-row vd-anatomy-row--sub${state.selected === c.id ? ' vd-anatomy-row--on' : ''}`, null, () => { sound('ui.click'); openPickerForPart(c.id); }, { part: c.id });
        sub.append(h('span', 'vd-anatomy-name', `${c.def.name}${twins > 1 ? ` ×${twins}` : ''}`), h('span', 'vd-anatomy-sub', c.def.role ?? ''));
        anatomy.append(sub);
      }
    }
    if (!axial.length) anatomy.append(h('div', 'vd-side-muted', 'Nothing on the stand yet.'));
    wrap.append(anatomy);
    // what is missing
    const miss = h('div', 'vd-block');
    const done = CHECKLIST.filter((c) => c.test(spec, lay));
    miss.append(h('div', 'hud-label', `Checklist · ${done.length} of ${CHECKLIST.filter((c) => !c.optional).length}`));
    const list = h('div', 'vd-checklist');
    for (const item of CHECKLIST) {
      const ok = item.test(spec, lay);
      const row = btn(`vd-check${ok ? ' vd-check--done' : ''}`, null, () => { sound('ui.click'); openPickerForFamily(item); }, { check: item.id });
      row.append(h('span', 'vd-check-mark', ok ? '✓' : '○'), h('span', 'vd-check-label', item.label));
      list.append(row);
    }
    miss.append(list);
    wrap.append(miss);
    const warnings = h('div', 'vd-warnings');
    warnings.append(...blocks.map((id) => h('div', 'vd-warning vd-warning--block', WARN[id] ?? id)), ...spec.warnings.map((id) => h('div', 'vd-warning', WARN[id] ?? id)));
    if (!blocks.length && !spec.warnings.length) warnings.append(h('div', 'vd-warning vd-warning--ok', 'All consoles would say GO.'));
    wrap.append(warnings);
    const numbers = h('div', 'vd-block');
    const toggle = btn('vd-btn vd-btn--ghost', state.numbers ? 'HIDE THE NUMBERS' : 'SHOW THE NUMBERS', () => { state.numbers = !state.numbers; lensHost.hidden = !state.numbers; toggle.textContent = state.numbers ? 'HIDE THE NUMBERS' : 'SHOW THE NUMBERS'; }, { tool: 'numbers' });
    lensHost.hidden = !state.numbers;
    numbers.append(toggle, lensHost);
    wrap.append(numbers);
    setSide('Vehicle', wrap);
  }

  function renderSide() {
    if (state.mode === 'idle') renderSummary();
  }

  // ---------- header chips ----------
  function chip(label, value, st, sub = null) {
    const c = h('div', 'vd-chip');
    c.dataset.state = st;
    c.append(h('span', 'vd-chip-label', label), h('span', 'vd-chip-value', value));
    if (sub) c.append(h('span', 'vd-chip-sub', sub));
    return c;
  }
  function renderStats(result) {
    const s = result.spec.stats;
    const b = result.breakdown;
    const money = getMoney();
    const fee = b.slot?.fee ?? 0;
    stats.replaceChildren(
      chip('Cost', fmtMoneyShort(s.cost), s.cost + fee > money ? 'bad' : 'ok', fee ? `+${fmtMoneyShort(fee)} pad fee` : null),
      chip('Funds', fmtMoneyShort(money), money < s.cost + fee ? 'bad' : 'ok'),
      chip('Δv', `${fmtInt(s.deltaV)}`, s.deltaV >= b.roundTrip ? 'good' : s.deltaV >= b.oneWay ? 'ok' : 'bad', `need ${fmtInt(b.oneWay)} m/s`),
      chip('TWR', s.twrEarth.toFixed(2), s.twrEarth >= 1.2 ? 'ok' : s.twrEarth >= 1 ? 'warn' : 'bad', `${fmtKN(b.thrustSL)} on the pad`),
      chip('Reliability', fmtPct(s.reliability), s.reliability >= 0.9 ? 'good' : s.reliability >= 0.8 ? 'ok' : 'bad'),
      chip('Stable', b.copY < b.comY ? 'yes' : 'no', b.copY < b.comY ? 'ok' : 'bad'),
    );
    shipName.textContent = assembly.name;
    undoBtn.disabled = !assembly.canUndo;
  }

  // ---------- the 3D view: labels, slots, pointer ----------
  const labelEls = new Map(); // key -> element
  let anchorsNow = [];
  function refreshLabels(force = false) {
    void force;
    // the scene's free nodes change with the assembly; the page tells it
    scene3d.setFreeNodes(assembly.freeNodes());
  }
  function layoutLabels() {
    const rect = view.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    anchorsNow = scene3d.screenAnchors(rect);
    const keep = new Set();
    const exploded = scene3d.explode > 0.25 && state.selected;
    const left = [], right = [];
    for (const a of anchorsNow) {
      if (!a.visible) continue;
      if (a.kind === 'part') {
        const e = a.entry;
        if (exploded && a.id !== state.selected) continue;
        if (e.group && anchorsNow.some((o) => o !== a && o.kind === 'part' && o.entry.group === e.group && o.entry.id < e.id)) continue; // one label per symmetry group
        (e.attach === 'axial' ? left : right).push(a);
      }
    }
    const place = (list, column) => {
      list.sort((p, q) => p.y - q.y);
      let y = -Infinity;
      for (const a of list) { a.ly = Math.max(a.y, y + LABEL_H); y = a.ly; }
      let limit = rect.height - LABEL_H;
      for (let i = list.length - 1; i >= 0; i--) { list[i].ly = Math.min(list[i].ly, limit); limit = list[i].ly - LABEL_H; }
      for (const a of list) {
        const key = `part:${a.id}`;
        keep.add(key);
        let elx = labelEls.get(key);
        if (!elx) {
          elx = btn('vd-label', null, () => { sound('ui.click'); openPickerForPart(a.id); }, { part: a.id });
          elx.append(h('span', 'vd-label-name'), h('span', 'vd-label-sub'));
          elx.leader = svgEl('line', { class: 'vd-leader' });
          overlay.append(elx.leader);
          labels.append(elx);
          labelEls.set(key, elx);
        }
        const e = a.entry;
        const twins = e.group ? assembly.parts.filter((p) => p.group === e.group).length : 1;
        const mat = materialOf(assembly.part(e.id), e.def);
        elx.firstChild.textContent = `${e.def.name}${twins > 1 ? ` ×${twins}` : ''}`;
        elx.lastChild.textContent = e.engine ? `${e.engine.fuel} · ${e.engine.nozzle} nozzle · pump ${e.engine.pump}` : mat ? mat.name : e.def.role ?? '';
        elx.classList.toggle('vd-label--selected', state.selected === e.id);
        elx.classList.toggle('vd-label--right', column === 'right');
        const x = column === 'left' ? 14 : rect.width - 14 - 220;
        elx.style.transform = `translate(${x}px, ${a.ly - 14}px)`;
        elx.leader.setAttribute('x1', column === 'left' ? x + 220 : x);
        elx.leader.setAttribute('y1', a.ly);
        elx.leader.setAttribute('x2', a.x);
        elx.leader.setAttribute('y2', a.y);
      }
    };
    place(left, 'left');
    place(right, 'right');
    // slots
    if (!exploded) {
      for (const a of anchorsNow.filter((x) => x.kind === 'slot' && x.visible)) {
        const key = `slot:${a.id}:${a.node}`;
        keep.add(key);
        let elx = labelEls.get(key);
        if (!elx) {
          elx = btn('vd-slot', a.node === 'top' ? '+ add on top' : '+ add below', () => { sound('ui.click'); openPickerForSlot(a.id, a.node); }, { node: a.node, part: a.id });
          labels.append(elx);
          labelEls.set(key, elx);
        }
        elx.classList.toggle('vd-slot--selected', state.slot?.partId === a.id && state.slot?.node === a.node);
        elx.style.transform = `translate(${a.x - 60}px, ${a.y - 13}px)`;
      }
    }
    // internals tags
    if (exploded) {
      for (const a of anchorsNow.filter((x) => x.kind === 'internal' && x.visible)) {
        const key = `int:${a.key}`;
        keep.add(key);
        let elx = labelEls.get(key);
        if (!elx) {
          elx = btn('vd-tag', null, () => { sound('ui.click'); openInternal(state.selected, a.key); }, { internal: a.key });
          elx.append(h('span', 'vd-tag-name'), h('span', 'vd-tag-sub'));
          labels.append(elx);
          labelEls.set(key, elx);
        }
        const opts = assembly.options(state.selected);
        elx.firstChild.textContent = a.name;
        elx.lastChild.textContent = opts[a.key]?.name ?? '';
        elx.classList.toggle('vd-tag--on', state.internal === a.key);
        elx.style.transform = `translate(${a.x + 14}px, ${a.y - 14}px)`;
      }
    }
    for (const [key, elx] of labelEls) {
      if (keep.has(key)) continue;
      elx.leader?.remove();
      elx.remove();
      labelEls.delete(key);
    }
    overlay.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    overlay.setAttribute('width', rect.width);
    overlay.setAttribute('height', rect.height);
  }

  // pointer: click picks, wheel zooms (and explodes a selected part), HTML5 drag turns the vehicle
  view.addEventListener('click', (e) => {
    if (e.target !== view && e.target !== overlay) return; // buttons handle themselves
    const rect = view.getBoundingClientRect();
    const hit = scene3d.pick(e.clientX, e.clientY, rect);
    if (!hit) { if (state.mode === 'part' || state.mode === 'internal') closeStrip(); return; }
    sound('ui.click');
    if (hit.internal) openInternal(hit.partId, hit.internal);
    else openPickerForPart(hit.partId);
  });
  view.addEventListener('dblclick', (e) => {
    const rect = view.getBoundingClientRect();
    const hit = scene3d.pick(e.clientX, e.clientY, rect);
    if (hit?.partId) { openPickerForPart(hit.partId); scene3d.focusOn(hit.partId, { exploded: true }); }
  });
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    scene3d.zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  const ghost = document.createElement('canvas');
  ghost.width = ghost.height = 1;
  let drag = null;
  view.addEventListener('dragstart', (e) => {
    if (e.target !== view && e.target !== overlay) { e.preventDefault(); return; }
    e.dataTransfer.setDragImage(ghost, 0, 0);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', 'turn'); } catch { /* some browsers refuse */ }
    drag = { x: e.clientX, y: e.clientY };
    view.classList.add('vd-view--turning');
  });
  const onDragOver = (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!e.clientX && !e.clientY) return; // Firefox reports 0,0 at the end
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (dx || dy) { scene3d.rotateBy(dx, dy); drag = { x: e.clientX, y: e.clientY }; }
  };
  el.addEventListener('dragenter', (e) => { if (drag) e.preventDefault(); });
  el.addEventListener('dragover', onDragOver);
  el.addEventListener('drop', (e) => { if (drag) e.preventDefault(); });
  view.addEventListener('dragend', () => { drag = null; view.classList.remove('vd-view--turning'); });

  // ---------- empty stand ----------
  function renderEmpty(show) {
    empty.hidden = !show;
    if (!show) return;
    empty.replaceChildren(h('div', 'vd-empty-title', 'Nothing on the stand yet'), h('div', 'vd-empty-sub', 'A rocket is built from the top down. Pick where to start, or load a preset.'));
    for (const zone of ZONES) {
      const z = btn(`vd-zone${state.zone === zone.id ? ' vd-zone--selected' : ''}`, null, () => { sound('ui.click'); openPickerForZone(zone); }, { zone: zone.id });
      z.append(h('span', 'vd-zone-name', zone.name), h('span', 'vd-zone-hint', zone.hint));
      empty.append(z);
    }
    empty.append(btn('vd-btn', 'LOAD A PRESET VEHICLE', () => hooks.onPresets?.(), { tool: 'presets' }));
  }

  // ---------- refresh ----------
  function refresh(result) {
    last = result;
    renderStats(result);
    const lay = assembly.layout();
    scene3d.setLayout(lay);
    scene3d.setFreeNodes(assembly.freeNodes());
    if (scene3d.missingArt.length) hooks.onNeedArt?.(scene3d.missingArt);
    const axial = lay.filter((e) => e.attach === 'axial');
    renderEmpty(!axial.length);
    const biggest = axial.filter((e) => e.def.nodes.includes('radial')).sort((a, b) => b.height - a.height)[0];
    clampBtn.hidden = !biggest;
    clampBtn.onclick = biggest ? () => { sound('ui.click'); openPickerForSlot(biggest.id, 'radial'); } : null;
    if (state.selected && !assembly.part(state.selected)) { closeStrip(); return; }
    if (state.mode === 'idle') renderSummary();
    else if (state.mode === 'part') renderPartDetail(state.selected);
  }

  function update(dt) {
    if (el.hidden) return;
    // how far the selected part is pulled apart: fully in internal mode, by zoom otherwise
    const canExplode = (state.mode === 'part' || state.mode === 'internal') && state.selected && catalog.kit?.(assembly.def(state.selected));
    scene3d.setExplode(!canExplode ? 0 : state.mode === 'internal' ? 1 : scene3d.zoomFraction());
    const rect = view.getBoundingClientRect();
    if (rect.width && rect.height) scene3d.setViewCentre(rect.left + rect.width / 2, rect.top + rect.height / 2, window.innerWidth, window.innerHeight);
    scene3d.update(dt);
    turn.value = String(((((scene3d.orbit.yaw * 180) / Math.PI) % 360) + 360) % 360);
    layoutLabels();
  }

  function show({ family = null, browse = false } = {}) {
    el.hidden = false;
    hooks.onOpen3d?.(scene3d.scene, scene3d.camera);
    scene3d.setEnvironment();
    scene3d.fit();
    scene3d.orbit.idle = 0;
    refresh(last ?? hooks.compute?.());
    if (browse) openBrowse();
    else if (family) {
      const item = CHECKLIST.find((c) => c.id === family);
      if (item) openPickerForFamily(item);
    }
  }
  function hide() {
    if (el.hidden) return;
    el.hidden = true;
    closeStrip();
    scene3d.clearViewCentre();
    hooks.onClose3d?.();
  }

  return {
    el, lensHost, refresh, show, hide, update,
    closePicker: closeStrip,
    rotateBy: (deg) => { scene3d.orbit.yaw += (deg * Math.PI) / 180; scene3d.orbit.idle = 0; },
    get open() { return !el.hidden; },
    get pickerOpen() { return state.mode !== 'idle'; },
  };
}
