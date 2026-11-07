// The vehicle design page. The ship turns in 3D in the middle (drag, wheel, click a part). On the right, four cards:
// Nose, Body, Tail, Launch pad. Open one and it becomes a vertical list: first the shape (taken from real vehicles),
// then every component of that section, then each component's choices, and inside the part, its own internals.
// Nothing floats over the ship: every word is in the card column. One card open at a time.
import { partFigures } from './stats.js';
import { padArt } from './sections/pad/art.js';
import { internalsArt } from './bay/internalsArt.js';
import { BASE_RADIUS, SIZE_SCALE } from './assembly.js';
import {
  VEHICLE_SECTIONS, WARNING_SECTION, addThroughRow, applyShape, clearSection, currentShape, padState, rowCandidates, rowItems, rowOf, sectionParts,
} from './sections.js';
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
  if (onClick) b.addEventListener('click', (e) => { e.stopPropagation(); onClick(e); });
  return b;
};
const signed = (n, f) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${f(Math.abs(n))}`;
const WARN = { LOW_DV: 'Not enough Δv to reach Mars: add propellant or a better engine', LOW_TWR: 'Too heavy for the engines (TWR under 1.2)', NO_HEAT_SHIELD: 'No heat shield under the capsule', NO_LEGS: 'No landing gear', UNSTABLE: 'Unstable in thick air: add fins low on the tail, or steering (an engine gimbal)', LOW_O2: 'No spare oxygen', NO_ANTENNA: 'No antenna', NO_SHELTER: 'No radiation shelter', COLD_SEALS: 'Cheap seals in a cold launch window', LOW_RELIABILITY: 'Reliability below 80 %', NO_CAPSULE: 'No crew capsule', NO_ENGINE: 'No engine', NO_FUEL: 'No propellant the engines can burn', NOT_CONNECTED: 'Parts not connected', OVER_BUDGET: 'Over budget' };
const SECTION_NUM = { nose: '1', body: '2', tail: '3', pad: '4' };

export function createDesignPage({ assembly, catalog, sections, materials, engines, icons, scene3d, g0, getMoney, hooks }) {
  const el = h('section', 'vd-root hud');
  el.hidden = true;
  const state = { open: null, path: [], focus: null, lens: false };
  let last = null;

  // ---------- top bar ----------
  const top = h('header', 'vd-top');
  const title = h('div', 'vd-title');
  const shipName = btn('vd-ship-name', assembly.name, () => hooks.onRename?.());
  title.append(h('span', 'vd-kicker', 'Vehicle design'), shipName);
  const stats = h('div', 'vd-stats');
  const undoBtn = btn('vd-btn vd-btn--ghost', 'UNDO', () => { if (assembly.undo()) { sound('ui.click'); changed(); } }, { tool: 'undo' });
  const actions = h('div', 'vd-actions');
  actions.append(
    undoBtn,
    btn('vd-btn vd-btn--ghost', 'CLEAR ALL', () => hooks.onConfirm?.('Take the whole vehicle off the stand and start from nothing?', () => { assembly.clear(); closeAll(); changed(); sound('ui.click'); }), { tool: 'clearall' }),
    btn('vd-btn vd-btn--ghost', 'MORE ▾', () => hooks.onMore?.(), { tool: 'more' }),
    btn('vd-btn vd-btn--test', 'TEST FIRE', () => hooks.onTest?.(), { tool: 'test' }),
    btn('vd-btn vd-btn--go', 'READINESS POLL →', () => hooks.onGonogo?.(), { tool: 'gonogo' }),
    btn('vd-btn vd-btn--ghost vd-btn--x', '✕', () => hooks.onClose?.(), { tool: 'close' }),
  );
  top.append(title, stats, actions);

  // ---------- stage: 3D view + card dock ----------
  const stage = h('main', 'vd-stage');
  const view = h('div', 'vd-view');
  view.draggable = true; // HTML5 drag turns the vehicle (the pointer stream the static check allows outside core/input.js)
  const emptyHint = h('div', 'vd-empty-hint');
  emptyHint.append(h('div', 'vd-empty-title', 'The stand is empty'), h('div', 'vd-empty-sub', 'Open a card on the right to start: Nose, Body, Tail and Launch pad, in any order. Each card starts with a shape taken from a real rocket.'));
  emptyHint.hidden = true;
  const viewbar = h('div', 'vd-viewbar');
  const turn = h('input', 'vd-turn');
  turn.type = 'range';
  turn.min = '0'; turn.max = '360'; turn.step = '1'; turn.value = '0';
  turn.title = 'Turn the vehicle';
  turn.addEventListener('input', () => { scene3d.orbit.yaw = (Number(turn.value) * Math.PI) / 180; scene3d.orbit.idle = 0; });
  const autoBtn = btn('vd-icon', '⟲', () => { scene3d.orbit.auto = !scene3d.orbit.auto; autoBtn.setAttribute('aria-pressed', String(scene3d.orbit.auto)); }, { tool: 'auto' });
  autoBtn.title = 'Turn on its own';
  autoBtn.setAttribute('aria-pressed', 'true');
  const fitBtn = btn('vd-icon', '⤢', () => { scene3d.fit(); sound('ui.click'); }, { tool: 'zoomfit' });
  fitBtn.title = 'Show the whole vehicle';
  viewbar.append(fitBtn, turn, autoBtn, h('span', 'vd-view-hint', 'drag to turn · wheel to zoom · click a part'));
  view.append(emptyHint, viewbar);

  const dock = h('aside', 'vd-dock');
  const cardsEl = h('div', 'vd-sections');
  const dockFoot = h('div', 'vd-dock-foot');
  const lensBtn = btn('vd-link', 'Show the formulas ▸', () => { state.lens = !state.lens; lensWrap.hidden = !state.lens; lensBtn.textContent = state.lens ? 'Hide the formulas ▾' : 'Show the formulas ▸'; }, { tool: 'numbers' });
  const lensWrap = h('div', 'vd-lens');
  lensWrap.hidden = true;
  const lensHost = h('div', 'bld-lens');
  lensWrap.append(lensHost);
  dockFoot.append(lensBtn, lensWrap);
  dock.append(cardsEl, dockFoot);
  stage.append(view, dock);
  el.append(top, stage);

  // ---------- helpers ----------
  const sound = (id) => hooks.onSound?.(id);
  const changed = () => hooks.onChange?.();
  const toast = (m, kind) => hooks.onToast?.(m, kind);
  const kitOf = (def) => catalog.kit?.(def) ?? null;
  const materialFamily = (def) => materials?.families?.[def.materialFamily] ?? null;
  const materialOf = (part, def) => { const fam = materialFamily(def); return fam ? (fam.options.find((o) => o.id === part?.material) ?? fam.options[0]) : null; };
  const entryOf = (id) => assembly.layout().find((e) => e.id === id) ?? null;
  const figuresOf = (def, part = null) => partFigures(def, { engines, g0, materials, catalog, materialId: part?.material ?? null, options: part?.options ?? null, engineDef: part?.engine ?? null, count: part ? (entryOf(part.id)?.cluster?.count ?? 1) : 1 });
  const dims = (def) => ({ radius: BASE_RADIUS * (SIZE_SCALE[def.size] ?? 1), height: def.height });
  const optionIcon = (def, slot, option) => icons.objectIcon(`int:${def.internals}:${slot.key}:${option.id}`, () => {
    const opts = { ...catalog.optionsOf(def, null), [slot.key]: option };
    const all = internalsArt(def, opts, dims(def));
    return (all.find((p) => p.key === slot.key) ?? all[0])?.object;
  }, { pad: 1.25 });
  scene3d.setOptionsResolver((id) => assembly.options(id));
  const sectionWarnings = (id) => {
    if (!last) return { blocks: [], warnings: [] };
    return { blocks: last.blocks.filter((w) => WARNING_SECTION[w] === id), warnings: last.spec.warnings.filter((w) => WARNING_SECTION[w] === id) };
  };
  const priceOfShape = (shape) => {
    let cost = 0, mass = 0;
    for (const t of shape.stack) { const d = catalog.get(t); if (!d) continue; const f = figuresOf(d); const n = d.engine ? (catalog.get(shape.stack[shape.stack.indexOf(t) - 1])?.mounts?.count ?? 1) : 1; cost += f.cost * n; mass += f.wet === f.mass ? f.mass * n : f.wet; }
    for (const r of shape.radial ?? []) { const d = catalog.get(r.type); if (!d) continue; const f = figuresOf(d); cost += f.cost * (r.symmetry ?? 1); mass += f.wet * (r.symmetry ?? 1); }
    return { cost, mass };
  };
  const shapeIcon = (shape) => {
    const pick = shape.icon ?? shape.stack.find((t) => catalog.get(t)?.flags?.capsule || catalog.get(t)?.mounts || catalog.get(t)?.fuel) ?? shape.stack[0];
    const d = catalog.get(pick);
    return d ? icons.iconFor(d) : '';
  };

  // ---------- navigation ----------
  const here = () => state.path[state.path.length - 1] ?? { view: 'home' };
  function openSection(id, view = { view: 'home' }) {
    state.open = id;
    state.path = [{ view: 'home' }];
    if (view.view !== 'home') state.path.push(view);
    state.focus = null;
    sync3d();
    render();
  }
  function go(view) { state.path.push(view); state.focus = null; sync3d(); render(); dockScrollTop(); }
  function back() {
    if (state.path.length > 1) state.path.pop(); else { closeAll(); return; }
    state.focus = null;
    sync3d();
    render();
  }
  function closeAll() {
    state.open = null;
    state.path = [];
    state.focus = null;
    sync3d();
    render();
  }
  function dockScrollTop() { const body = cardsEl.querySelector('.vd-sec-body'); if (body) body.scrollTop = 0; }
  function sync3d() {
    const v = here();
    scene3d.setActiveSection(state.open);
    if (v.view === 'part' || v.view === 'slot') {
      scene3d.select(v.id);
      if (v.view === 'slot') { scene3d.focusOn(v.id, { exploded: true }); scene3d.highlightPiece(v.key); } else { scene3d.focusOn(v.id); scene3d.highlightPiece(null); }
    } else {
      scene3d.select(null);
      scene3d.highlightPiece(null);
      if (state.open) scene3d.focusSection(state.open); else scene3d.fit();
    }
  }

  // ---------- generic list item (collapsed row → expands in place) ----------
  function item({ id, img = null, name, sub = '', price = '', tag = null, on = false, expanded = false, onToggle, detail = null, action = null, hot = false }) {
    const wrap = h('div', `vd-item${on ? ' vd-item--on' : ''}${expanded ? ' vd-item--open' : ''}${hot ? ' vd-item--hot' : ''}`);
    wrap.dataset.item = id;
    const row = btn('vd-item-row', null, onToggle, { item: id });
    if (img !== null) {
      const im = h('img', 'vd-item-img');
      im.src = img || '';
      im.alt = '';
      im.draggable = false;
      row.append(im);
    }
    const txt = h('span', 'vd-item-txt');
    txt.append(h('span', 'vd-item-name', name), h('span', 'vd-item-sub', sub));
    row.append(txt);
    const right = h('span', 'vd-item-right');
    if (tag) right.append(h('span', `vd-tag vd-tag--${tag.kind ?? 'info'}`, tag.text));
    if (price) right.append(h('span', 'vd-item-price', price));
    right.append(h('span', 'vd-item-chev', expanded ? '▾' : '▸'));
    row.append(right);
    wrap.append(row);
    if (expanded && (detail || action)) {
      const d = h('div', 'vd-item-detail');
      if (detail) d.append(...[].concat(detail).filter(Boolean));
      if (action) d.append(action);
      wrap.append(d);
    }
    return wrap;
  }
  const fact = (k, v, cls = '') => { const r = h('div', 'vd-fact'); r.append(h('span', 'vd-fact-k', k), h('span', `vd-fact-v ${cls}`, v)); return r; };
  const facts = (...rows) => { const f = h('div', 'vd-facts'); f.append(...rows.filter(Boolean)); return f; };
  const prosCons = (pros = [], cons = []) => {
    const w = h('div', 'vd-proscons');
    const p = h('ul', 'vd-pros'); for (const x of pros) p.append(h('li', null, x));
    const c = h('ul', 'vd-cons'); for (const x of cons) c.append(h('li', null, x));
    w.append(p, c);
    return w;
  };
  const para = (text, cls = 'vd-text') => h('p', cls, text);
  const primary = (label, onClick, tool) => btn('vd-btn vd-btn--choose', label, onClick, { tool });
  const toggleFocus = (id) => { state.focus = state.focus === id ? null : id; sound('ui.click'); render(); };

  // facts about a part definition (optionally an installed part)
  function partFacts(def, fig, part = null) {
    const rows = [];
    if (def.engine && fig.engine) {
      const e = fig.engine, n = e.count ?? 1;
      rows.push(fact(n > 1 ? `Thrust (${n} engines, sea level / vacuum)` : 'Thrust (sea level / vacuum)', `${fmtKN(e.thrustSL * n)} / ${fmtKN(e.thrust * n)}`));
      rows.push(fact('Isp (sea level / vacuum)', `${fmtInt(e.ispSL)} / ${fmtInt(e.ispVac)} s`));
      rows.push(fact('Engine', `${e.fuel} · ${e.nozzle === 'sl' ? 'sea-level' : 'vacuum'} nozzle · pump ${e.pump}`));
    }
    if (def.booster && fig.booster) {
      rows.push(fact('Thrust', fmtKN(fig.booster.thrust)), fact('Isp (sea level / vacuum)', `${fmtInt(fig.booster.ispSL)} / ${fmtInt(fig.booster.ispVac)} s`), fact('Propellant · burn', `${fmtMass(fig.booster.propellant)} · ${fmtInt(fig.booster.burnTime)} s`));
    }
    if (def.mounts) rows.push(fact('Engine positions', String(def.mounts.count ?? 1)));
    if (def.fuel) rows.push(fact('Propellant', `${fmtMass(def.fuel.mass)} of ${def.fuel.type}`));
    rows.push(fact(def.fuel || def.booster ? 'Dry mass' : 'Mass', fmtMass(fig.mass)), fact('Price', fmtMoney(fig.cost)), fact('Reliability', fmtPct(fig.reliability), fig.reliability < 0.95 ? 'vd-warn' : ''));
    if (fig.power) rows.push(fact('Power', `${fmtInt(fig.power)} W at Earth`));
    if (fig.chuteCdA) rows.push(fact('Parachute drag area', `${fmtInt(fig.chuteCdA)} m²`));
    if (def.flags?.spareO2Tanks) rows.push(fact('Spare oxygen', `${def.flags.spareO2Tanks} refill${def.flags.spareO2Tanks > 1 ? 's' : ''}`));
    if (def.flags?.armorHits) rows.push(fact('Debris hits absorbed', String(def.flags.armorHits)));
    if (def.flags?.reliabilityBonus) rows.push(fact('Whole-ship reliability', `+${(def.flags.reliabilityBonus * 100).toFixed(1)} %`));
    if (def.aero?.cdA) rows.push(fact('Drag area on ascent', `${def.aero.cdA} m²`));
    if (def.aero?.entryCdA) rows.push(fact('Drag area on entry', `${def.aero.entryCdA} m²`));
    rows.push(fact('Size', `${def.height.toFixed(2)} m · ${def.size.toUpperCase()} diameter`));
    if (def.real) rows.push(fact('Real-world reference', def.real));
    if (part) { const mat = materialOf(part, def); if (mat) rows.push(fact('Material', mat.name)); }
    return facts(...rows);
  }
  function compare(def, installedDef, installedPart) {
    const fig = figuresOf(def), cur = figuresOf(installedDef, installedPart);
    const box = h('div', 'vd-compare');
    box.append(h('div', 'vd-label', `Compared with the ${installedDef.name}`));
    box.append(fact('Mass', signed(fig.mass - cur.mass, fmtMass), fig.mass > cur.mass ? 'vd-warn' : 'vd-good'));
    box.append(fact('Price', signed(fig.cost - cur.cost, fmtMoneyShort), fig.cost > cur.cost ? 'vd-warn' : 'vd-good'));
    box.append(fact('Reliability', signed((fig.reliability - cur.reliability) * 100, (n) => `${n.toFixed(1)} %`), fig.reliability < cur.reliability ? 'vd-warn' : 'vd-good'));
    if (def.fuel && installedDef.fuel) box.append(fact('Propellant', signed(def.fuel.mass - installedDef.fuel.mass, fmtMass)));
    return box;
  }
  function candidateItem(def, { installed = null, installedPart = null, onInstall, label = 'INSTALL' }) {
    const fig = figuresOf(def);
    const open = state.focus === def.id;
    const isOn = installed?.id === def.id;
    const sub = def.fuel ? `${fmtMass(def.fuel.mass)} ${def.fuel.type}` : def.booster ? fmtKN(fig.booster.thrust) : def.engine ? `${fmtKN(fig.engine.thrust)} each` : def.mounts ? `${def.mounts.count} engine${def.mounts.count > 1 ? 's' : ''}` : (def.desc || def.role || '');
    return item({
      id: def.id, img: icons.iconFor(def), name: def.name, sub, price: `${def.engine ? 'from ' : ''}${fmtMoneyShort(fig.cost)}`,
      on: isOn, tag: isOn ? { text: 'INSTALLED', kind: 'on' } : null, expanded: open, onToggle: () => toggleFocus(def.id),
      detail: open ? [h('div', 'vd-role', def.role ?? ''), para(def.detail ?? def.desc ?? ''), prosCons(def.pros, def.cons), partFacts(def, fig), installed && !isOn ? compare(def, installed, installedPart) : null] : null,
      action: open && !isOn ? primary(`${label} · ${fmtMoneyShort(fig.cost)}`, () => onInstall(def), 'install') : null,
    });
  }

  // ---------- views of a vehicle section ----------
  function viewHome(sec) {
    const out = [];
    const w = sectionWarnings(sec.id);
    if (w.blocks.length || w.warnings.length) {
      const box = h('div', 'vd-issues');
      for (const id of w.blocks) box.append(h('div', 'vd-issue vd-issue--block', WARN[id] ?? id));
      for (const id of w.warnings) box.append(h('div', 'vd-issue', WARN[id] ?? id));
      out.push(box);
    }
    const parts = sectionParts(assembly, sec.id);
    const empty = !parts.axial.length;
    // 1. the shape
    const shape = currentShape(assembly, sec);
    const shapeBlock = h('div', 'vd-block');
    shapeBlock.append(h('div', 'vd-label', '1 · Shape'));
    if (empty) {
      shapeBlock.append(para('Nothing here yet. Pick a shape to start: each one is a real rocket\'s layout, and every part in it can be changed afterwards.', 'vd-muted'));
      shapeBlock.append(...shapeItems(sec));
    } else {
      shapeBlock.append(item({ id: 'shape', img: shape ? shapeIcon(shape) : icons.iconFor(catalog.get(parts.axial[0].type)), name: shape?.name ?? 'Custom', sub: shape?.real ?? 'Your own layout', price: '', onToggle: () => go({ view: 'shapes' }) }));
    }
    out.push(shapeBlock);
    // 2. the components
    if (!empty || sec.rows.some((r) => r.mode === 'radial')) {
      const comp = h('div', 'vd-block');
      comp.append(h('div', 'vd-label', '2 · Components'));
      for (const row of sec.rows) {
        const items = rowItems(assembly, sec, row);
        if (row.mode === 'auto' && !items.length) continue;
        const group = h('div', 'vd-row');
        const head = h('div', 'vd-row-head');
        head.append(h('span', 'vd-row-name', row.name), h('span', 'vd-row-role', row.role ?? ''));
        group.append(head);
        for (const { part, twins } of items) {
          const def = catalog.get(part.type);
          const fig = figuresOf(def, part);
          const e = entryOf(part.id);
          const n = e?.cluster?.count ?? 1;
          const mat = materialOf(part, def);
          const sub = def.engine ? `${n > 1 ? `${n} × ` : ''}${part.engine?.fuel ?? ''} · ${part.engine?.nozzle === 'vac' ? 'vacuum' : 'sea-level'} nozzle` : mat?.name ?? def.role ?? '';
          group.append(item({ id: part.id, img: icons.iconFor(def), name: `${def.name}${twins > 1 ? ` ×${twins}` : ''}`, sub, price: fmtMoneyShort(fig.cost * twins), onToggle: () => { sound('ui.click'); go({ view: 'part', id: part.id }); } }));
        }
        const canAdd = row.mode === 'radial' || (row.mode === 'stack' && (row.multi || row.id === 'tanks' || row.id === 'structure' || row.id === 'payload' || !items.length));
        if (canAdd && rowCandidates(catalog, sec, row).length) {
          const required = !items.length && ['capsule', 'engines', 'tanks'].includes(row.id);
          group.append(btn(`vd-add${required ? ' vd-add--required' : ''}`, `+ ${items.length ? 'Add another' : required ? 'Add (required)' : 'Add'}`, () => { sound('ui.click'); go({ view: 'add', row: row.id }); }, { add: row.id }));
        }
        comp.append(group);
      }
      out.push(comp);
    }
    if (!empty) out.push(btn('vd-btn vd-btn--danger vd-btn--wide', `REMOVE THE WHOLE ${sec.short.toUpperCase()}`, () => hooks.onConfirm?.(`Take the ${sec.short.toLowerCase()} off the vehicle?`, () => { clearSection(assembly, sec); sound('ui.click'); changed(); }), { tool: 'clearsection' }));
    return out;
  }

  function shapeItems(sec) {
    const cur = currentShape(assembly, sec);
    return sec.shapes.map((shape) => {
      const open = state.focus === shape.id;
      const { cost, mass } = priceOfShape(shape);
      const list = h('ul', 'vd-shape-parts');
      for (const t of shape.stack) { const d = catalog.get(t); if (d) list.append(h('li', null, d.name)); }
      for (const r of shape.radial ?? []) { const d = catalog.get(r.type); if (d) list.append(h('li', 'vd-shape-side', `${d.name}${(r.symmetry ?? 1) > 1 ? ` ×${r.symmetry}` : ''}`)); }
      return item({
        id: shape.id, img: shapeIcon(shape), name: shape.name, sub: shape.real ?? '', price: fmtMoneyShort(cost), on: cur?.id === shape.id, tag: cur?.id === shape.id ? { text: 'IN USE', kind: 'on' } : null,
        expanded: open, onToggle: () => toggleFocus(shape.id),
        detail: open ? [para(shape.desc ?? ''), prosCons(shape.pros, shape.cons), h('div', 'vd-label', 'What it is made of'), list, facts(fact('Price', fmtMoney(cost)), fact('Mass with propellant', fmtMass(mass)), shape.diameter ? fact('Diameter', shape.diameter.toUpperCase()) : null)] : null,
        action: open && cur?.id !== shape.id ? primary(sectionParts(assembly, sec.id).axial.length ? 'USE THIS SHAPE (replaces this section)' : 'USE THIS SHAPE', () => {
          applyShape(assembly, sec, shape);
          sound('ui.snap');
          toast(`${sec.short}: ${shape.name}`);
          state.path = [{ view: 'home' }];
          state.focus = null;
          changed();
          sync3d();
        }, 'useshape') : null,
      });
    });
  }

  function viewShapes(sec) {
    return [para(`Each shape is the layout of a real rocket's ${sec.short.toLowerCase()}. Choosing one replaces this section; the other sections and the equipment you added stay.`, 'vd-muted'), ...shapeItems(sec)];
  }

  function viewAdd(sec, rowId) {
    const row = sec.rows.find((r) => r.id === rowId);
    if (!row) return [];
    const defs = rowCandidates(catalog, sec, row);
    return [para(row.role ?? '', 'vd-muted'), ...defs.map((def) => candidateItem(def, {
      onInstall: (d) => {
        const { ids, message } = addThroughRow(assembly, sec, row, d.id);
        if (!ids.length) { sound('ui.error'); toast(message, 'bad'); return; }
        sound('ui.snap');
        toast(message);
        changed();
        state.path = [{ view: 'home' }, { view: 'part', id: ids[0] }];
        state.focus = null;
        sync3d();
        render();
      },
    }))];
  }

  function viewPart(sec, id) {
    const part = assembly.part(id);
    const def = part && catalog.get(part.type);
    if (!def) { back(); return []; }
    const fig = figuresOf(def, part);
    const out = [];
    const head = h('div', 'vd-part-head');
    const im = h('img', 'vd-part-img');
    im.src = icons.iconFor(def);
    im.alt = def.name;
    im.draggable = false;
    const ht = h('div', 'vd-part-title');
    ht.append(h('div', 'vd-part-name', def.name), h('div', 'vd-role', def.role ?? ''));
    head.append(im, ht);
    out.push(head);
    const more = h('details', 'vd-more');
    more.append(h('summary', null, 'What it is, in plain words'), para(def.detail ?? def.desc ?? ''), prosCons(def.pros, def.cons));
    out.push(more, partFacts(def, fig, part));
    // material
    const fam = materialFamily(def);
    if (fam) {
      const cur = materialOf(part, def);
      const box = h('div', 'vd-block');
      box.append(h('div', 'vd-label', `Material · ${fam.name}`));
      const chips = h('div', 'vd-chips');
      for (const o of fam.options) {
        const c = btn('vd-chip-btn', o.name, () => { assembly.setMaterial(id, o.id); sound('ui.click'); changed(); }, { material: o.id });
        c.setAttribute('aria-pressed', String(cur?.id === o.id));
        chips.append(c);
      }
      box.append(chips);
      if (cur) box.append(para(`${cur.note ?? ''} ${cur.facts ? `(${cur.facts})` : ''}`, 'vd-muted'), h('div', 'vd-small', `mass ×${cur.mass} · cost ×${cur.cost} · reliability ${signed(cur.reliability * 100, (n) => `${n.toFixed(1)} %`)}`));
      out.push(box);
    }
    // inside
    const kit = kitOf(def);
    if (kit) {
      const box = h('div', 'vd-block');
      box.append(h('div', 'vd-label', `Inside · ${kit.name}`), para('Open a line to look inside: the part comes apart on the left and you choose each piece.', 'vd-muted'));
      const opts = assembly.options(id);
      for (const slot of kit.slots) box.append(item({ id: `slot:${slot.key}`, img: optionIcon(def, slot, opts[slot.key] ?? slot.options[0]), name: slot.name, sub: opts[slot.key]?.name ?? '', onToggle: () => { sound('ui.click'); go({ view: 'slot', id, key: slot.key }); } }));
      out.push(box);
    }
    // engine templates and workbench
    if (def.engine) {
      const box = h('div', 'vd-block');
      box.append(h('div', 'vd-label', 'Set it up like a real engine'));
      const chips = h('div', 'vd-chips');
      for (const ref of engines.references ?? []) {
        const c = btn('vd-chip-btn', ref.name, () => {
          assembly.setEngine(id, { fuel: ref.fuel, nozzle: ref.nozzle, pump: ref.pump });
          for (const [k, v] of Object.entries(ref.options ?? {})) assembly.setOption(id, k, v);
          sound('ui.snap');
          toast(`${ref.name}: ${ref.facts}`);
          changed();
        }, { template: ref.id });
        c.title = ref.facts;
        chips.append(c);
      }
      box.append(chips, btn('vd-btn vd-btn--wide', 'ENGINE WORKBENCH: chamber · nozzle · pump', () => hooks.onWorkbench?.(id), { tool: 'workbench' }));
      out.push(box);
    }
    // swap
    const row = rowOf(sec, def);
    const swaps = row ? rowCandidates(catalog, sec, row).filter((d) => d.id !== def.id && canReplace(part, def, d)) : [];
    if (swaps.length) {
      const box = h('div', 'vd-block');
      box.append(h('div', 'vd-label', 'Swap it for'));
      box.append(...swaps.map((d) => candidateItem(d, {
        installed: def, installedPart: part, label: 'SWAP',
        onInstall: (to) => {
          if (!assembly.replace(id, to.id)) { sound('ui.error'); toast('That part does not fit in this place.', 'bad'); return; }
          sound('ui.snap');
          toast(`${def.name} → ${to.name}`);
          state.focus = null;
          changed();
        },
      })));
      out.push(box);
    }
    out.push(btn('vd-btn vd-btn--danger vd-btn--wide', 'REMOVE THIS PART', () => { assembly.remove(id); sound('ui.click'); toast(`${def.name} removed.`); state.path.pop(); changed(); sync3d(); }, { tool: 'remove' }));
    return out;
  }

  function canReplace(part, def, to) {
    if (!to || def.attach !== to.attach) return false;
    if (to.attach === 'axial') {
      if (part.parent !== null && part.node !== 'radial' && !to.nodes.includes(part.node === 'top' ? 'bottom' : 'top')) return false;
      for (const c of assembly.children(part.id)) if (!to.nodes.includes(c.node)) return false;
    }
    return true;
  }

  function deltaLine(o) {
    const bits = [];
    if (o.massF && o.massF !== 1) bits.push(`mass ×${o.massF}`);
    if (o.massD) bits.push(signed(o.massD, fmtMass));
    if (o.costF && o.costF !== 1) bits.push(`cost ×${o.costF}`);
    if (o.costD) bits.push(signed(o.costD, fmtMoneyShort));
    if (o.isp) bits.push(`Isp ${signed(o.isp, (n) => `${n} s`)}`);
    if (o.thrustF && o.thrustF !== 1) bits.push(`thrust ×${o.thrustF}`);
    if (o.powerF && o.powerF !== 1) bits.push(`power ×${o.powerF}`);
    if (o.chuteF && o.chuteF !== 1) bits.push(`drag ×${o.chuteF}`);
    if (o.rel) bits.push(`reliability ${signed(o.rel * 100, (n) => `${n.toFixed(1)} %`)}`);
    return bits.length ? bits.join(' · ') : 'baseline';
  }

  function viewSlot(sec, id, key) {
    const part = assembly.part(id);
    const def = part && catalog.get(part.type);
    const slot = def && kitOf(def)?.slots.find((s) => s.key === key);
    if (!slot) { back(); return []; }
    const current = assembly.options(id)[key];
    const out = [para(slot.role ?? '', 'vd-muted')];
    for (const o of slot.options) {
      const open = state.focus === o.id;
      const now = figuresOf(def, part);
      const then = figuresOf(def, { ...part, options: { ...(part.options ?? {}), [key]: o.id } });
      out.push(item({
        id: o.id, img: optionIcon(def, slot, o), name: o.name, sub: deltaLine(o), on: current?.id === o.id, tag: current?.id === o.id ? { text: 'FITTED', kind: 'on' } : null,
        expanded: open, onToggle: () => toggleFocus(o.id),
        detail: open ? [para(o.note ?? ''), prosCons(o.pros, o.cons), facts(o.real ? fact('Real-world reference', o.real) : null, fact('Part mass', `${fmtMass(now.mass)} → ${fmtMass(then.mass)}`), fact('Part price', `${fmtMoneyShort(now.cost)} → ${fmtMoneyShort(then.cost)}`), fact('Part reliability', `${fmtPct(now.reliability)} → ${fmtPct(then.reliability)}`), then.engine ? fact('Thrust · Isp (vacuum)', `${fmtKN(now.engine.thrust)} · ${fmtInt(now.engine.ispVac)} s → ${fmtKN(then.engine.thrust)} · ${fmtInt(then.engine.ispVac)} s`) : null)] : null,
        action: open && current?.id !== o.id ? primary('USE THIS', () => { assembly.setOption(id, key, o.id); sound('ui.snap'); state.focus = null; changed(); }, 'useoption') : null,
      }));
    }
    return out;
  }

  // ---------- views of the pad ----------
  function viewPadHome(pad) {
    const st = padState(assembly, pad);
    const out = [];
    const w = sectionWarnings('pad');
    if (w.warnings.length) { const box = h('div', 'vd-issues'); for (const id of w.warnings) box.append(h('div', 'vd-issue', WARN[id] ?? id)); out.push(box); }
    const where = h('div', 'vd-block');
    where.append(h('div', 'vd-label', '1 · Where and when'));
    where.append(item({ id: 'site', img: null, name: st.site?.name ?? 'Launch site', sub: st.site?.real ?? '', price: st.site?.fee ? fmtMoneyShort(st.site.fee) : '', onToggle: () => go({ view: 'sites' }) }));
    where.append(item({ id: 'slot', img: null, name: st.slot ? `${st.slot.name} · ${fmtInt(st.slot.tempC)} °C` : 'Launch window', sub: st.slot?.note ?? '', price: st.slot?.fee ? fmtMoneyShort(st.slot.fee) : 'free', onToggle: () => go({ view: 'slots' }) }));
    out.push(where);
    const eqBox = h('div', 'vd-block');
    eqBox.append(h('div', 'vd-label', '2 · Pad equipment'));
    for (const { eq, option } of st.equipment) eqBox.append(item({ id: `eq:${eq.key}`, img: null, name: eq.name, sub: option?.name ?? '', price: option?.fee ? fmtMoneyShort(option.fee) : 'free', onToggle: () => go({ view: 'equipment', key: eq.key }) }));
    out.push(eqBox);
    const fees = last?.breakdown.launchFee ?? 0;
    out.push(facts(fact('Launch fees, paid at confirm', fmtMoney(fees)), fact('Pad reliability', `+${((last?.breakdown.padReliability ?? 0) * 100).toFixed(1)} %`)));
    return out;
  }
  function choiceItems(options, currentId, onChoose, { subOf = (o) => o.note ?? '', priceOf = (o) => (o.fee ? fmtMoneyShort(o.fee) : 'free') } = {}) {
    return options.map((o) => {
      const open = state.focus === o.id;
      const extra = [];
      if (o.tempC != null) extra.push(fact('Temperature at the pad', `${fmtInt(o.tempC)} °C`));
      if (o.reliability) extra.push(fact('Reliability', signed(o.reliability * 100, (n) => `${n.toFixed(1)} %`), o.reliability > 0 ? 'vd-good' : 'vd-warn'));
      if (o.fee != null) extra.push(fact('Fee', o.fee ? fmtMoney(o.fee) : 'free'));
      if (o.real) extra.push(fact('Real-world reference', o.real));
      return item({
        id: o.id, img: null, name: o.name, sub: subOf(o), price: priceOf(o), on: o.id === currentId, tag: o.id === currentId ? { text: 'CHOSEN', kind: 'on' } : null,
        expanded: open, onToggle: () => toggleFocus(o.id),
        detail: open ? [para(o.note ?? ''), prosCons(o.pros, o.cons), facts(...extra)] : null,
        action: open && o.id !== currentId ? primary('CHOOSE', () => { onChoose(o); sound('ui.click'); state.focus = null; changed(); }, 'choose') : null,
      });
    });
  }
  function viewSites(pad) {
    const st = padState(assembly, pad);
    return [para('Where the ship leaves from. The site sets the weather of each launch window.', 'vd-muted'), ...choiceItems(pad.sites, st.site?.id, (o) => assembly.setLaunchSite(o.id, o.slots?.[0]?.id ?? null), { subOf: (o) => o.real ?? o.note ?? '' })];
  }
  function viewSlots(pad) {
    const st = padState(assembly, pad);
    return [para('The soonest window is free but may be cold. Seals that are not rated for cold lose their flexibility below 5 °C: the whole story of Challenger.', 'vd-muted'), ...choiceItems(st.site?.slots ?? [], st.slot?.id, (o) => assembly.setLaunchSlot(o.id), { subOf: (o) => `${fmtInt(o.tempC)} °C · ${o.note ?? ''}` })];
  }
  function viewEquipment(pad, key) {
    const st = padState(assembly, pad);
    const c = st.equipment.find((x) => x.eq.key === key);
    if (!c) { back(); return []; }
    return [para(c.eq.role ?? '', 'vd-muted'), ...choiceItems(c.eq.options, c.option?.id, (o) => assembly.setPadOption(key, o.id))];
  }

  // ---------- cards ----------
  function sectionSummary(id) {
    if (id === 'pad') {
      const st = padState(assembly, sections.pad);
      return { line: `${st.site?.name?.split(',')[0] ?? 'No site'} · ${st.slot ? `${st.slot.name} · ${fmtInt(st.slot.tempC)} °C` : ''}`, built: true, img: null };
    }
    const sec = sections[id];
    const { axial, radial } = sectionParts(assembly, id);
    if (!axial.length && !radial.length) return { line: 'Not built yet: click to start', built: false, img: null };
    const shape = currentShape(assembly, sec);
    const cost = (last?.breakdown.parts ?? []).filter((p) => catalog.get(p.type)?.section === id).reduce((t, p) => t + (p.cost ?? 0), 0);
    let detail = `${axial.length + radial.length} parts`;
    if (id === 'body') detail = `${fmtMass(axial.reduce((t, p) => t + (catalog.get(p.type)?.fuel?.mass ?? 0), 0))} propellant`;
    if (id === 'tail') { const eng = axial.find((p) => catalog.get(p.type)?.engine); const n = eng ? entryOf(eng.id)?.cluster?.count ?? 1 : 0; detail = eng ? `${n > 1 ? `${n} × ` : ''}${catalog.get(eng.type).name.replace('Engine, ', '')}` : 'no engine'; }
    const main = axial.find((p) => catalog.get(p.type)?.flags?.capsule) ?? axial.find((p) => catalog.get(p.type)?.mounts) ?? axial.find((p) => catalog.get(p.type)?.fuel) ?? axial[0];
    return { line: `${shape?.name ?? 'Custom'} · ${detail} · ${fmtMoneyShort(cost)}`, built: true, img: main ? icons.iconFor(catalog.get(main.type)) : null };
  }
  function crumbs(id) {
    const sec = sections[id];
    const names = [sec.short];
    for (const v of state.path.slice(1)) {
      if (v.view === 'shapes') names.push('Shape');
      else if (v.view === 'add') names.push(`Add: ${sec.rows.find((r) => r.id === v.row)?.name ?? ''}`);
      else if (v.view === 'part') names.push(catalog.get(assembly.part(v.id)?.type)?.name ?? 'Part');
      else if (v.view === 'slot') names.push(kitOf(catalog.get(assembly.part(v.id)?.type))?.slots.find((s) => s.key === v.key)?.name ?? 'Inside');
      else if (v.view === 'sites') names.push('Launch site');
      else if (v.view === 'slots') names.push('Launch window');
      else if (v.view === 'equipment') names.push(sec.equipment?.find((e) => e.key === v.key)?.name ?? 'Equipment');
    }
    return names;
  }
  function bodyFor(id) {
    const v = here();
    if (id === 'pad') {
      if (v.view === 'sites') return viewSites(sections.pad);
      if (v.view === 'slots') return viewSlots(sections.pad);
      if (v.view === 'equipment') return viewEquipment(sections.pad, v.key);
      return viewPadHome(sections.pad);
    }
    const sec = sections[id];
    if (v.view === 'shapes') return viewShapes(sec);
    if (v.view === 'add') return viewAdd(sec, v.row);
    if (v.view === 'part') return viewPart(sec, v.id);
    if (v.view === 'slot') return viewSlot(sec, v.id, v.key);
    return viewHome(sec);
  }
  function render() {
    if (el.hidden) return;
    const keepScroll = cardsEl.querySelector('.vd-sec-body')?.scrollTop ?? 0;
    const samePlace = render.lastKey === `${state.open}:${state.path.length}:${JSON.stringify(here())}`;
    render.lastKey = `${state.open}:${state.path.length}:${JSON.stringify(here())}`;
    cardsEl.replaceChildren();
    for (const id of [...VEHICLE_SECTIONS, 'pad']) {
      const sec = sections[id];
      const open = state.open === id;
      const sum = sectionSummary(id);
      const w = sectionWarnings(id);
      const issues = w.blocks.length + w.warnings.length;
      const card = h('article', `vd-sec${open ? ' vd-sec--open' : ''}${!sum.built ? ' vd-sec--empty' : ''}`);
      card.dataset.section = id;
      const head = btn('vd-sec-head', null, () => { sound('ui.click'); if (open) closeAll(); else openSection(id); }, { section: id });
      head.append(h('span', 'vd-sec-num', SECTION_NUM[id]));
      if (sum.img) { const im = h('img', 'vd-sec-img'); im.src = sum.img; im.alt = ''; im.draggable = false; head.append(im); } else head.append(h('span', `vd-sec-img vd-sec-img--${id}`));
      const t = h('span', 'vd-sec-txt');
      t.append(h('span', 'vd-sec-name', sec.name), h('span', 'vd-sec-line', sum.line));
      head.append(t);
      head.append(h('span', `vd-sec-status ${!sum.built ? 'vd-sec-status--empty' : w.blocks.length ? 'vd-sec-status--block' : issues ? 'vd-sec-status--warn' : 'vd-sec-status--ok'}`, !sum.built ? '' : issues ? `! ${issues}` : '✓'));
      head.append(h('span', 'vd-sec-chev', open ? '▾' : '▸'));
      card.append(head);
      if (open) {
        const nav = h('div', 'vd-crumbs');
        nav.append(btn('vd-icon vd-back', '◂', () => { sound('ui.click'); back(); }, { tool: 'back' }), h('span', 'vd-crumb', crumbs(id).join('  ›  ')));
        const body = h('div', 'vd-sec-body');
        body.append(...bodyFor(id));
        card.append(nav, body);
        if (samePlace) queueMicrotask(() => { body.scrollTop = keepScroll; });
      }
      cardsEl.append(card);
    }
  }

  // ---------- top-bar numbers ----------
  function chip(label, value, st, sub = null) {
    const c = h('div', 'vd-chip');
    c.dataset.state = st;
    c.append(h('span', 'vd-chip-label', label), h('span', 'vd-chip-value', value));
    if (sub) c.append(h('span', 'vd-chip-sub', sub));
    return c;
  }
  function renderStats(result) {
    const s = result.spec.stats, b = result.breakdown;
    const money = getMoney(), fee = b.launchFee ?? b.slot?.fee ?? 0;
    stats.replaceChildren(
      chip('Cost', fmtMoneyShort(s.cost), s.cost + fee > money ? 'bad' : 'ok', fee ? `+${fmtMoneyShort(fee)} launch fees` : 'no launch fees'),
      chip('Funds', fmtMoneyShort(money), money < s.cost + fee ? 'bad' : 'ok'),
      chip('Δv', fmtInt(s.deltaV), s.deltaV >= b.roundTrip ? 'good' : s.deltaV >= b.oneWay ? 'ok' : 'bad', `need ${fmtInt(b.oneWay)} m/s`),
      chip('TWR', s.twrEarth.toFixed(2), s.twrEarth >= 1.2 ? 'ok' : s.twrEarth >= 1 ? 'warn' : 'bad', `${fmtKN(b.thrustSL)} on the pad`),
      chip('Reliability', fmtPct(s.reliability), s.reliability >= 0.9 ? 'good' : s.reliability >= 0.8 ? 'ok' : 'bad'),
    );
    shipName.textContent = assembly.name;
    undoBtn.disabled = !assembly.canUndo;
  }

  // ---------- pointer on the 3D view ----------
  view.addEventListener('click', (e) => {
    if (e.target !== view) return;
    const hit = scene3d.pick(e.clientX, e.clientY, view.getBoundingClientRect());
    if (!hit) return;
    sound('ui.click');
    if (hit.pad) { openSection('pad'); return; }
    if (hit.internal) { state.path = [{ view: 'home' }, { view: 'part', id: hit.partId }, { view: 'slot', id: hit.partId, key: hit.internal }]; state.focus = null; sync3d(); render(); return; }
    const def = catalog.get(assembly.part(hit.partId)?.type);
    if (def?.section) openSection(def.section, { view: 'part', id: hit.partId });
  });
  view.addEventListener('wheel', (e) => { e.preventDefault(); scene3d.zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  const ghost = document.createElement('canvas');
  ghost.width = ghost.height = 1;
  let drag = null;
  view.addEventListener('dragstart', (e) => {
    if (e.target !== view) { e.preventDefault(); return; }
    e.dataTransfer.setDragImage(ghost, 0, 0);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', 'turn'); } catch { /* some browsers refuse */ }
    drag = { x: e.clientX, y: e.clientY };
    view.classList.add('vd-view--turning');
  });
  el.addEventListener('dragenter', (e) => { if (drag) e.preventDefault(); });
  el.addEventListener('dragover', (e) => {
    if (!drag) return;
    e.preventDefault();
    if (!e.clientX && !e.clientY) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (dx || dy) { scene3d.rotateBy(dx, dy); drag = { x: e.clientX, y: e.clientY }; }
  });
  el.addEventListener('drop', (e) => { if (drag) e.preventDefault(); });
  view.addEventListener('dragend', () => { drag = null; view.classList.remove('vd-view--turning'); });

  // ---------- refresh ----------
  let padKey = '';
  function refresh(result) {
    last = result;
    renderStats(result);
    scene3d.setLayout(assembly.layout());
    const st = padState(assembly, sections.pad);
    // the pad is redrawn when the site, the equipment or the ship's size changes (the tower and its arms fit the ship)
    const lay = scene3d.layout.filter((e) => e.attach === 'axial');
    const radius = lay.reduce((r, e) => Math.max(r, e.radius), 1.25);
    const height = lay.reduce((t, e) => Math.max(t, e.y + e.height), 0);
    const key = `${st.site?.id}:${st.slot?.id}:${st.equipment.map((c) => c.option?.id).join(',')}:${radius.toFixed(2)}:${height.toFixed(1)}`;
    if (key !== padKey) {
      padKey = key;
      scene3d.setPad(padArt(st, { radius, height, layout: scene3d.layout }));
    }
    if (scene3d.missingArt.length) hooks.onNeedArt?.(scene3d.missingArt);
    emptyHint.hidden = assembly.parts.length > 0;
    // a part that disappeared (undo, swap, clear) closes its views
    while (state.path.length > 1 && ['part', 'slot'].includes(here().view) && !assembly.part(here().id)) state.path.pop();
    render();
  }

  function update(dt) {
    if (el.hidden) return;
    const v = here();
    const part = (v.view === 'part' || v.view === 'slot') ? assembly.part(v.id) : null;
    const canExplode = part && kitOf(catalog.get(part.type));
    scene3d.setExplode(!canExplode ? 0 : v.view === 'slot' ? 1 : scene3d.zoomFraction());
    const rect = view.getBoundingClientRect();
    if (rect.width && rect.height) scene3d.setViewCentre(rect.left + rect.width / 2, rect.top + rect.height / 2, window.innerWidth, window.innerHeight);
    scene3d.update(dt);
    turn.value = String(((((scene3d.orbit.yaw * 180) / Math.PI) % 360) + 360) % 360);
  }

  function show({ card = null, view: v = null } = {}) {
    el.hidden = false;
    hooks.onOpen3d?.(scene3d.scene, scene3d.camera);
    scene3d.setEnvironment();
    padKey = '';
    refresh(last ?? hooks.compute?.());
    if (card) openSection(card, v ?? { view: 'home' }); else { closeAll(); scene3d.fit(); }
  }
  function hide() {
    if (el.hidden) return;
    el.hidden = true;
    state.open = null;
    state.path = [];
    scene3d.select(null);
    scene3d.setActiveSection(null);
    scene3d.clearViewCentre();
    hooks.onClose3d?.();
  }

  return {
    el, lensHost, refresh, show, hide, update,
    /** Esc: one step back inside the open card, then close the card. Returns true when it did something. */
    back: () => { if (!state.open) return false; back(); return true; },
    closePicker: () => closeAll(),
    rotateBy: (deg) => { scene3d.orbit.yaw += (deg * Math.PI) / 180; scene3d.orbit.idle = 0; },
    openSection,
    get open() { return !el.hidden; },
    get pickerOpen() { return !!state.open; },
  };
}
