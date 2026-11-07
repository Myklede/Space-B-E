// The hangar terminal (state HANGAR): palette, node and part markers projected from the 3D rocket, stats,
// warnings, the Formula Lens host, dialogs. It edits the Assembly directly and tells index.js through `onChange`.
// DOM class names are the contract with builder.css (Sub-AI 2); see README-ARCH.md.
import { SYMMETRIES } from './assembly.js';
import { fmtInt, fmtKN, fmtMass, fmtMoney, fmtMoneyShort, fmtPct } from './format.js';

const WARNING_LABELS = {
  LOW_DV: 'Low Δv', LOW_TWR: 'Low TWR', NO_HEAT_SHIELD: 'No heat shield', NO_LEGS: 'No landing legs', UNSTABLE: 'Unstable',
  LOW_O2: 'No spare O₂', NO_ANTENNA: 'No antenna', NO_SHELTER: 'No radiation shelter', COLD_SEALS: 'Seals not cold-rated', LOW_RELIABILITY: 'Low reliability',
  NO_CAPSULE: 'No capsule', NO_ENGINE: 'No engine', NO_FUEL: 'No usable fuel', NOT_CONNECTED: 'Parts not connected', OVER_BUDGET: 'Over budget',
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

/**
 * createHangarScreen({ assembly, catalog, launch, text, scene, getMoney, insolvencyFloor, hooks })
 *   hooks: { onChange, onGonogo, onWorkbench(partId), onPresets, onBlueprints, onShare, onBankrupt, onSound(id) }
 * returns { el, lensHost, update(dt), refresh(result), openDialog, closeDialog, dispose }
 */
export function createHangarScreen({ assembly, catalog, launch, text, scene, getMoney, insolvencyFloor = 0, hooks }) {
  const el = h('div', 'bld-terminal hud');
  el.dataset.screen = 'hangar';
  el.dataset.stub = 'hangar'; // check:boot looks for [data-stub] in every state
  const state = { family: catalog.families[0]?.id ?? null, node: null, part: null };
  let last = null; // last refresh result { spec, breakdown, blocks }

  // ---------- top bar ----------
  const topbar = h('header', 'bld-topbar');
  const title = h('div', 'bld-title', 'HANGAR TERMINAL · ');
  const shipName = h('span', 'bld-ship-name', assembly.name);
  shipName.title = 'Rename the ship';
  shipName.addEventListener('click', () => openRename());
  title.append(shipName);
  const topActions = h('div', 'bld-topbar-actions');
  topActions.append(
    btn('bld-tool', 'PRESETS', () => hooks.onPresets?.(), { tool: 'presets' }),
    btn('bld-tool', 'BLUEPRINTS', () => hooks.onBlueprints?.(), { tool: 'blueprints' }),
    btn('bld-tool', 'SHARE CODE', () => hooks.onShare?.(), { tool: 'share' }),
    btn('bld-tool', 'LAUNCH WINDOW', () => openLaunchSlot(), { tool: 'launchslot' }),
  );
  const money = h('div', 'bld-money');
  const moneyValue = h('span', 'bld-money-value');
  money.append(h('span', 'hud-label', 'Funds'), moneyValue);
  topbar.append(title, topActions, money);

  // ---------- palette ----------
  const palette = h('aside', 'bld-palette hud-panel');
  const tabs = h('div', 'bld-family-tabs');
  const partList = h('div', 'bld-part-list');
  const hint = h('div', 'bld-palette-hint', text.hangar?.hint ?? '');
  palette.append(tabs, partList, hint);

  // ---------- stage ----------
  const stage = h('main', 'bld-stage');
  const markers = h('div', 'bld-markers');
  const toolbar = h('div', 'bld-toolbar');
  const undoBtn = btn('bld-tool', 'UNDO', () => { if (assembly.undo()) changed(); }, { tool: 'undo' });
  const redoBtn = btn('bld-tool', 'REDO', () => { if (assembly.redo()) changed(); }, { tool: 'redo' });
  const removeBtn = btn('bld-tool', 'REMOVE', () => removeSelected(), { tool: 'remove' });
  const rotateBtn = btn('bld-tool', 'ROTATE 30°', () => { if (state.part && assembly.rotate(state.part, 30)) changed(); }, { tool: 'rotate' });
  const upBtn = btn('bld-tool', 'SLIDE ▲', () => { if (state.part && assembly.slide(state.part, 0.1)) changed(); }, { tool: 'slideup' });
  const downBtn = btn('bld-tool', 'SLIDE ▼', () => { if (state.part && assembly.slide(state.part, -0.1)) changed(); }, { tool: 'slidedown' });
  const workbenchBtn = btn('bld-tool', 'ENGINE WORKBENCH', () => openWorkbench(), { tool: 'workbench' });
  const clearBtn = btn('bld-tool', 'CLEAR', () => openConfirm('Clear the whole rocket?', () => { assembly.clear(); state.part = null; state.node = null; changed(); }), { tool: 'clear' });
  const viewL = btn('bld-tool', '⟲', () => scene.rotateBy(-30), { tool: 'viewleft' });
  const viewR = btn('bld-tool', '⟳', () => scene.rotateBy(30), { tool: 'viewright' });
  const symmetry = h('div', 'bld-symmetry');
  symmetry.append(h('span', 'hud-label', 'Symmetry'));
  const symButtons = SYMMETRIES.map((n) => {
    const b = btn('bld-sym', `×${n}`, () => { assembly.setSymmetry(n); renderSymmetry(); }, { sym: String(n) });
    symmetry.append(b);
    return b;
  });
  const selection = h('div', 'bld-selection', '');
  toolbar.append(undoBtn, redoBtn, removeBtn, rotateBtn, upBtn, downBtn, workbenchBtn, clearBtn, viewL, viewR, symmetry, selection);
  stage.append(markers, toolbar);

  // ---------- stats ----------
  const stats = h('aside', 'bld-stats hud-panel');
  const statGrid = h('div', 'bld-stat-grid');
  const statEls = {};
  const STAT_ROWS = [['cost', 'Cost'], ['mass', 'Mass wet / dry'], ['fuel', 'Fuel'], ['thrust', 'Thrust (SL)'], ['deltaV', 'Δv'], ['twr', 'TWR Earth'], ['reliability', 'Reliability'], ['stability', 'Stability'], ['power', 'Power'], ['weather', 'Launch window']];
  for (const [key, label] of STAT_ROWS) {
    const s = h('div', 'bld-stat');
    s.dataset.stat = key;
    const v = h('span', 'bld-stat-value', '—');
    s.append(h('span', 'bld-stat-label', label), v);
    statEls[key] = { el: s, value: v };
    statGrid.append(s);
  }
  const warnings = h('div', 'bld-warnings');
  const lensHost = h('div', 'bld-lens');
  stats.append(statGrid, warnings, lensHost);

  // ---------- footer ----------
  const footer = h('footer', 'bld-footer hud-panel');
  const footerNote = h('div', 'bld-footer-note', '');
  const goBtn = btn('hud-button bld-go', 'GO / NO-GO POLL →', () => hooks.onGonogo?.(), { tool: 'gonogo' });
  footer.append(footerNote, goBtn);

  // ---------- dialog ----------
  const backdrop = h('div', 'bld-dialog-backdrop');
  backdrop.hidden = true;
  const dialog = h('div', 'bld-dialog hud-panel');
  backdrop.append(dialog);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeDialog(); });

  el.append(h('div', 'bld-bezel'), topbar, palette, stage, stats, footer, backdrop);

  // ---------- behaviour ----------
  function changed() {
    hooks.onChange?.();
  }

  function sound(id) {
    hooks.onSound?.(id);
  }

  function selectNode(partId, node) {
    state.node = partId ? { partId, node } : null;
    state.part = null;
    scene.select(null);
    renderPalette();
    renderMarkers();
    renderToolbar();
  }

  function selectPart(id) {
    state.part = id;
    state.node = null;
    scene.select(id);
    renderPalette();
    renderMarkers();
    renderToolbar();
  }

  function removeSelected() {
    if (!state.part) return;
    const removed = assembly.remove(state.part);
    if (removed.length) {
      sound('ui.click');
      state.part = null;
      scene.select(null);
      changed();
    }
  }

  function addPart(typeId) {
    const def = catalog.get(typeId);
    if (!def) return;
    let ids = [];
    if (!assembly.parts.length) ids = assembly.attach(typeId);
    else if (state.node) ids = assembly.attach(typeId, state.node.partId, state.node.node);
    if (!ids.length) {
      sound('ui.error');
      return;
    }
    sound('ui.snap');
    // Keep building: after stacking a part, select its free node on the far side so the next part goes there.
    const newDef = catalog.get(typeId);
    if (newDef.attach === 'axial') {
      const far = state.node?.node === 'top' ? 'top' : 'bottom';
      state.node = newDef.nodes.includes(far) ? { partId: ids[0], node: far } : null;
    }
    changed();
  }

  // ---------- rendering ----------
  function renderMoney() {
    const m = getMoney();
    moneyValue.textContent = fmtMoney(m);
    const cost = last ? last.spec.stats.cost + (last.breakdown.slot?.fee ?? 0) : 0;
    money.dataset.state = m < cost ? 'bad' : m < insolvencyFloor * 1.5 ? 'low' : 'ok';
  }

  function renderTabs() {
    tabs.replaceChildren(...catalog.families.map((f) => {
      const b = btn('bld-family-tab', f.name, () => { state.family = f.id; renderTabs(); renderPalette(); });
      b.setAttribute('aria-pressed', String(state.family === f.id));
      return b;
    }));
  }

  function renderPalette() {
    const empty = assembly.parts.length === 0;
    const list = catalog.parts.filter((p) => p.family === state.family);
    partList.replaceChildren(...list.map((p) => {
      const b = btn('bld-part', null, () => addPart(p.id), { part: p.id });
      const cost = p.engine ? 'engine: see workbench' : fmtMoneyShort(p.cost);
      b.append(h('span', 'bld-part-name', p.name), h('span', 'bld-part-meta', `${fmtMass(p.mass + (p.fuel?.mass ?? 0))} · ${cost}${p.fuel ? ` · ${p.fuel.type}` : ''}`));
      let reason = '';
      if (empty) reason = p.attach === 'axial' ? '' : 'Start with a capsule';
      else if (!state.node) reason = 'Select a node first, or drag me onto one';
      else reason = assembly.canAttach(p.id, state.node.partId, state.node.node).reason;
      b.disabled = !!reason && !(reason.startsWith('Select a node'));
      b.title = reason ? `${p.desc} (${reason})` : p.desc;
      // Drag a part onto a glowing node (HTML drag and drop; mouse listeners stay in core/input.js).
      b.draggable = !empty;
      b.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'copy';
        b.classList.add('bld-part--dragging');
        dragging = p.id;
      });
      b.addEventListener('dragend', () => { b.classList.remove('bld-part--dragging'); dragging = null; });
      return b;
    }));
    hint.textContent = empty ? 'Start with a capsule from COMMAND.' : state.node ? `Node selected: ${state.node.node} of ${assembly.def(state.node.partId)?.name ?? state.node.partId}. Pick a part.` : (text.hangar?.hint ?? '');
  }

  let dragging = null;
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
      addPart(type);
    });
  }

  function renderSymmetry() {
    symButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.sym) === assembly.symmetry)));
  }

  function renderToolbar() {
    undoBtn.disabled = !assembly.canUndo;
    redoBtn.disabled = !assembly.canRedo;
    const part = state.part ? assembly.part(state.part) : null;
    const def = part ? catalog.get(part.type) : null;
    removeBtn.disabled = !part;
    rotateBtn.disabled = !(part && part.node === 'radial');
    upBtn.disabled = downBtn.disabled = !(part && part.node === 'radial');
    workbenchBtn.disabled = !assembly.parts.some((p) => catalog.get(p.type)?.engine);
    clearBtn.disabled = !assembly.parts.length;
    selection.textContent = part ? `Selected: ${def?.name ?? part.type}${part.group ? ' (symmetry group)' : ''}` : state.node ? `Node: ${state.node.node}` : '';
  }

  let markerEls = new Map(); // key -> element
  function renderMarkers() {
    const anchors = scene.worldAnchors();
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
    const rect = markers.getBoundingClientRect();
    if (!rect.width) return;
    const cam = scene.camera;
    cam.updateMatrixWorld();
    const W = window.innerWidth, H = window.innerHeight;
    for (const a of scene.worldAnchors()) {
      const key = a.kind === 'node' ? `n:${a.partId}:${a.node}` : `h:${a.partId}`;
      const m = markerEls.get(key);
      if (!m) continue;
      const p = a.world.project(cam);
      const visible = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      m.classList.toggle('bld-marker-hidden', !visible);
      if (!visible) continue;
      const x = (p.x + 1) / 2 * W - rect.left;
      const y = (1 - p.y) / 2 * H - rect.top;
      m.style.left = `${x.toFixed(1)}px`;
      m.style.top = `${y.toFixed(1)}px`;
    }
  }

  function renderStats(result) {
    const { spec, breakdown, blocks } = result;
    const s = spec.stats;
    const set = (key, value, st = 'ok') => { statEls[key].value.textContent = value; statEls[key].el.dataset.state = st; };
    const fee = breakdown.slot?.fee ?? 0;
    set('cost', `${fmtMoney(s.cost)}${fee ? ` + ${fmtMoneyShort(fee)} pad` : ''}`, s.cost + fee > getMoney() ? 'bad' : 'ok');
    set('mass', `${fmtMass(s.wetMass)} / ${fmtMass(s.dryMass)}`);
    set('fuel', `${fmtMass(s.fuelMass)}${breakdown.deadFuel ? ` (+${fmtMass(breakdown.deadFuel)} unusable)` : ''}`, s.fuelMass > 0 ? (breakdown.deadFuel ? 'warn' : 'ok') : 'bad');
    set('thrust', fmtKN(s.thrust * (s.ispVac ? s.ispSL / s.ispVac : 1)), s.thrust > 0 ? 'ok' : 'bad');
    set('deltaV', `${fmtInt(s.deltaV)} m/s`, s.deltaV >= breakdown.roundTrip ? 'good' : s.deltaV >= breakdown.oneWay ? 'ok' : 'bad');
    set('twr', s.twrEarth.toFixed(2), s.twrEarth >= 1.2 ? 'ok' : s.twrEarth >= 1 ? 'warn' : 'bad');
    set('reliability', fmtPct(s.reliability), s.reliability >= 0.9 ? 'good' : s.reliability >= 0.8 ? 'ok' : 'bad');
    const stable = breakdown.copY < breakdown.comY;
    set('stability', stable ? 'Stable' : 'Unstable', stable ? 'ok' : 'bad');
    set('power', `${fmtInt(s.power)} W`, s.power > 0 ? 'ok' : 'warn');
    set('weather', `${breakdown.slot?.name ?? '—'} · ${fmtInt(breakdown.slot?.tempC ?? 0)} °C`, (breakdown.slot?.tempC ?? 15) < 5 && !s.coldRatedSeals ? 'bad' : 'ok');

    warnings.replaceChildren(
      ...blocks.map((id) => h('div', 'bld-warning hud-alert', `BLOCK: ${WARNING_LABELS[id] ?? id}`)),
      ...spec.warnings.map((id) => h('div', 'bld-warning hud-caution', WARNING_LABELS[id] ?? id)),
    );
    goBtn.disabled = assembly.parts.length === 0;
    footerNote.textContent = blocks.length ? `${blocks.length} hard block(s): the poll will refuse the launch until they are fixed.` : spec.warnings.length ? `${spec.warnings.length} warning(s). You may override them at the poll. That is how endings happen.` : 'No warnings. Ready for the poll.';
    shipName.textContent = assembly.name;
  }

  function refresh(result) {
    last = result;
    scene.setLayout(assembly.layout(), assembly.freeNodes());
    if (state.part && !assembly.part(state.part)) state.part = null;
    if (state.node && !assembly.freeNodes().some((n) => n.partId === state.node.partId && n.node === state.node.node)) state.node = null;
    scene.select(state.part);
    renderMoney();
    renderPalette();
    renderSymmetry();
    renderToolbar();
    renderMarkers();
    renderStats(result);
    renderInsolvency();
  }

  let insolventEl = null;
  function renderInsolvency() {
    const broke = getMoney() < insolvencyFloor;
    if (broke && !insolventEl) {
      insolventEl = h('div', 'bld-warning hud-alert', text.hangar?.insolvent ?? 'Insolvent.');
      insolventEl.append(' ', btn('hud-button', 'DECLARE BANKRUPTCY', () => hooks.onBankrupt?.(), { tool: 'bankrupt' }));
      footer.prepend(insolventEl);
    } else if (!broke && insolventEl) {
      insolventEl.remove();
      insolventEl = null;
    }
  }

  // ---------- dialogs ----------
  function openDialog({ title: t, body, actions = [] }) {
    dialog.replaceChildren(h('div', 'bld-dialog-title', t));
    const b = h('div', 'bld-dialog-body');
    if (typeof body === 'function') body(b); else if (body) b.append(body);
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
    openDialog({ title: 'Ship name', body: input, actions: [{ label: 'CANCEL' }, { label: 'OK', onClick: () => { assembly.rename(input.value); changed(); } }] });
    input.focus();
    input.select();
  }

  function openLaunchSlot() {
    openDialog({
      title: 'Launch window',
      body: (body) => {
        const list = h('div', 'bld-list');
        for (const slot of launch.slots) {
          const item = btn('bld-list-item', null, () => { assembly.setLaunchSlot(slot.id); closeDialog(); changed(); });
          item.setAttribute('aria-pressed', String(assembly.launch.slot === slot.id));
          item.append(h('span', null, `${slot.name} · ${fmtInt(slot.tempC)} °C`), h('span', 'bld-list-meta', `${slot.fee ? fmtMoneyShort(slot.fee) + ' pad fees' : 'no fees'} · ${slot.note}`));
          list.append(item);
        }
        body.append(list, h('div', 'bld-list-meta', 'Cold mornings are free and soon. Seals that are not cold-rated fail below 5 °C.'));
      },
      actions: [{ label: 'CLOSE' }],
    });
  }

  function openWorkbench() {
    const engine = (state.part && catalog.get(assembly.part(state.part)?.type)?.engine) ? state.part : assembly.parts.find((p) => catalog.get(p.type)?.engine)?.id;
    if (!engine) return;
    hooks.onWorkbench?.(engine);
  }

  function update(dt) {
    projectMarkers();
    void dt;
  }

  function dispose() {
    el.remove();
    markerEls.clear();
  }

  renderTabs();
  renderMoney();
  return { el, lensHost, update, refresh, openDialog, closeDialog, openConfirm, dispose, state, renderMoney, get selectedPart() { return state.part; } };
}
